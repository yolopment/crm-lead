import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';

export class PolicyController {
  /**
   * Get organization call policies & capture scope & DNT list
   */
  static async getPolicy(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          captureScope: true,
          allowMemberScope: true,
          recordCalls: true,
          smartFollowUps: true,
          dntList: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!org) {
        res.status(404).json({ error: 'Organization not found.' });
        return;
      }

      res.status(200).json(org);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch policy.' });
    }
  }

  /**
   * Update capture scope and toggles
   */
  static async updatePolicy(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { captureScope, allowMemberScope, recordCalls, smartFollowUps } = req.body;

      const updated = await prisma.organization.update({
        where: { id: orgId },
        data: {
          captureScope: captureScope || undefined,
          allowMemberScope: typeof allowMemberScope === 'boolean' ? allowMemberScope : undefined,
          recordCalls: typeof recordCalls === 'boolean' ? recordCalls : undefined,
          smartFollowUps: typeof smartFollowUps === 'boolean' ? smartFollowUps : undefined,
        },
      });

      res.status(200).json({
        message: 'Call policy updated successfully.',
        policy: {
          captureScope: updated.captureScope,
          allowMemberScope: updated.allowMemberScope,
          recordCalls: updated.recordCalls,
          smartFollowUps: updated.smartFollowUps,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update policy.' });
    }
  }

  /**
   * Add a number to Company Do-Not-Track
   */
  static async addDnt(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { phone, reason } = req.body;

      if (!phone) {
        res.status(400).json({ error: 'Phone number is required.' });
        return;
      }

      const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

      const entry = await prisma.doNotTrack.upsert({
        where: { orgId_phone: { orgId, phone: cleanPhone } },
        update: { reason },
        create: { orgId, phone: cleanPhone, reason },
      });

      res.status(201).json({ message: 'Number added to Do-Not-Track list.', entry });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to add DNT number.' });
    }
  }

  /**
   * Remove a number from Company Do-Not-Track
   */
  static async removeDnt(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;

      await prisma.doNotTrack.deleteMany({
        where: { id, orgId },
      });

      res.status(200).json({ message: 'Number removed from Do-Not-Track list.' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete DNT number.' });
    }
  }

  /**
   * Get user's private numbers
   */
  static async getPrivateNumbers(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const list = await prisma.privateNumber.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      res.status(200).json(list);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch private numbers.' });
    }
  }

  /**
   * Add a single private number
   */
  static async addPrivateNumber(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { phone } = req.body;

      if (!phone) {
        res.status(400).json({ error: 'Phone number is required.' });
        return;
      }

      const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

      const entry = await prisma.privateNumber.upsert({
        where: { userId_phone: { userId, phone: cleanPhone } },
        update: {},
        create: { userId, phone: cleanPhone },
      });

      res.status(201).json({ message: 'Number added to private list.', entry });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to add private number.' });
    }
  }

  /**
   * Add multiple private numbers in bulk
   */
  static async bulkAddPrivateNumbers(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { text } = req.body;

      if (!text || typeof text !== 'string') {
        res.status(400).json({ error: 'Text containing phone numbers is required.' });
        return;
      }

      const lines = text.split(/[\n,;]/).map(p => p.trim().replace(/[\s\-\(\)]/g, '')).filter(p => p.length >= 4);

      const added = [];
      for (const p of lines) {
        const item = await prisma.privateNumber.upsert({
          where: { userId_phone: { userId, phone: p } },
          update: {},
          create: { userId, phone: p },
        });
        added.push(item);
      }

      res.status(201).json({ message: `Added ${added.length} private numbers.`, count: added.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to bulk add private numbers.' });
    }
  }

  /**
   * Remove a private number
   */
  static async removePrivateNumber(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await prisma.privateNumber.deleteMany({
        where: { id, userId },
      });

      res.status(200).json({ message: 'Number removed from private list.' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete private number.' });
    }
  }
}

