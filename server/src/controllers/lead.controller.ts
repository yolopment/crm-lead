import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { LeadDistributionService } from '../services/leadDistribution.service.js';
import { LeadStage } from '@prisma/client';

export class LeadController {
  static async listLeads(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { stage, assignedToId, search, page = '1', limit = '50' } = req.query;

      const whereClause: any = { orgId };

      if (stage && stage !== 'all') {
        whereClause.stage = stage as LeadStage;
      }

      if (assignedToId && assignedToId !== 'all') {
        whereClause.assignedToId = String(assignedToId);
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
      const { fullName, phone, email, source = 'manual', campaignName, adName, tags } = req.body;

      if (!phone) {
        res.status(400).json({ error: 'Phone number is required.' });
        return;
      }

      const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

      // Assign to next available agent who is NOT on leave
      const assignedToId = await LeadDistributionService.assignNextAvailableAgent(orgId);

      const lead = await prisma.lead.create({
        data: {
          orgId,
          phone: cleanPhone,
          fullName,
          email,
          source,
          campaignName,
          adName,
          tags,
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

  static async updateStage(req: Request, res: Response): Promise<void> {
    try {
      const { leadId } = req.params;
      const { stage } = req.body;
      const orgId = req.user!.orgId;

      if (!Object.values(LeadStage).includes(stage)) {
        res.status(400).json({ error: 'Invalid lead stage.' });
        return;
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
}

