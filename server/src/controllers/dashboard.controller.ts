import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { Role } from '@prisma/client';

export class DashboardController {
  static async getStats(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const isAgent = req.user!.role === Role.AGENT;
      const userId = req.user!.id;

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Scoping conditions based on user role
      const leadBaseWhere = isAgent ? { orgId, assignedToId: userId } : { orgId };
      const callBaseWhere = isAgent ? { orgId, userId } : { orgId };
      const followupBaseWhere = isAgent ? { orgId, assignedToId: userId } : { orgId };

      // Parallel aggregation queries
      const [
        totalLeads,
        leadsThisWeek,
        leadsToday,
        totalCalls,
        connectedCalls,
        callsToday,
        followupsToday,
        overdueFollowups,
        totalForms,
        leadsByStage,
        leadsBySource,
        recentLeads,
        recentCalls,
        teamMembers,
        pairedDevices,
      ] = await Promise.all([
        prisma.lead.count({ where: leadBaseWhere }),
        prisma.lead.count({ where: { ...leadBaseWhere, createdAt: { gte: sevenDaysAgo } } }),
        prisma.lead.count({ where: { ...leadBaseWhere, createdAt: { gte: startOfToday } } }),
        prisma.call.count({ where: callBaseWhere }),
        prisma.call.count({ where: { ...callBaseWhere, status: 'CONNECTED' } }),
        prisma.call.count({ where: { ...callBaseWhere, createdAt: { gte: startOfToday } } }),
        prisma.followUp.count({
          where: {
            ...followupBaseWhere,
            status: 'PENDING',
            scheduledAt: { gte: startOfToday, lt: new Date(startOfToday.getTime() + 86400000) },
          },
        }),
        prisma.followUp.count({
          where: {
            ...followupBaseWhere,
            status: 'PENDING',
            scheduledAt: { lt: startOfToday },
          },
        }),
        isAgent ? Promise.resolve(0) : prisma.form.count({ where: { orgId } }),
        prisma.lead.groupBy({
          by: ['stage'],
          where: leadBaseWhere,
          _count: { id: true },
        }),
        prisma.lead.groupBy({
          by: ['source'],
          where: leadBaseWhere,
          _count: { id: true },
        }),
        prisma.lead.findMany({
          where: leadBaseWhere,
          orderBy: { createdAt: 'desc' },
          take: 6,
          select: {
            id: true,
            fullName: true,
            phone: true,
            source: true,
            stageName: true,
            createdAt: true,
            assignedTo: { select: { name: true } },
          },
        }),
        prisma.call.findMany({
          where: callBaseWhere,
          orderBy: { createdAt: 'desc' },
          take: 6,
          include: {
            lead: { select: { fullName: true, phone: true } },
            user: { select: { name: true } },
          },
        }),
        isAgent
          ? Promise.resolve([])
          : prisma.user.findMany({
              where: { orgId },
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isOnLeave: true,
                deviceToken: true,
                _count: {
                  select: { calls: true, assignedLeads: true },
                },
              },
            }),
        prisma.device.findMany({
          where: isAgent ? { orgId, userId } : { orgId },
          take: 5,
          orderBy: { lastSyncAt: 'desc' },
        }),
      ]);

      const connectRate = totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 100;

      res.status(200).json({
        stats: {
          totalLeads,
          leadsThisWeek,
          leadsToday,
          totalCalls,
          connectedCalls,
          callsToday,
          connectRate,
          followupsToday,
          overdueFollowups,
          totalForms,
        },
        stageBreakdown: (leadsByStage as any[]).map((s) => ({ stage: s.stage, count: s._count.id })),
        sourceBreakdown: (leadsBySource as any[]).map((s) => ({ source: s.source || 'other', count: s._count.id })),
        recentLeads,
        recentCalls,
        teamPerformance: teamMembers,
        pairedDevices,
      });
    } catch (error: any) {
      console.error('[Dashboard Stats Error]:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch dashboard stats' });
    }
  }
}
