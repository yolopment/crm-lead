import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { OrgStatus, PlanTier, Role } from '@prisma/client';
import { runDailyStorageSnapshot } from '../services/storage.service.js';

// Ensure BigInt values serialize properly in JSON responses
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

import {
  getMasterDriveStatus,
  disconnectMasterDrive,
  getOAuth2Client,
  isOAuthAppConfigured,
} from '../services/gdrive-oauth.service.js';
import { generateOAuthUrl } from '../services/gdrive-oauth.service.js';

export class SuperAdminController {
  // ==========================================
  // AUTH
  // ==========================================

  /**
   * SaaS Super Admin Login
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required.' });
        return;
      }

      const admin = await prisma.saasAdmin.findFirst({
        where: {
          email: {
            equals: email.trim(),
          },
        },
      });

      if (!admin) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }

      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }

      // Update lastLoginAt timestamp
      await prisma.saasAdmin.update({
        where: { id: admin.id },
        data: { lastLoginAt: new Date() },
      });

      const token = jwt.sign(
        { saasAdminId: admin.id, saasRole: admin.saasRole },
        config.jwtSecret,
        { expiresIn: (config.jwtExpiresIn as any) || '7d' }
      );

      res.status(200).json({
        message: 'Logged in successfully.',
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          saasRole: admin.saasRole,
          lastLoginAt: new Date(),
        },
      });
    } catch (error: any) {
      console.error('[SuperAdmin Login Error]:', error);
      res.status(500).json({ error: 'Internal server error during login.' });
    }
  }

  // ==========================================
  // DASHBOARD
  // ==========================================

  /**
   * Get overall SaaS dashboard statistics & financial KPIs
   */
  static async getDashboardStats(req: Request, res: Response): Promise<void> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      const [
        totalOrgs,
        activeOrgs,
        trialOrgs,
        suspendedOrgs,
        totalUsers,
        totalCalls,
        totalLeads,
        storageAggregate,
        revenueAggregate,
        newOrgsThisMonth,
        activeSubscriptions,
        trialsExpiringCount,
        allOrgsQuotaCheck,
      ] = await Promise.all([
        prisma.organization.count(),
        prisma.organization.count({ where: { orgStatus: OrgStatus.ACTIVE } }),
        prisma.organization.count({ where: { orgStatus: OrgStatus.TRIAL } }),
        prisma.organization.count({ where: { orgStatus: OrgStatus.SUSPENDED } }),
        prisma.user.count(),
        prisma.call.count(),
        prisma.lead.count(),
        prisma.organization.aggregate({
          _sum: { storageUsedBytes: true },
        }),
        prisma.invoice.aggregate({
          where: {
            status: 'PAID',
            OR: [
              { paidAt: { gte: startOfMonth } },
              { paidAt: null, createdAt: { gte: startOfMonth } },
            ],
          },
          _sum: { amount: true },
        }),
        prisma.organization.count({
          where: { createdAt: { gte: startOfMonth } },
        }),
        prisma.subscription.findMany({
          where: { status: 'ACTIVE' },
          include: { plan: true },
        }),
        prisma.organization.count({
          where: {
            orgStatus: OrgStatus.TRIAL,
            trialEndsAt: { lte: threeDaysLater, gte: now },
          },
        }),
        prisma.organization.findMany({
          select: { storageUsedBytes: true, storageQuotaBytes: true },
        }),
      ]);

      const monthlyRevenue = Math.round(Number(revenueAggregate._sum.amount || 0) / 100);
      const mrr = activeSubscriptions.reduce(
        (sum, sub) => sum + Math.round((sub.plan.priceMonthly || 0) / 100),
        0
      );
      const arr = mrr * 12;
      const payingOrgs = activeSubscriptions.length;
      const arpu = payingOrgs > 0 ? Math.round(mrr / payingOrgs) : 0;
      const quotaAlertsCount = allOrgsQuotaCheck.filter(
        (o) => Number(o.storageUsedBytes) >= Number(o.storageQuotaBytes) * 0.85
      ).length;

