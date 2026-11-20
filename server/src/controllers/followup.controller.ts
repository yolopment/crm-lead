import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';

export const listFollowups = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    const userId = req.user?.id;
    if (!orgId) return res.status(400).json({ error: 'Missing organization' });

    const {
      tab = 'call_followups',
      scope = 'me',
      status = 'open',
      timeFilter = 'all',
      search = '',
    } = req.query;

    const isTeam = scope === 'team';
    const isOpen = status !== 'completed';

    // Now & Today Date boundaries
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Week boundaries
    const dayOfWeek = now.getDay(); // 0 is Sunday
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday, 0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

    // Handle "needs_followup" tab dynamically
    if (tab === 'needs_followup') {
      // Find leads that need a follow-up:
      // 1. In this org
      // 2. Either assigned to user (if scope=me) or anyone (if scope=team)
      // 3. Have NO pending followups
      // 4. Either stageName in ('Fresh', 'Attempting Call', 'Interested') OR has been inactive
      const leads = await prisma.lead.findMany({
        where: {
          orgId,
          ...(isTeam ? {} : { assignedToId: userId }),
          stage: { not: 'LOST' },
          followUps: {
            none: {
              status: 'PENDING',
            },
          },
          ...(search
            ? {
                OR: [
                  { fullName: { contains: String(search), mode: 'insensitive' } },
                  { phone: { contains: String(search), mode: 'insensitive' } },
                  { company: { contains: String(search), mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          calls: {
            orderBy: { startedAt: 'desc' },
            take: 1,
          },
          followUps: {
            where: { status: 'COMPLETED' },
            orderBy: { completedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      });

      // Calculate general counts for top bar badges
      const pendingFollowUps = await prisma.followUp.findMany({
        where: {
          orgId,
          status: 'PENDING',
          ...(isTeam ? {} : { assignedToId: userId }),
        },
        select: { scheduledAt: true },
      });

      const completedCount = await prisma.followUp.count({
        where: {
          orgId,
          status: 'COMPLETED',
          ...(isTeam ? {} : { assignedToId: userId }),
        },
      });

      const overdueCount = pendingFollowUps.filter((f) => new Date(f.scheduledAt) < startOfToday).length;
      const todayCount = pendingFollowUps.filter(
        (f) => new Date(f.scheduledAt) >= startOfToday && new Date(f.scheduledAt) <= endOfToday
      ).length;
      const upcomingCount = pendingFollowUps.filter((f) => new Date(f.scheduledAt) > endOfToday).length;

      return res.json({
        items: leads.map((l) => ({
          id: `need-${l.id}`,
          isSuggestion: true,
          leadId: l.id,
          lead: {
            id: l.id,
            fullName: l.fullName,
            phone: l.phone,
            company: l.company,
            stage: l.stage,
            stageName: l.stageName,
          },
          title: `Needs follow-up: ${l.stageName || 'Fresh lead'}`,
          type: 'CALL',
          scheduledAt: null,
          note: l.calls[0]
            ? `Last call: ${l.calls[0].status} (${new Date(l.calls[0].startedAt).toLocaleDateString()})`
            : 'No calls made yet',
          status: 'PENDING',
          priority: 'NORMAL',
          assignedTo: l.assignedTo,
        })),
        counts: {
          overdue: overdueCount,
          today: todayCount,
          upcoming: upcomingCount,
          done: completedCount,
          needsFollowUp: leads.length,
        },
      });
    }

    // Normal FollowUps query
    const typeFilter = tab === 'todos' ? 'TODO' : tab === 'call_followups' ? 'CALL' : undefined;

    const whereClause: any = {
      orgId,
      status: isOpen ? 'PENDING' : 'COMPLETED',
      ...(isTeam ? {} : { assignedToId: userId }),
      ...(typeFilter ? { type: typeFilter } : {}),
    };

    // Apply time filter
    if (timeFilter === 'today') {
      whereClause.scheduledAt = {
        gte: startOfToday,
        lte: endOfToday,
      };
    } else if (timeFilter === 'overdue') {
      whereClause.scheduledAt = {
        lt: startOfToday,
      };
      if (isOpen) {
        whereClause.status = 'PENDING';
      }
    } else if (timeFilter === 'this_week') {
      whereClause.scheduledAt = {
        gte: startOfWeek,
        lte: endOfWeek,
      };
    }

    if (search) {
      whereClause.OR = [
        { title: { contains: String(search), mode: 'insensitive' } },
        { note: { contains: String(search), mode: 'insensitive' } },
        { lead: { fullName: { contains: String(search), mode: 'insensitive' } } },
        { lead: { phone: { contains: String(search), mode: 'insensitive' } } },
        { lead: { company: { contains: String(search), mode: 'insensitive' } } },
      ];
    }

    const [items, pendingAll, completedCount, needsFollowUpCount] = await Promise.all([
      prisma.followUp.findMany({
        where: whereClause,
        include: {
          lead: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              company: true,
              stage: true,
              stageName: true,
            },
          },
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: isOpen ? { scheduledAt: 'asc' } : { completedAt: 'desc' },
      }),
      prisma.followUp.findMany({
        where: {
          orgId,
          status: 'PENDING',
          ...(isTeam ? {} : { assignedToId: userId }),
        },
        select: { scheduledAt: true },
      }),
      prisma.followUp.count({
        where: {
          orgId,
          status: 'COMPLETED',
          ...(isTeam ? {} : { assignedToId: userId }),
        },
      }),
      prisma.lead.count({
        where: {
          orgId,
          ...(isTeam ? {} : { assignedToId: userId }),
          stage: { not: 'LOST' },
          followUps: { none: { status: 'PENDING' } },
        },
      }),
    ]);

    const overdueCount = pendingAll.filter((f) => new Date(f.scheduledAt) < startOfToday).length;
    const todayCount = pendingAll.filter(
      (f) => new Date(f.scheduledAt) >= startOfToday && new Date(f.scheduledAt) <= endOfToday
    ).length;
    const upcomingCount = pendingAll.filter((f) => new Date(f.scheduledAt) > endOfToday).length;

    return res.json({
      items,
      counts: {
        overdue: overdueCount,
        today: todayCount,
        upcoming: upcomingCount,
        done: completedCount,
        needsFollowUp: needsFollowUpCount,
      },
    });
  } catch (err: any) {
    console.error('listFollowups error:', err);
    return res.status(500).json({ error: 'Failed to list follow-ups', details: err?.message });
  }
};

export const createFollowup = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    const currentUserId = req.user?.id;
    if (!orgId) return res.status(400).json({ error: 'Missing organization' });

    const {
      leadId,
      type = 'CALL',
      title,
      note,
      scheduledAt,
      priority = 'NORMAL',
      assignedToId,
    } = req.body;

    if (!leadId) {
      return res.status(400).json({ error: 'Lead ID is required' });
    }
    if (!scheduledAt) {
      return res.status(400).json({ error: 'Scheduled date and time are required' });
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ error: 'Invalid scheduledAt date format' });
    }

    const followUp = await prisma.followUp.create({
      data: {
        orgId,
        leadId,
        assignedToId: assignedToId || currentUserId!,
        type: type.toUpperCase() as any,
        title: title || `${type === 'CALL' ? 'Call' : type === 'TODO' ? 'Task' : 'Follow-up'} for lead`,
        note: note || null,
        scheduledAt: scheduledDate,
        priority,
        status: 'PENDING',
      },
      include: {
        lead: {
          select: { id: true, fullName: true, phone: true, stage: true, stageName: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Also add a Note entry to log on the lead timeline
    const typeLabel = type === 'CALL' ? 'Call Follow-up' : type === 'TODO' ? 'To-Do Task' : 'Follow-up';
    await prisma.note.create({
      data: {
        leadId,
        authorId: currentUserId!,
        content: `Scheduled ${typeLabel}: "${followUp.title}" for ${scheduledDate.toLocaleString()}${
          note ? `\nNote: ${note}` : ''
        }`,
      },
    });

    return res.status(201).json(followUp);
  } catch (err: any) {
    console.error('createFollowup error:', err);
    return res.status(500).json({ error: 'Failed to create follow-up', details: err?.message });
  }
};

export const completeFollowup = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    const currentUserId = req.user?.id;
    const { id } = req.params;

    if (!orgId) return res.status(400).json({ error: 'Missing organization' });

    const followUp = await prisma.followUp.findFirst({
      where: { id, orgId },
      include: { lead: true },
    });

    if (!followUp) {
      return res.status(404).json({ error: 'Follow-up not found' });
    }

    const updated = await prisma.followUp.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Log completion on lead timeline
    if (followUp.leadId) {
      await prisma.note.create({
        data: {
          leadId: followUp.leadId,
          authorId: currentUserId!,
          content: `Completed ${followUp.type}: "${followUp.title}"`,
        },
      });
    }

    return res.json(updated);
  } catch (err: any) {
    console.error('completeFollowup error:', err);
    return res.status(500).json({ error: 'Failed to complete follow-up', details: err?.message });
  }
};

export const rescheduleFollowup = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    const currentUserId = req.user?.id;
    const { id } = req.params;
    const { scheduledAt, note } = req.body;

    if (!orgId) return res.status(400).json({ error: 'Missing organization' });
    if (!scheduledAt) return res.status(400).json({ error: 'New scheduled date is required' });

    const newDate = new Date(scheduledAt);
    if (isNaN(newDate.getTime())) {
      return res.status(400).json({ error: 'Invalid scheduledAt date format' });
    }

    const followUp = await prisma.followUp.findFirst({
      where: { id, orgId },
    });

    if (!followUp) {
      return res.status(404).json({ error: 'Follow-up not found' });
    }

    const updated = await prisma.followUp.update({
      where: { id },
      data: {
        scheduledAt: newDate,
        status: 'PENDING',
        completedAt: null,
        ...(note !== undefined ? { note } : {}),
      },
    });

    // Log reschedule
    if (followUp.leadId) {
      await prisma.note.create({
        data: {
          leadId: followUp.leadId,
          authorId: currentUserId!,
          content: `Rescheduled ${followUp.type}: "${followUp.title}" to ${newDate.toLocaleString()}${
            note ? `\nNote: ${note}` : ''
          }`,
        },
      });
    }

    return res.json(updated);
  } catch (err: any) {
    console.error('rescheduleFollowup error:', err);
    return res.status(500).json({ error: 'Failed to reschedule follow-up', details: err?.message });
  }
};

export const deleteFollowup = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    const { id } = req.params;

    if (!orgId) return res.status(400).json({ error: 'Missing organization' });

    await prisma.followUp.deleteMany({
      where: { id, orgId },
    });

    return res.json({ success: true, message: 'Follow-up deleted' });
  } catch (err: any) {
    console.error('deleteFollowup error:', err);
    return res.status(500).json({ error: 'Failed to delete follow-up', details: err?.message });
  }
};
