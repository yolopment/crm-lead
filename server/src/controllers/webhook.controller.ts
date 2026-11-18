import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { LeadDistributionService } from '../services/leadDistribution.service.js';

export class WebhookController {
  /**
   * Verification handshake for Meta Webhook
   */
  static verifyMeta(req: Request, res: Response): void {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.metaVerifyToken) {
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Verification token mismatch');
    }
  }

  /**
   * Handle incoming Meta Lead Ad webhook notifications
   */
  static async handleMetaLead(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body;

      if (body.object === 'page') {
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field === 'leadgen') {
              const leadgenId = change.value.leadgen_id;
              const adId = change.value.ad_id;
              const formId = change.value.form_id;

              // Find target organization (or default first organization)
              const org = await prisma.organization.findFirst();
              if (!org) continue;

              // Assign to available agent
              const assignedAgentId = await LeadDistributionService.assignNextAvailableAgent(org.id);

              await prisma.lead.create({
                data: {
                  orgId: org.id,
                  phone: '+1000000000', // In production, retrieved from Meta Graph API using leadgenId
                  fullName: `Meta Lead (${leadgenId})`,
                  source: 'meta_ads',
                  adName: `Ad ${adId}`,
                  campaignName: `Form ${formId}`,
                  assignedToId: assignedAgentId,
                },
              });
            }
          }
        }
      }

      res.status(200).send('EVENT_RECEIVED');
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

