import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma.js';
import { PlanTier } from '@prisma/client';

export type PlanFeatureKey = 'exportLeads' | 'customStages' | 'webhooks' | 'callRecording' | 'prioritySupport';

/**
 * Ensures the organization's plan tier includes the required feature
 */
export function requirePlanFeature(featureKey: PlanFeatureKey) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        include: {
          subscription: {
            include: { plan: true },
          },
        },
      });

      if (!org) {
        res.status(404).json({ error: 'Organization not found.' });
        return;
      }

      // Enterprise tier has access to all features
      if (org.planTier === PlanTier.ENTERPRISE) {
        return next();
      }

      // Find plan features
      let planFeatures: Record<string, boolean> = {};
      const plan = org.subscription?.plan || (await prisma.plan.findFirst({ where: { tier: org.planTier } }));

      if (plan?.features) {
        try {
          planFeatures = JSON.parse(plan.features);
        } catch {
          planFeatures = {};
        }
      }

      // Check if feature is enabled on this plan
      if (!planFeatures[featureKey]) {
        const requiredTier = featureKey === 'webhooks' ? 'Pro' : 'Starter';
        res.status(403).json({
          error: `The feature "${featureKey}" is not included in your current plan (${org.planTier}). Please upgrade to the ${requiredTier} plan or higher to unlock this capability.`,
          code: 'FEATURE_RESTRICTED',
          feature: featureKey,
          currentTier: org.planTier,
          requiredTier,
        });
        return;
      }

      next();
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error checking feature permissions.' });
    }
  };
}
