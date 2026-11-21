import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { LeadDistributionService } from '../services/leadDistribution.service.js';
import { LeadStage, Role } from '@prisma/client';

export class LeadController {
  static async listLeads(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const isAgent = req.user!.role === Role.AGENT;
      const { stage, assignedToId, search, page = '1', limit = '50' } = req.query;

      const whereClause: any = { orgId };

      if (isAgent) {
        // Enforce data isolation: Agents ONLY see leads assigned to themselves
        whereClause.assignedToId = req.user!.id;
      } else if (assignedToId && assignedToId !== 'all') {
        whereClause.assignedToId = String(assignedToId);
      }

      if (stage && stage !== 'all') {
        whereClause.stage = stage as LeadStage;
      }

      if (search) {
        const term = String(search);
        whereClause.OR = [
          { fullName: { contains: term } },
          { phone: { contains: term } },
          { email: { contains: term } },
          { tags: { contains: term } },
        ];
      }

      const pageNum = parseInt(String(page), 10) || 1;
      const limitNum = parseInt(String(limit), 10) || 50;

      const [leads, total] = await Promise.all([
        prisma.lead.findMany({
          where: whereClause,
          include: {
            assignedTo: {
              select: { id: true, name: true, email: true },
            },
            _count: {
              select: { calls: true, notes: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
        prisma.lead.count({ where: whereClause }),
      ]);

      res.status(200).json({
        leads,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch leads.' });
    }
  }

  static async createLead(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const {
        fullName,
        phone,
        email,
        alternatePhone,
        company,
        jobTitle,
        country,
        state,
        city,
        streetAddress,
        streetAddress2,
        postalCode,
        source = 'manual',
        campaignName,
        adName,
        tags,
        stageName = 'Fresh',
        customFields,
        assignedToId: requestedAssignedTo,
      } = req.body;

      if (!phone) {
        res.status(400).json({ error: 'Phone number is required.' });
        return;
      }

      const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

      // If creator is an AGENT, automatically assign lead to themselves
      const isAgent = req.user!.role === Role.AGENT;
      let assignedToId = isAgent ? req.user!.id : requestedAssignedTo;
      if (!assignedToId || assignedToId === 'unassigned') {
        assignedToId = await LeadDistributionService.assignNextAvailableAgent(orgId);
      }

      const lead = await prisma.lead.create({
        data: {
          orgId,
          phone: cleanPhone,
          fullName: fullName?.trim() || null,
          email: email?.trim() || null,
          alternatePhone: alternatePhone?.trim() || null,
          company: company?.trim() || null,
          jobTitle: jobTitle?.trim() || null,
          country: country?.trim() || null,
          state: state?.trim() || null,
          city: city?.trim() || null,
          streetAddress: streetAddress?.trim() || null,
          streetAddress2: streetAddress2?.trim() || null,
          postalCode: postalCode?.trim() || null,
          source,
          campaignName,
          adName,
          tags: typeof tags === 'string' ? tags : Array.isArray(tags) ? tags.join(',') : null,
          stageName,
          customFields: typeof customFields === 'string' ? customFields : customFields ? JSON.stringify(customFields) : null,
          assignedToId,
        },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      res.status(201).json(lead);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create lead.' });
    }
  }

  static async getLeadById(req: Request, res: Response): Promise<void> {
    try {
      const { leadId } = req.params;
      const orgId = req.user!.orgId;
      const isAgent = req.user!.role === Role.AGENT;

      const whereClause: any = { id: leadId, orgId };
      if (isAgent) {
        whereClause.assignedToId = req.user!.id;
      }

      const lead = await prisma.lead.findFirst({
        where: whereClause,
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          calls: {
            include: { user: { select: { id: true, name: true } } },
            orderBy: { startedAt: 'desc' },
          },
          notes: {
            include: { author: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
          },
          followUps: {
            include: { assignedTo: { select: { id: true, name: true } } },
            orderBy: { scheduledAt: 'asc' },
          },
          _count: {
            select: { calls: true, notes: true, followUps: true },
          },
        },
      });

      if (!lead) {
        res.status(404).json({ error: 'Lead not found.' });
        return;
      }

      // Next pending follow-up
      const nextPendingFollowUp = lead.followUps.find((f) => f.status === 'PENDING');

      // Construct a unified chronological timeline
      const timeline: any[] = [];

      // Follow-up & Task events
      lead.followUps.forEach((f) => {
        const isCancelled = f.status === 'CANCELLED';
        const isDone = f.status === 'COMPLETED';
        const dateFormatted = new Date(f.scheduledAt).toLocaleString('en-US', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

        timeline.push({
          id: `followup_${f.id}`,
          type: isCancelled ? 'followup_cancelled' : isDone ? 'followup_completed' : 'followup_set',
          title: isCancelled
            ? 'Follow-up cancelled'
            : isDone
            ? `Follow-up completed: ${f.title}`
            : `Follow-up set for ${dateFormatted}`,
          subtitle: f.note || (isCancelled ? undefined : f.title),
          author: f.assignedTo?.name || 'Aftab Sk',
          platform: 'Companion App',
          timestamp: f.updatedAt || f.createdAt,
        });
      });

      // Stage change event if modified
      if (lead.stage !== 'NEW') {
        const stageLabel = lead.stage === 'WON' ? 'Won' : lead.stage === 'CONTACTED' ? 'Contacted' : lead.stage === 'QUALIFIED' ? 'Qualified' : lead.stage;
        timeline.push({
          id: `stage_${lead.id}`,
          type: 'stage_changed',
          title: 'Stage changed',
          subtitle: `Fresh → ${stageLabel}`,
          author: lead.assignedTo?.name || 'Aftab Sk',
          platform: 'System',
          timestamp: lead.updatedAt,
        });
      }

      // Calls events matching Image 10
      lead.calls.forEach((c) => {
        const outcomeTag = c.tags || (c.status === 'CONNECTED' ? 'Connected' : 'Not connected');
        timeline.push({
          id: `call_${c.id}`,
          type: 'call_logged',
          title: c.direction === 'OUTBOUND' ? 'Outgoing call' : 'Incoming call',
          subtitle: outcomeTag,
          author: c.user?.name || 'Aftab Sk',
          platform: 'Android app',
          audioPath: c.audioPath,
          callId: c.id,
          tags: c.tags,
          timestamp: c.startedAt,
        });
      });

      // Notes events
      lead.notes.forEach((n) => {
        timeline.push({
          id: `note_${n.id}`,
          type: 'note_added',
          title: 'Note added',
          subtitle: n.content,
          author: n.author?.name || 'Aftab Sk',
          platform: 'Web',
          timestamp: n.createdAt,
        });
      });

      // Lead Creation event matching Image 10
      timeline.push({
        id: `created_${lead.id}`,
        type: 'lead_created',
        title: 'Lead submitted',
        subtitle: lead.source ? `via ${lead.source}` : 'via Manual Entry',
        author: lead.assignedTo?.name || 'Aftab Sk',
        platform: 'Web',
        timestamp: lead.createdAt,
      });

      // Sort timeline descending
      timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.status(200).json({
        lead: {
          ...lead,
          nextFollowup: nextPendingFollowUp
            ? {
                id: nextPendingFollowUp.id,
                title: nextPendingFollowUp.title,
                scheduledAt: nextPendingFollowUp.scheduledAt,
                note: nextPendingFollowUp.note,
              }
            : null,
        },
        timeline,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch lead details.' });
    }
  }

  static async addNote(req: Request, res: Response): Promise<void> {
    try {
      const { leadId } = req.params;
      const orgId = req.user!.orgId;
      const userId = req.user!.id;
      const { content } = req.body;

      if (!content || !content.trim()) {
        res.status(400).json({ error: 'Note content is required.' });
        return;
      }

      const lead = await prisma.lead.findFirst({
        where: { id: leadId, orgId },
      });

      if (!lead) {
        res.status(404).json({ error: 'Lead not found.' });
        return;
      }

      if (req.user!.role === Role.AGENT && lead.assignedToId !== userId) {
        res.status(403).json({ error: 'Forbidden: You can only add notes to your assigned leads.' });
        return;
      }

      const note = await prisma.note.create({
        data: {
          leadId: lead.id,
          authorId: userId,
          content: content.trim(),
        },
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      });

      res.status(201).json(note);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to add note.' });
    }
  }

  static async bulkUploadLeads(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;

      if (req.user!.role === Role.AGENT) {
        res.status(403).json({ error: 'Forbidden: Agents cannot bulk upload leads.' });
        return;
      }

      const { leads } = req.body;

      if (!Array.isArray(leads) || leads.length === 0) {
        res.status(400).json({ error: 'Payload must contain a non-empty array of leads.' });
        return;
      }

      const createdLeads = [];
      for (const item of leads) {
        if (!item.phone) continue;
        const cleanPhone = String(item.phone).replace(/[\s\-\(\)]/g, '');
        const assignedToId = item.assignedToId || (await LeadDistributionService.assignNextAvailableAgent(orgId));

        const lead = await prisma.lead.create({
          data: {
            orgId,
            phone: cleanPhone,
            fullName: item.fullName || item.name || null,
            email: item.email || null,
            company: item.company || null,
            jobTitle: item.jobTitle || null,
            source: item.source || 'bulk_upload',
            stageName: item.stageName || 'Fresh',
            tags: item.tags || null,
            assignedToId,
          },
        });
        createdLeads.push(lead);
      }

      res.status(201).json({ message: `Successfully imported ${createdLeads.length} leads.`, count: createdLeads.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Bulk upload failed.' });
    }
  }

  static async deleteLead(req: Request, res: Response): Promise<void> {
    try {
      const { leadId } = req.params;
      const orgId = req.user!.orgId;

      if (req.user!.role === Role.AGENT) {
        res.status(403).json({ error: 'Forbidden: Agents cannot delete leads.' });
        return;
      }

      await prisma.lead.deleteMany({
        where: { id: leadId, orgId },
      });

      res.status(200).json({ success: true, message: 'Lead deleted successfully.' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete lead.' });
    }
  }

  static async updateStage(req: Request, res: Response): Promise<void> {
    try {
      const { leadId } = req.params;
      const { stage } = req.body;
      const orgId = req.user!.orgId;
      const isAgent = req.user!.role === Role.AGENT;

      if (!Object.values(LeadStage).includes(stage)) {
        res.status(400).json({ error: 'Invalid lead stage.' });
        return;
      }

      if (isAgent) {
        const lead = await prisma.lead.findFirst({
          where: { id: leadId, orgId, assignedToId: req.user!.id },
        });
        if (!lead) {
          res.status(403).json({ error: 'Forbidden: You can only update stages for your assigned leads.' });
          return;
        }
      }

      const updated = await prisma.lead.update({
        where: { id: leadId },
        data: { stage },
      });

      res.status(200).json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update lead stage.' });
    }
  }

  static async updateLead(req: Request, res: Response): Promise<void> {
    try {
      const { leadId } = req.params;
      const { fullName, phone, email, tags, stage, assignedToId } = req.body;
      const orgId = req.user!.orgId;
      const isAgent = req.user!.role === Role.AGENT;

      if (isAgent) {
        const lead = await prisma.lead.findFirst({
          where: { id: leadId, orgId, assignedToId: req.user!.id },
        });
        if (!lead) {
          res.status(403).json({ error: 'Forbidden: You can only modify your assigned leads.' });
          return;
        }
        if (assignedToId && assignedToId !== req.user!.id) {
          res.status(403).json({ error: 'Forbidden: Agents cannot reassign leads.' });
          return;
        }
      }

      const dataToUpdate: any = {};
      if (fullName !== undefined) dataToUpdate.fullName = fullName;
      if (phone !== undefined) dataToUpdate.phone = phone.replace(/[\s\-\(\)]/g, '');
      if (email !== undefined) dataToUpdate.email = email;
      if (tags !== undefined) dataToUpdate.tags = tags;
      if (stage !== undefined && Object.values(LeadStage).includes(stage)) dataToUpdate.stage = stage;
      if (!isAgent && assignedToId !== undefined) dataToUpdate.assignedToId = assignedToId;

      const updated = await prisma.lead.update({
        where: { id: leadId },
        data: dataToUpdate,
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          _count: { select: { calls: true, notes: true } },
        },
      });

      res.status(200).json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update lead.' });
    }
  }

  static async getFollowups(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const userId = req.user!.id;
      const isAgent = req.user!.role === Role.AGENT;
      const { scope = 'mine' } = req.query;

      const whereClause: any = { orgId };
      if (isAgent || scope === 'mine') {
        whereClause.assignedToId = userId;
      }

      const leads = await prisma.lead.findMany({
        where: whereClause,
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          calls: {
            orderBy: { startedAt: 'desc' },
            take: 1,
            select: { id: true, status: true, startedAt: true, durationSec: true },
          },
          notes: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, content: true, createdAt: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      });

      const followups = leads.filter((l) => l.stage === LeadStage.CONTACTED || (l.tags && l.tags.includes('followup')));
      const todos = leads.filter((l) => l.stage === LeadStage.NEW || l.stage === LeadStage.PROPOSAL_SENT);

      res.status(200).json({
        total: leads.length,
        followups,
        todos,
        counts: {
          overdue: 0,
          today: followups.length,
          upcoming: todos.length,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch follow-ups.' });
    }
  }
}

