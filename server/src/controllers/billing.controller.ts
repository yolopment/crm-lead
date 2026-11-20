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
   * List available subscription plans for upgrade
   */
  static async getPlans(_req: Request, res: Response): Promise<void> {
    try {
      const plans = await listActivePlans();
      res.status(200).json({ plans });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch subscription plans.' });
    }
  }

  /**
   * Create Razorpay payment order for a selected plan
   */
  static async createOrder(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { planId, billingCycle = 'monthly' } = req.body;

      if (!planId) {
        res.status(400).json({ error: 'planId is required.' });
        return;
      }

      if (!['monthly', 'yearly'].includes(billingCycle)) {
        res.status(400).json({ error: 'billingCycle must be either "monthly" or "yearly".' });
        return;
      }

      const orderData = await createPaymentOrder({
        orgId,
        planId,
        billingCycle,
      });

      res.status(200).json(orderData);
    } catch (err: any) {
      console.error('Error creating order:', err);
      res.status(500).json({ error: err.message || 'Failed to initialize payment order.' });
    }
  }

  /**
   * Verify Razorpay payment and activate subscription
   */
  static async verifyPayment(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const {
        planId,
        billingCycle = 'monthly',
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      } = req.body;

      if (!planId || !razorpayOrderId || !razorpayPaymentId) {
        res.status(400).json({ error: 'planId, razorpayOrderId, and razorpayPaymentId are required.' });
        return;
      }

      const result = await verifyAndActivateSubscription({
        orgId,
        planId,
        billingCycle,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      });

      res.status(200).json({
        message: 'Payment verified and subscription activated successfully!',
        ...result,
      });
    } catch (err: any) {
      console.error('Error verifying payment:', err);
      res.status(400).json({ error: err.message || 'Payment verification failed.' });
    }
  }

  /**
   * Create Razorpay order to purchase additional storage quota
   */
  static async createStorageAddonOrder(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { extraGB } = req.body;

      if (!extraGB || ![10, 25, 50, 100].includes(Number(extraGB))) {
        res.status(400).json({ error: 'extraGB must be one of: 10, 25, 50, 100.' });
        return;
      }

      const orderData = await createStorageAddonOrder({
        orgId,
        extraGB: Number(extraGB),
      });

      res.status(200).json(orderData);
    } catch (err: any) {
      console.error('Error in createStorageAddonOrder:', err);
      res.status(500).json({ error: err.message || 'Failed to initialize storage addon order.' });
    }
  }

  /**
   * Verify Razorpay payment and activate storage quota addon
   */
  static async verifyStorageAddon(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { extraGB, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

      if (!extraGB || !razorpayOrderId || !razorpayPaymentId) {
        res.status(400).json({ error: 'extraGB, razorpayOrderId, and razorpayPaymentId are required.' });
        return;
      }

      const result = await verifyAndActivateStorageAddon({
        orgId,
        extraGB: Number(extraGB),
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      });

      res.status(200).json({
        message: `Successfully added +${extraGB} GB storage quota!`,
        ...result,
      });
    } catch (err: any) {
      console.error('Error in verifyStorageAddon:', err);
      res.status(400).json({ error: err.message || 'Storage addon verification failed.' });
    }
  }
}