      res.status(200).json({
        totalOrgs,
        activeOrgs,
        trialOrgs,
        suspendedOrgs,
        payingOrgs,
        totalUsers,
        totalCalls,
        totalLeads,
        totalStorageUsedBytes: Number(storageAggregate._sum.storageUsedBytes || 0n),
        monthlyRevenue,
        mrr,
        arr,
        arpu,
        newOrgsThisMonth,
        systemAlerts: {
          trialsExpiringCount,
          quotaAlertsCount,
          suspendedOrgsCount: suspendedOrgs,
        },
      });
    } catch (error: any) {
      console.error('[SuperAdmin Stats Error]:', error);
      res.status(500).json({ error: error.message || 'Failed to retrieve dashboard stats.' });
    }
  }

  // ==========================================
  // ORGANIZATIONS
  // ==========================================

  /**
   * Super Admin: Onboard / Create a new Client Organization
   */
  static async createOrganization(req: Request, res: Response): Promise<void> {
    try {
      const {
        name,
        slug: requestedSlug,
        phone,
        website,
        adminName,
        adminEmail,
        adminPassword = 'Admin@123',
        // Default training evaluation trial: 7 days, 500 MB storage, 2 users, unlimited leads
        maxUsers = 2,
        maxLeads = 1000000000,
        storageQuotaMB = 500,
        storageQuotaGB,
        customPriceMonthly,   // in paise, optional
        customPriceYearly,    // in paise, optional
        billingNotes,
      } = req.body;

      if (!name || !adminName || !adminEmail) {
        res.status(400).json({ error: 'Company name, admin name, and admin email are required.' });
        return;
      }

      // Check if user email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: adminEmail.trim().toLowerCase() },
      });
      if (existingUser) {
        res.status(409).json({ error: `A user account with email '${adminEmail}' already exists.` });
        return;
      }

      // Format slug
      let cleanSlug = (requestedSlug || name)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      if (!cleanSlug) cleanSlug = 'org';

      const existingSlug = await prisma.organization.findUnique({ where: { slug: cleanSlug } });
      if (existingSlug) {
        cleanSlug = `${cleanSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
      }

      // Always start with 7-day training trial — pricing is negotiated post-trial
      const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const quotaBytes =
        storageQuotaMB !== undefined
          ? BigInt(Math.max(50, Number(storageQuotaMB))) * BigInt(1024 * 1024)
          : storageQuotaGB !== undefined
            ? BigInt(Math.max(1, Number(storageQuotaGB))) * BigInt(1024 * 1024 * 1024)
            : BigInt(524288000); // 500 MB default

      const hashedPassword = await bcrypt.hash(adminPassword, 10);

      const result = await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: {
            name: name.trim(),
            slug: cleanSlug,
            phone: phone?.trim() || null,
            website: website?.trim() || null,
            orgStatus: OrgStatus.TRIAL,
            planTier: PlanTier.STARTER, // kept for compatibility, not user-facing
            trialEndsAt,
            maxUsers: Number(maxUsers) || 2,
            maxLeads: Number(maxLeads) || 1000000000,
            storageQuotaBytes: quotaBytes,
            storageUsedBytes: BigInt(0),
            orgStorageDriver: 'local',
            customPriceMonthly: customPriceMonthly ? Number(customPriceMonthly) : null,
            customPriceYearly: customPriceYearly ? Number(customPriceYearly) : null,
            billingNotes: billingNotes?.trim() || null,
          },
        });

        const adminUser = await tx.user.create({
          data: {
            orgId: org.id,
            name: adminName.trim(),
            email: adminEmail.trim().toLowerCase(),
            password: hashedPassword,
            phone: phone?.trim() || null,
            role: Role.ADMIN,
          },
        });

        return { org, adminUser };
      });

      const trialDaysRemaining = Math.max(
        0,
        Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      );

      res.status(201).json({
        message: 'Client organization onboarded successfully on 7-day trial.',
        organization: {
          id: result.org.id,
          name: result.org.name,
          slug: result.org.slug,
          orgStatus: result.org.orgStatus,
          trialEndsAt: result.org.trialEndsAt,
          trialDaysRemaining,
          storageQuotaBytes: Number(result.org.storageQuotaBytes),
          maxUsers: result.org.maxUsers,
          maxLeads: result.org.maxLeads,
          customPriceMonthly: result.org.customPriceMonthly,
          customPriceYearly: result.org.customPriceYearly,
        },
        adminUser: {
          id: result.adminUser.id,
          name: result.adminUser.name,
          email: result.adminUser.email,
          role: result.adminUser.role,
        },
      });
    } catch (err: any) {
      console.error('[SuperAdmin createOrganization Error]:', err);
      res.status(500).json({ error: err.message || 'Failed to create organization.' });
    }
  }

  /**
   * List organizations with pagination, search, and filters
   */
  static async listOrganizations(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
      const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || '10', 10)));
      const skip = (page - 1) * limit;

      const search = (req.query.search as string || '').trim();
      const orgStatus = req.query.orgStatus as string;
      const planTier = req.query.planTier as string;

      const where: any = {};

      if (search) {
        where.OR = [
          { name: { contains: search } },
          { slug: { contains: search } },
        ];
      }

      if (orgStatus && Object.values(OrgStatus).includes(orgStatus as OrgStatus)) {
        where.orgStatus = orgStatus as OrgStatus;
      }

      if (planTier && Object.values(PlanTier).includes(planTier as PlanTier)) {
        where.planTier = planTier as PlanTier;
      }

      const [total, organizations] = await Promise.all([
        prisma.organization.count({ where }),
        prisma.organization.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: {
                users: true,
                leads: true,
                calls: true,
              },
            },
            subscription: {
              include: {
                plan: true,
              },
            },
          },
        }),
      ]);

      res.status(200).json({
        organizations,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      console.error('[SuperAdmin List Orgs Error]:', error);
      res.status(500).json({ error: error.message || 'Failed to list organizations.' });
    }
  }

  /**
   * Get detailed information for a single organization
   */
  static async getOrganizationDetail(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const organization = await prisma.organization.findUnique({
        where: { id },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true,
              isOnLeave: true,
              createdAt: true,
            },
          },
          subscription: {
            include: {
              plan: true,
            },
          },
          invoices: {
            take: 20,
            orderBy: { createdAt: 'desc' },
          },
          storageUsageLogs: {
            take: 20,
            orderBy: { recordedAt: 'desc' },
          },
          _count: {
            select: {
              users: true,
              leads: true,
              calls: true,
              devices: true,
              smsMessages: true,
              forms: true,
            },
          },
        },
      });

      if (!organization) {
        res.status(404).json({ error: 'Organization not found.' });
        return;
      }

      res.status(200).json({ organization });
    } catch (error: any) {
      console.error('[SuperAdmin Get Org Error]:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch organization details.' });
    }
  }

  /**
   * Suspend an organization
   */
  static async suspendOrganization(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const organization = await prisma.organization.update({
        where: { id },
        data: { orgStatus: OrgStatus.SUSPENDED },
      });

      res.status(200).json({
        message: 'Organization suspended successfully.',
        organization,
      });
    } catch (error: any) {
      console.error('[SuperAdmin Suspend Org Error]:', error);
      res.status(500).json({ error: error.message || 'Failed to suspend organization.' });
    }
  }

  /**
   * Reactivate a suspended or trial organization
   */
  static async reactivateOrganization(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const organization = await prisma.organization.update({
        where: { id },
        data: { orgStatus: OrgStatus.ACTIVE },
      });

      res.status(200).json({
        message: 'Organization reactivated successfully.',
        organization,
      });
    } catch (error: any) {
      console.error('[SuperAdmin Reactivate Org Error]:', error);
      res.status(500).json({ error: error.message || 'Failed to reactivate organization.' });
    }
  }

  /**
   * Activate billing for an organization after trial — set custom negotiated pricing
   * PATCH /api/v1/superadmin/organizations/:id/billing
   */
  static async activateBilling(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        customPriceMonthly,  // in paise (₹1 = 100 paise)
        customPriceYearly,   // in paise
        billingCycle,        // "monthly" | "yearly"
        maxUsers,
        maxLeads,
        storageQuotaMB,
        storageQuotaGB,
        billingNotes,
        activateNow = true,  // if true, change orgStatus from TRIAL → ACTIVE
      } = req.body;

      const org = await prisma.organization.findUnique({ where: { id } });
      if (!org) {
        res.status(404).json({ error: 'Organization not found.' });
        return;
      }

      const updateData: any = {};
      if (customPriceMonthly !== undefined) updateData.customPriceMonthly = Number(customPriceMonthly);
      if (customPriceYearly !== undefined) updateData.customPriceYearly = Number(customPriceYearly);
      if (billingCycle) updateData.billingCycle = billingCycle;
      if (maxUsers !== undefined) updateData.maxUsers = Number(maxUsers);
      if (maxLeads !== undefined) updateData.maxLeads = Number(maxLeads);
      if (storageQuotaMB !== undefined) {
        updateData.storageQuotaBytes = BigInt(Math.max(50, Number(storageQuotaMB))) * BigInt(1024 * 1024);
      } else if (storageQuotaGB !== undefined) {
        updateData.storageQuotaBytes = BigInt(Math.max(1, Number(storageQuotaGB))) * BigInt(1024 * 1024 * 1024);
      }
      if (billingNotes !== undefined) updateData.billingNotes = billingNotes;
      if (activateNow) {
        updateData.orgStatus = OrgStatus.ACTIVE;
        updateData.activatedAt = new Date();
        updateData.trialEndsAt = null; // clear trial
      }

      const updated = await prisma.organization.update({
        where: { id },
        data: updateData,
      });

      res.status(200).json({
        message: activateNow
          ? `${updated.name} subscription activated with custom pricing.`
          : `Billing details updated for ${updated.name}.`,
        organization: {
          id: updated.id,
          name: updated.name,
          orgStatus: updated.orgStatus,
          customPriceMonthly: updated.customPriceMonthly,
          customPriceYearly: updated.customPriceYearly,
          billingCycle: updated.billingCycle,
          maxUsers: updated.maxUsers,
          maxLeads: updated.maxLeads,
          storageQuotaBytes: Number(updated.storageQuotaBytes),
          activatedAt: updated.activatedAt,
          billingNotes: updated.billingNotes,
        },
      });
    } catch (err: any) {
      console.error('[SuperAdmin activateBilling Error]:', err);
      res.status(500).json({ error: err.message || 'Failed to update billing.' });
    }
  }

  /**
   * Extend the trial period of an organization
   */
  static async extendTrial(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { days, newTrialEndsAt } = req.body;

      const org = await prisma.organization.findUnique({ where: { id } });
      if (!org) {
        res.status(404).json({ error: 'Organization not found.' });
        return;
      }

      let targetDate: Date;
      if (newTrialEndsAt) {
        targetDate = new Date(newTrialEndsAt);
      } else {
        const daysToAdd = parseInt(days || '14', 10);
        const baseDate = org.trialEndsAt && org.trialEndsAt > new Date() ? org.trialEndsAt : new Date();
        targetDate = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
      }

      const updatedOrg = await prisma.organization.update({
        where: { id },
        data: {
          trialEndsAt: targetDate,
          orgStatus: org.orgStatus === OrgStatus.SUSPENDED ? OrgStatus.TRIAL : org.orgStatus,
        },
      });

      await prisma.subscription.updateMany({
        where: { orgId: id },
        data: { trialEnd: targetDate },
      });

      res.status(200).json({
        message: 'Trial extended successfully.',
        organization: updatedOrg,
      });
    } catch (error: any) {
      console.error('[SuperAdmin Extend Trial Error]:', error);
      res.status(500).json({ error: error.message || 'Failed to extend trial.' });
    }
  }

  /**
   * Soft delete an organization (orgStatus = DELETED)
   */
  static async deleteOrganization(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const organization = await prisma.organization.update({
        where: { id },
        data: { orgStatus: OrgStatus.DELETED },
      });

      res.status(200).json({
        message: 'Organization deleted successfully (soft delete).',
        organization,
      });
    } catch (error: any) {
      console.error('[SuperAdmin Delete Org Error]:', error);
      res.status(500).json({ error: error.message || 'Failed to delete organization.' });
    }
  }

  /**
   * Super Admin: Completely purge all tenant organizations, users, calls, leads, etc.
   * Keeps ONLY Super Admin login for fresh system entry.
   */
  static async purgeAllData(req: Request, res: Response): Promise<void> {
    try {
      const { purgeAllTenantData } = await import('../services/db-init.service.js');
      const result = await purgeAllTenantData();
      res.status(200).json({
        message: 'All tenant data has been completely cleared. Ready for fresh entry.',
        result,
      });
    } catch (error: any) {
      console.error('[SuperAdmin Purge All Data Error]:', error);
      res.status(500).json({ error: error.message || 'Failed to purge data.' });
    }
  }

  /**
   * Super Admin: Manually update an organization's plan tier and limits
   */
  static async updateOrgPlan(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        planTier,
        maxUsers,
        maxLeads,
        storageQuotaGB,
        orgStatus,
        billingCycle = 'monthly',
      } = req.body;

      const org = await prisma.organization.findUnique({ where: { id } });
      if (!org) {
        res.status(404).json({ error: 'Organization not found.' });
        return;
      }

      // Look up target plan
      const targetPlan = await prisma.plan.findFirst({
        where: { tier: (planTier.toUpperCase() as PlanTier) || PlanTier.STARTER },
      });

      if (!targetPlan) {
        res.status(400).json({ error: `Plan tier '${planTier}' not found.` });
        return;
      }

      const newMaxUsers = maxUsers !== undefined ? parseInt(maxUsers, 10) : targetPlan.maxUsers;
      const newMaxLeads = maxLeads !== undefined ? parseInt(maxLeads, 10) : targetPlan.maxLeads;
      const newQuotaBytes =
        storageQuotaGB !== undefined
          ? BigInt(Math.max(1, parseInt(storageQuotaGB, 10))) * BigInt(1024 * 1024 * 1024)
          : targetPlan.storageQuotaBytes;

      const now = new Date();
      const durationDays = billingCycle === 'yearly' ? 365 : 30;
      const periodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

      // Update organization in transaction
      const result = await prisma.$transaction(async (tx) => {
        const updatedOrg = await tx.organization.update({
          where: { id },
          data: {
            planTier: targetPlan.tier,
            maxUsers: newMaxUsers,
            maxLeads: newMaxLeads,
            storageQuotaBytes: newQuotaBytes,
            orgStatus:
              orgStatus && Object.values(OrgStatus).includes(orgStatus as OrgStatus)
                ? (orgStatus as OrgStatus)
                : OrgStatus.ACTIVE,
            trialEndsAt: orgStatus === 'TRIAL' ? periodEnd : null,
          },
        });

        // Upsert subscription
        const sub = await tx.subscription.upsert({
          where: { orgId: id },
          create: {
            orgId: id,
            planId: targetPlan.id,
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            trialEnd: orgStatus === 'TRIAL' ? periodEnd : null,
          },
          update: {
            planId: targetPlan.id,
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            trialEnd: orgStatus === 'TRIAL' ? periodEnd : null,
            cancelledAt: null,
            cancelReason: null,
          },
        });

        return { updatedOrg, sub };
      });

      res.status(200).json({
        message: `Organization successfully switched to ${targetPlan.displayName}.`,
        organization: {
          id: result.updatedOrg.id,
          name: result.updatedOrg.name,
          planTier: result.updatedOrg.planTier,
          orgStatus: result.updatedOrg.orgStatus,
          maxUsers: result.updatedOrg.maxUsers,
          maxLeads: result.updatedOrg.maxLeads,
          storageQuotaBytes: Number(result.updatedOrg.storageQuotaBytes),
        },
        subscription: result.sub,
      });
    } catch (error: any) {
      console.error('[SuperAdmin updateOrgPlan Error]:', error);
      res.status(500).json({ error: error.message || 'Failed to update organization plan.' });
    }
  }

  /**
   * Super Admin: Impersonate organization primary admin for technical support
   */
  static async impersonateOrganization(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const org = await prisma.organization.findUnique({
        where: { id },
        include: {
          users: {
            where: { role: Role.ADMIN },
            orderBy: { createdAt: 'asc' },
            take: 1,
          },
        },
      });

      if (!org) {
        res.status(404).json({ error: 'Organization not found.' });
        return;
      }

      if (!org.users || org.users.length === 0) {
        res.status(404).json({ error: 'No administrator user found for this organization.' });
        return;
      }

      const adminUser = org.users[0];

      // Sign scoped JWT with impersonation metadata (2 hours validity)
      const token = jwt.sign(
        {
          userId: adminUser.id,
          orgId: org.id,
          isImpersonated: true,
          impersonatedBy: (req as any).saasAdmin?.id || 'superadmin',
        },
        config.jwtSecret,
        { expiresIn: '2h' }
      );

      res.status(200).json({
        message: `Impersonation session created for ${adminUser.name} (${org.name}).`,
        token,
        user: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role,
        },
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
        },
        redirectUrl: '/dashboard/admin',
      });
    } catch (error: any) {
      console.error('[SuperAdmin Impersonate Error]:', error);
      res.status(500).json({ error: error.message || 'Failed to impersonate organization.' });
    }
  }

  // ==========================================
  // PLANS
  // ==========================================

  /**
   * List all plans
   */
  static async listPlans(req: Request, res: Response): Promise<void> {
    try {
      const plans = await prisma.plan.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
          _count: {
            select: { subscriptions: true },
          },
        },
      });

      res.status(200).json({ plans });
    } catch (error: any) {
      console.error('[SuperAdmin List Plans Error]:', error);
      res.status(500).json({ error: error.message || 'Failed to list plans.' });
    }
  }

  /**
   * Update plan settings and limits
   */
  static async updatePlan(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        displayName,
        description,
        priceMonthly,
        priceYearly,
        currency,
        maxUsers,
        maxLeads,
        storageQuotaBytes,
        maxCallsPerMonth,
        features,
        isActive,
        sortOrder,
      } = req.body;

      const data: any = {};
      if (displayName !== undefined) data.displayName = displayName;
      if (description !== undefined) data.description = description;
      if (priceMonthly !== undefined) data.priceMonthly = parseInt(priceMonthly, 10);
      if (priceYearly !== undefined) data.priceYearly = parseInt(priceYearly, 10);
      if (currency !== undefined) data.currency = currency;
      if (maxUsers !== undefined) data.maxUsers = parseInt(maxUsers, 10);
      if (maxLeads !== undefined) data.maxLeads = parseInt(maxLeads, 10);
      if (storageQuotaBytes !== undefined) data.storageQuotaBytes = BigInt(storageQuotaBytes);
      if (maxCallsPerMonth !== undefined) data.maxCallsPerMonth = parseInt(maxCallsPerMonth, 10);
      if (features !== undefined) data.features = typeof features === 'string' ? features : JSON.stringify(features);
      if (isActive !== undefined) data.isActive = Boolean(isActive);
      if (sortOrder !== undefined) data.sortOrder = parseInt(sortOrder, 10);

      const plan = await prisma.plan.update({
        where: { id },
        data,
      });

      res.status(200).json({
        message: 'Plan updated successfully.',
        plan,
      });
    } catch (error: any) {
      console.error('[SuperAdmin Update Plan Error]:', error);
      res.status(500).json({ error: error.message || 'Failed to update plan.' });
    }
  }

  // ==========================================
  // INVOICES
  // ==========================================

  /**
   * List invoices with pagination and filters
   */
  static async listInvoices(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
      const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || '20', 10)));
      const skip = (page - 1) * limit;

      const where: any = {};
      if (req.query.status) where.status = req.query.status as string;
      if (req.query.orgId) where.orgId = req.query.orgId as string;

      const [total, invoices] = await Promise.all([
        prisma.invoice.count({ where }),
        prisma.invoice.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        }),
      ]);

      res.status(200).json({
        invoices,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      console.error('[SuperAdmin List Invoices Error]:', error);
      res.status(500).json({ error: error.message || 'Failed to list invoices.' });
    }
  }

  /**
   * Super Admin: Record an offline / manual B2B payment and invoice
   */
  static async createManualInvoice(req: Request, res: Response): Promise<void> {
    try {
      const {
        orgId,
        amountINR,
        paymentMethod = 'BANK_TRANSFER',
        referenceId,
        description,
        applyPlanUpgrade = false,
        targetPlanTier,
        billingCycle = 'monthly',
      } = req.body;

      if (!orgId || amountINR === undefined) {
        res.status(400).json({ error: 'Organization ID and amount in INR are required.' });
        return;
      }

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        include: { subscription: true },
      });

      if (!org) {
        res.status(404).json({ error: 'Organization not found.' });
        return;
      }

      const now = new Date();
      const currentYear = now.getFullYear();
      const invoiceCount = await prisma.invoice.count();
      const invoiceNumber = `INV-${currentYear}-${String(invoiceCount + 1).padStart(4, '0')}`;
      const amountPaise = Math.round(Number(amountINR) * 100);

      let targetPlan: any = null;
      if (applyPlanUpgrade && targetPlanTier) {
        targetPlan = await prisma.plan.findFirst({
          where: { tier: (targetPlanTier.toUpperCase() as PlanTier) || PlanTier.STARTER },
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        let subscriptionId = org.subscription?.id;

        // If plan upgrade is requested
        if (applyPlanUpgrade && targetPlan) {
          const durationDays = billingCycle === 'yearly' ? 365 : 30;
          const periodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

          const sub = await tx.subscription.upsert({
            where: { orgId: org.id },
            create: {
              orgId: org.id,
              planId: targetPlan.id,
              status: 'ACTIVE',
              gatewaySubscriptionId: referenceId || `MANUAL-${Date.now()}`,
              gatewayCustomerId: `SUPERADMIN-${Date.now()}`,
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd,
            },
            update: {
              planId: targetPlan.id,
              status: 'ACTIVE',
              gatewaySubscriptionId: referenceId || `MANUAL-${Date.now()}`,
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd,
              cancelledAt: null,
            },
          });
          subscriptionId = sub.id;

          await tx.organization.update({
            where: { id: org.id },
            data: {
              planTier: targetPlan.tier,
              orgStatus: OrgStatus.ACTIVE,
              maxUsers: targetPlan.maxUsers,
              maxLeads: targetPlan.maxLeads,
              storageQuotaBytes: targetPlan.storageQuotaBytes,
              trialEndsAt: null,
            },
          });
        }

        const invoice = await tx.invoice.create({
          data: {
            orgId: org.id,
            subscriptionId: subscriptionId || null,
            invoiceNumber,
            amount: amountPaise,
            currency: 'INR',
            status: 'PAID',
            description: description || `Manual Payment (${paymentMethod}): ${org.name}`,
            gatewayPaymentId: referenceId || `OFFLINE-${Date.now()}`,
            paidAt: now,
            dueDate: now,
          },
        });

        return invoice;
      });

      res.status(201).json({
        message: `Invoice ${result.invoiceNumber} recorded successfully.`,
        invoice: result,
      });
    } catch (error: any) {
      console.error('[SuperAdmin createManualInvoice Error]:', error);
      res.status(500).json({ error: error.message || 'Failed to create manual invoice.' });
    }
  }

  // ==========================================
  // STORAGE
  // ==========================================

  /**
   * Overview of storage consumption across organizations
   */
  static async getStorageOverview(req: Request, res: Response): Promise<void> {
    try {
      const [aggregates, topOrganizations] = await Promise.all([
        prisma.organization.aggregate({
          _sum: {
            storageUsedBytes: true,
            storageQuotaBytes: true,
          },
          _count: {
            id: true,
          },
        }),
        prisma.organization.findMany({
          take: 10,
          orderBy: { storageUsedBytes: 'desc' },
          select: {
            id: true,
            name: true,
            slug: true,
            orgStatus: true,
            planTier: true,
            storageUsedBytes: true,
            storageQuotaBytes: true,
            orgStorageDriver: true,
            gdriveEmail: true,
            _count: {
              select: {
                calls: true,
              },
            },
          },
        }),
      ]);

      res.status(200).json({
        totalStorageUsedBytes: Number(aggregates._sum.storageUsedBytes || 0n),
        totalStorageQuotaBytes: Number(aggregates._sum.storageQuotaBytes || 0n),
        totalOrganizations: aggregates._count.id,
        topOrganizations,
      });
    } catch (error: any) {
      console.error('[SuperAdmin Storage Overview Error]:', error);
      res.status(500).json({ error: error.message || 'Failed to retrieve storage overview.' });
    }
  }

  /**
   * Update storage quota for an organization
   */
  static async updateOrgStorageQuota(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { storageQuotaBytes } = req.body;

      if (storageQuotaBytes === undefined || storageQuotaBytes === null) {
        res.status(400).json({ error: 'storageQuotaBytes is required.' });
        return;
      }

      const quota = BigInt(storageQuotaBytes);

      const organization = await prisma.organization.update({
        where: { id },
        data: {
          storageQuotaBytes: quota,
        },
        select: {
          id: true,
          name: true,
          storageQuotaBytes: true,
          storageUsedBytes: true,
        },
      });

      // Log the quota change
      await prisma.storageUsageLog.create({
        data: {
          orgId: organization.id,
          bytesUsed: organization.storageUsedBytes,
          bytesQuota: organization.storageQuotaBytes,
        },
      });

      res.status(200).json({
        message: 'Storage quota updated successfully.',
        organization,
      });
    } catch (error: any) {
      console.error('[SuperAdmin Update Storage Quota Error]:', error);
      res.status(500).json({ error: error.message || 'Failed to update storage quota.' });
    }
  }

  /**
   * Get Master 5 TB Google Drive Status
   */
  static async getMasterDriveStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = await getMasterDriveStatus();
      res.status(200).json(status);
    } catch (error: any) {
      console.error('[SuperAdmin getMasterDriveStatus Error]:', error);
      res.status(500).json({ error: error.message || 'Failed to get master drive status.' });
    }
  }

  /**
   * Get Google OAuth Consent URL for Master 5 TB Pool
   */
  static async getMasterDriveAuthUrl(req: Request, res: Response): Promise<void> {
    try {
      if (!isOAuthAppConfigured()) {
        res.status(503).json({
          error: 'Google OAuth credentials are not configured on this server.',
          isConfigured: false,
        });
        return;
      }

      const url = generateOAuthUrl('SUPERADMIN_MASTER_STORAGE');
      res.status(200).json({
        url,
        isConfigured: true,
      });
    } catch (error: any) {
      console.error('[SuperAdmin getMasterDriveAuthUrl Error]:', error);
      res.status(500).json({ error: error.message || 'Failed to generate master authorization URL.' });
    }
  }

  /**
   * Disconnect Master Google Drive Account (specific account or all)
   */
  static async disconnectMasterDrive(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await disconnectMasterDrive(id);
      res.status(200).json({
        success: true,
        message: 'Master Google Drive account has been disconnected.',
      });
    } catch (error: any) {
      console.error('[SuperAdmin disconnectMasterDrive Error]:', error);
      res.status(500).json({ error: error.message || 'Failed to disconnect master Google Drive.' });
    }
  }

  // ==========================================
  // SYSTEM ALERTS & NOTIFICATIONS
  // ==========================================

  /**
   * Get actionable platform alerts for Super Admin
   */
  static async getSystemAlerts(req: Request, res: Response): Promise<void> {
    try {
      const now = new Date();
      const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      const [expiringTrials, suspendedOrgs, allOrgs] = await Promise.all([
        prisma.organization.findMany({
          where: {
            orgStatus: OrgStatus.TRIAL,
            trialEndsAt: { lte: threeDaysLater },
          },
          select: { id: true, name: true, slug: true, trialEndsAt: true },
        }),
        prisma.organization.findMany({
          where: { orgStatus: OrgStatus.SUSPENDED },
          select: { id: true, name: true, slug: true, updatedAt: true },
        }),
        prisma.organization.findMany({
          select: {
            id: true,
            name: true,
            slug: true,
            storageUsedBytes: true,
            storageQuotaBytes: true,
            orgStorageDriver: true,
          },
        }),
      ]);

      const nearQuotaOrgs = allOrgs
        .filter((o) => Number(o.storageUsedBytes) >= Number(o.storageQuotaBytes) * 0.85)
        .map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          usedMB: (Number(o.storageUsedBytes) / (1024 * 1024)).toFixed(1),
          quotaGB: (Number(o.storageQuotaBytes) / (1024 * 1024 * 1024)).toFixed(0),
          pct: Math.round(
            (Number(o.storageUsedBytes) / Math.max(Number(o.storageQuotaBytes), 1)) * 100
          ),
          driver: o.orgStorageDriver,
        }));

      res.status(200).json({
        expiringTrials,
        suspendedOrgs,
        nearQuotaOrgs,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch platform alerts.' });
    }
  }

  // ==========================================
  // DATA EXPORT (CSV)
  // ==========================================

  /**
   * Export Organizations to CSV
   */
  static async exportOrganizations(req: Request, res: Response): Promise<void> {
    try {
      const orgs = await prisma.organization.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { users: true, leads: true, calls: true },
          },
        },
      });

      let csv = 'ID,Name,Slug,Status,Plan,Users,Leads,Calls,Storage Used (MB),Storage Quota (GB),Created At\n';
      for (const org of orgs) {
        const usedMB = (Number(org.storageUsedBytes) / (1024 * 1024)).toFixed(2);
        const quotaGB = (Number(org.storageQuotaBytes) / (1024 * 1024 * 1024)).toFixed(2);
        csv += `"${org.id}","${org.name.replace(/"/g, '""')}","${org.slug}","${org.orgStatus}","${org.planTier}",${org._count.users},${org._count.leads},${org._count.calls},${usedMB},${quotaGB},"${org.createdAt.toISOString()}"\n`;
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="organizations-${Date.now()}.csv"`);
      res.status(200).send(csv);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to export organizations.' });
    }
  }

  /**
   * Export Invoices to CSV
   */
  static async exportInvoices(req: Request, res: Response): Promise<void> {
    try {
      const invoices = await prisma.invoice.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          organization: {
            select: { name: true, slug: true },
          },
        },
      });

      let csv = 'Invoice Number,Organization,Amount (INR),Currency,Status,Payment ID,Paid At,Created At\n';
      for (const inv of invoices) {
        const amountINR = (inv.amount / 100).toFixed(2);
        csv += `"${inv.invoiceNumber}","${(inv.organization?.name || '').replace(/"/g, '""')}",${amountINR},"${inv.currency}","${inv.status}","${inv.gatewayPaymentId || ''}","${inv.paidAt ? inv.paidAt.toISOString() : ''}","${inv.createdAt.toISOString()}"\n`;
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="invoices-${Date.now()}.csv"`);
      res.status(200).send(csv);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to export invoices.' });
    }
  }

  /**
   * Export Storage Consumption to CSV
   */
  static async exportStorage(req: Request, res: Response): Promise<void> {
    try {
      const orgs = await prisma.organization.findMany({
        orderBy: { storageUsedBytes: 'desc' },
        include: {
          _count: {
            select: { calls: true },
          },
        },
      });

      let csv = 'Organization,Slug,Driver,Calls,Storage Used (MB),Storage Quota (GB),Utilization %\n';
      for (const org of orgs) {
        const usedMB = (Number(org.storageUsedBytes) / (1024 * 1024)).toFixed(2);
        const quotaGB = (Number(org.storageQuotaBytes) / (1024 * 1024 * 1024)).toFixed(2);
        const pct = Math.round(
          (Number(org.storageUsedBytes) / Math.max(Number(org.storageQuotaBytes), 1)) * 100
        );
        csv += `"${org.name.replace(/"/g, '""')}","${org.slug}","${org.orgStorageDriver}",${org._count.calls},${usedMB},${quotaGB},${pct}%\n`;
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="storage-report-${Date.now()}.csv"`);
      res.status(200).send(csv);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to export storage report.' });
    }
  }

  /**
   * Daily storage snapshot cron trigger
   */
  static async runStorageSnapshotCron(req: Request, res: Response): Promise<void> {
    try {
      const count = await runDailyStorageSnapshot();
      res.status(200).json({
        success: true,
        message: `Successfully captured storage snapshots for ${count} organizations.`,
        count,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to execute storage snapshot.' });
    }
  }
}
