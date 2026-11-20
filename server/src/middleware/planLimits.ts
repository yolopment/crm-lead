import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma.js';
import { OrgStatus } from '@prisma/client';

/**
 * Ensures the organization's account is currently active or in a valid trial
 */
export async function requireActiveOrg(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        orgStatus: true,
        trialEndsAt: true,
      },
    });

    if (!org) {
      res.status(404).json({ error: 'Organization not found.' });
      return;
    }

    if (org.orgStatus === OrgStatus.SUSPENDED) {
      res.status(403).json({
        error: 'Your workspace has been suspended. Please contact platform administration to reactivate your account.',
        code: 'ORG_SUSPENDED',
      });
      return;
    }

    if (org.orgStatus === OrgStatus.CANCELLED || org.orgStatus === OrgStatus.DELETED) {
      res.status(403).json({
        error: 'Your workspace subscription has been cancelled.',
        code: 'ORG_CANCELLED',
      });
      return;
    }

    // Check trial expiration
    if (org.orgStatus === OrgStatus.TRIAL && org.trialEndsAt && new Date() > new Date(org.trialEndsAt)) {
      res.status(403).json({
        error: 'Your 14-day free trial has expired. Please upgrade your plan to restore full access to your CRM.',
        code: 'TRIAL_EXPIRED',
      });
      return;
    }

    next();
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error validating organization status.' });
  }
}

/**
 * Checks if the organization has reached its maximum permitted team members
 */
export async function checkUserLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        maxUsers: true,
        _count: {
          select: { users: true },
        },
      },
    });

    if (!org) {
      res.status(404).json({ error: 'Organization not found.' });
      return;
    }

    if (org._count.users >= org.maxUsers) {
      res.status(403).json({
        error: `You have reached the maximum user limit (${org.maxUsers} users) for your current plan. Please upgrade your plan to add more team members.`,
        code: 'USER_LIMIT_REACHED',
        limit: org.maxUsers,
        current: org._count.users,
      });
      return;
    }

    next();
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error checking user limits.' });
  }
}

/**
 * Checks if the organization has reached its maximum permitted leads
 */
export async function checkLeadLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        maxLeads: true,
        _count: {
          select: { leads: true },
        },
      },
    });

    if (!org) {
      res.status(404).json({ error: 'Organization not found.' });
      return;
    }

    if (org._count.leads >= org.maxLeads) {
      res.status(403).json({
        error: `You have reached your lead storage limit (${org.maxLeads} leads) for your current plan. Please upgrade your plan to create or import more leads.`,
        code: 'LEAD_LIMIT_REACHED',
        limit: org.maxLeads,
        current: org._count.leads,
      });
      return;
    }

    next();
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error checking lead limits.' });
  }
}
