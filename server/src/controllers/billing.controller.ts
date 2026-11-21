import { Request, Response } from 'express';
import {
  getClientBillingOverview,
  listActivePlans,
  createPaymentOrder,
  verifyAndActivateSubscription,
  createStorageAddonOrder,
  verifyAndActivateStorageAddon,
} from '../services/billing.service.js';

export class BillingController {
  /**
   * Get client billing overview (current plan, usage, limits, invoices)
   */
  static async getOverview(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const overview = await getClientBillingOverview(orgId);
      res.status(200).json(overview);
    } catch (err: any) {
      console.error('Error in getOverview:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch billing overview.' });
    }
  }

  /**
   * List available subscription plans (disabled for self-serve client upgrades)
   */
  static async getPlans(_req: Request, res: Response): Promise<void> {
    res.status(200).json({ plans: [] });
  }

  /**
   * Create Razorpay payment order for a selected plan (DISABLED)
   */
  static async createOrder(req: Request, res: Response): Promise<void> {
    res.status(403).json({
      error: 'Self-serve plan upgrades are disabled. All subscription plans, pricing, and resource quotas are managed exclusively by the Platform Super Admin.',
    });
  }

  /**
   * Verify Razorpay payment and activate subscription (DISABLED)
   */
  static async verifyPayment(req: Request, res: Response): Promise<void> {
    res.status(403).json({
      error: 'Self-serve plan upgrades are disabled. All subscription plans, pricing, and resource quotas are managed exclusively by the Platform Super Admin.',
    });
  }

  /**
   * Create Razorpay order to purchase additional storage quota (DISABLED)
   */
  static async createStorageAddonOrder(req: Request, res: Response): Promise<void> {
    res.status(403).json({
      error: 'Self-serve storage add-on purchases are disabled. Quotas are managed exclusively by the Platform Super Admin.',
    });
  }

  /**
   * Verify Razorpay payment and activate storage quota addon (DISABLED)
   */
  static async verifyStorageAddon(req: Request, res: Response): Promise<void> {
    res.status(403).json({
      error: 'Self-serve storage add-on purchases are disabled. Quotas are managed exclusively by the Platform Super Admin.',
    });
  }
}
