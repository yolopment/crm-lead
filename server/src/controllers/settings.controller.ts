import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';

// Default Lead Stages according to reference screenshot 12
const DEFAULT_LEAD_STAGES = {
  initialStage: 'Fresh',
  activeStages: [
    { name: 'Attempting Call', leadsCount: 1 },
    { name: 'Connected', leadsCount: 1 },
    { name: 'Interested', leadsCount: 1 },
    { name: 'Meeting Scheduled', leadsCount: 1 },
    { name: 'Meeting Done', leadsCount: 0 },
    { name: 'Proposal Shared', leadsCount: 0 },
    { name: 'Negotiation', leadsCount: 0 },
    { name: 'Payment Pending', leadsCount: 0 },
  ],
  closedWon: 'Won',
  closedLost: 'Lost',
  lostReasons: [
    'No Need',
    'Unable to Connect',
    'Budget Constraint',
    'Lost to Competitor',
    'Internal Roadblock',
    'Junk',
    'Unqualified',
    'Job Related',
    'Other',
  ],
};

// Default Call Dispositions according to reference screenshot 13
const DEFAULT_CALL_DISPOSITIONS = {
  enabled: true,
  connected: [
    { id: 'disp_interested', name: 'Interested', isDefault: true },
    { id: 'disp_callback', name: 'Callback Requested', isDefault: true },
    { id: 'disp_not_interested', name: 'Not Interested', isDefault: true },
    { id: 'disp_converted', name: 'Converted', isDefault: true },
  ],
  notConnected: [
    { id: 'disp_not_picked', name: 'Not Picked', isDefault: true },
    { id: 'disp_wrong_number', name: 'Wrong Number', isDefault: true },
  ],
  archived: [
    { id: 'arc_1', name: 'Needs More Details', category: 'CONNECTED' },
    { id: 'arc_2', name: 'Quote Not Seen', category: 'CONNECTED' },
    { id: 'arc_3', name: 'Quote Discussed', category: 'CONNECTED' },
    { id: 'arc_4', name: 'Price Objection', category: 'CONNECTED' },
    { id: 'arc_5', name: 'Decision Pending', category: 'CONNECTED' },
    { id: 'arc_6', name: 'Payment Pending', category: 'CONNECTED' },
    { id: 'arc_7', name: 'Do Not Call', category: 'CONNECTED' },
    { id: 'arc_8', name: 'Busy', category: 'NOT_CONNECTED' },
    { id: 'arc_9', name: 'Switched Off', category: 'NOT_CONNECTED' },
    { id: 'arc_10', name: 'Out of Coverage', category: 'NOT_CONNECTED' },
    { id: 'arc_11', name: 'Call Disconnected', category: 'NOT_CONNECTED' },
    { id: 'arc_12', name: 'Invalid Number', category: 'NOT_CONNECTED' },
    { id: 'arc_13', name: 'Busy, Call Later', category: 'CONNECTED' },
    { id: 'arc_14', name: 'Wrong Timing', category: 'CONNECTED' },
    { id: 'arc_15', name: 'Did Not Pick', category: 'NOT_CONNECTED' },
  ],
};

// Default Products according to reference screenshot 14
const DEFAULT_PRODUCTS = [
  { id: 'prod_1', name: 'domain', usedCount: 1 },
  { id: 'prod_2', name: 'server', usedCount: 0 },
];

// Default Setup Checklist according to reference screenshot 1
const DEFAULT_SETUP_CHECKLIST = [
  { id: 'source', label: 'Connect a lead source', link: '/dashboard/integrations', completed: false },
  { id: 'form', label: 'Create a form', link: '/dashboard/forms', completed: true },
  { id: 'customize_form', label: 'Customize the form experience', link: '/dashboard/forms', completed: false },
  { id: 'settings', label: 'See every setting once', link: '/dashboard/settings', completed: false },
  { id: 'leads', label: 'Find your leads', link: '/dashboard/leads', completed: true },
  { id: 'assign', label: 'Assign a lead to a teammate', link: '/dashboard/leads', completed: false },
];

export class SettingsController {
  static async getCustomizations(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
      });

      if (!org) {
        res.status(404).json({ error: 'Organization not found.' });
        return;
      }

      const leadStages = org.leadStagesConfig ? JSON.parse(org.leadStagesConfig) : DEFAULT_LEAD_STAGES;
      const callDispositions = org.callDispositionsConfig ? JSON.parse(org.callDispositionsConfig) : DEFAULT_CALL_DISPOSITIONS;
      const products = org.productsConfig ? JSON.parse(org.productsConfig) : DEFAULT_PRODUCTS;
      const setupProgress = org.setupProgress ? JSON.parse(org.setupProgress) : DEFAULT_SETUP_CHECKLIST;

      res.status(200).json({
        leadStages,
        callDispositions,
        products,
        setupProgress,
        leadFields: org.leadFieldsConfig ? JSON.parse(org.leadFieldsConfig) : null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch customizations.' });
    }
  }

  static async updateLeadStages(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { leadStages } = req.body;

      await prisma.organization.update({
        where: { id: orgId },
        data: { leadStagesConfig: JSON.stringify(leadStages) },
      });

      res.status(200).json({ success: true, leadStages });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update lead stages.' });
    }
  }

  static async updateCallDispositions(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { callDispositions } = req.body;

      await prisma.organization.update({
        where: { id: orgId },
        data: { callDispositionsConfig: JSON.stringify(callDispositions) },
      });

      res.status(200).json({ success: true, callDispositions });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update call dispositions.' });
    }
  }

  static async updateProducts(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { products } = req.body;

      await prisma.organization.update({
        where: { id: orgId },
        data: { productsConfig: JSON.stringify(products) },
      });

      res.status(200).json({ success: true, products });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update products.' });
    }
  }

  static async updateLeadFields(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { leadFields } = req.body;

      await prisma.organization.update({
        where: { id: orgId },
        data: { leadFieldsConfig: JSON.stringify(leadFields) },
      });

      res.status(200).json({ success: true, leadFields });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update lead fields.' });
    }
  }

  static async updateSetupProgress(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { checklist } = req.body;

      await prisma.organization.update({
        where: { id: orgId },
        data: { setupProgress: JSON.stringify(checklist) },
      });

      res.status(200).json({ success: true, checklist });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update setup progress.' });
    }
  }

  static async toggleAvailability(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: { isOnLeave: !user.isOnLeave },
      });

      res.status(200).json({ success: true, isOnLeave: updated.isOnLeave });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update availability.' });
    }
  }
}

