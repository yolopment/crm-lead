import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';

export class SmsController {
  /**
   * Ingest and synchronize SMS messages from the Android companion app
   */
  static async syncSms(req: Request, res: Response): Promise<void> {
    try {
      const deviceToken = (req.headers['x-device-token'] as string) || (req.body.deviceToken as string);
      const user = req.user || (deviceToken
        ? await prisma.user.findFirst({
            where: { deviceToken: deviceToken.trim() },
            include: { organization: true },
          })
        : null);

      if (!user) {
        res.status(401).json({ error: 'Device token required to sync SMS messages.' });
        return;
      }

      const { messages } = req.body;
      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(200).json({ success: true, synced: [] });
        return;
      }

      const syncedResults: Array<{ id: string; phoneNumber: string }> = [];

      for (const msg of messages) {
        if (!msg.phoneNumber || !msg.body) continue;

        const cleanPhone = msg.phoneNumber.trim();
        const contactName = msg.contactName?.trim() || null;
        const body = msg.body.trim();
        const direction = msg.direction === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND';
        const timestamp = msg.timestamp ? new Date(msg.timestamp) : new Date();

        // 1. Link or create lead by phone number
        let lead = await prisma.lead.findFirst({
          where: {
            orgId: user.orgId,
            phone: { contains: cleanPhone.slice(-10) },
          },
        });

        if (!lead) {
          lead = await prisma.lead.create({
            data: {
              orgId: user.orgId,
              phone: cleanPhone,
              fullName: contactName || `SMS Contact (${cleanPhone.slice(-4)})`,
              source: 'inbound_sms',
              assignedToId: user.id,
            },
          });
        } else if (contactName && (!lead.fullName || lead.fullName.startsWith('SMS Contact') || lead.fullName.startsWith('Lead ('))) {
          // Update lead name from phonebook contact name
          await prisma.lead.update({
            where: { id: lead.id },
            data: { fullName: contactName },
          });
        }

        // 2. Prevent exact duplicate insertions (same user, phone, body, timestamp within 5 sec)
        const existing = await prisma.smsMessage.findFirst({
          where: {
            orgId: user.orgId,
            phoneNumber: cleanPhone,
            body: body,
            timestamp: {
              gte: new Date(timestamp.getTime() - 5000),
              lte: new Date(timestamp.getTime() + 5000),
            },
          },
        });

        if (!existing) {
          const created = await prisma.smsMessage.create({
            data: {
              orgId: user.orgId,
              userId: user.id,
              leadId: lead.id,
              phoneNumber: cleanPhone,
              contactName: contactName || lead.fullName,
              body,
              direction,
              timestamp,
            },
          });
          syncedResults.push({ id: created.id, phoneNumber: cleanPhone });
        } else {
          syncedResults.push({ id: existing.id, phoneNumber: cleanPhone });
        }
      }

      console.log(`✉️ Synced ${syncedResults.length} SMS messages for ${user.name}`);
      res.status(200).json({ success: true, synced: syncedResults });
    } catch (error: any) {
      console.error('Error syncing SMS messages:', error);
      res.status(500).json({ error: error.message || 'Failed to sync SMS messages.' });
    }
  }

  /**
   * List all synced SMS messages for the dashboard
   */
  static async listSms(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { search, phoneNumber, direction, page = '1', limit = '50' } = req.query;

      const take = Math.min(parseInt(limit as string, 10) || 50, 100);
      const skip = (Math.max(parseInt(page as string, 10) || 1, 1) - 1) * take;

      const where: any = { orgId };

      if (phoneNumber) {
        where.phoneNumber = { contains: (phoneNumber as string).trim() };
      }

      if (direction && (direction === 'INBOUND' || direction === 'OUTBOUND')) {
        where.direction = direction;
      }

      if (search) {
        const query = (search as string).trim();
        where.OR = [
          { phoneNumber: { contains: query } },
          { contactName: { contains: query } },
          { body: { contains: query } },
        ];
      }

      const [messages, total] = await Promise.all([
        prisma.smsMessage.findMany({
          where,
          include: {
            user: { select: { id: true, name: true, email: true } },
            lead: { select: { id: true, fullName: true, stage: true, phone: true } },
          },
          orderBy: { timestamp: 'desc' },
          skip,
          take,
        }),
        prisma.smsMessage.count({ where }),
      ]);

      res.status(200).json({ messages, total, page: parseInt(page as string, 10) || 1, limit: take });
    } catch (error: any) {
      console.error('Error listing SMS messages:', error);
      res.status(500).json({ error: error.message || 'Failed to list SMS messages.' });
    }
  }

  /**
   * Delete an SMS message
   */
  static async deleteSms(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;

      await prisma.smsMessage.deleteMany({
        where: { id, orgId },
      });

      res.status(200).json({ success: true, message: 'SMS message deleted.' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete SMS message.' });
    }
  }
}

