import { Request, Response } from 'express';
import {
  getWhatsAppStatus,
  sendWhatsAppMessage,
  disconnectWhatsApp,
  listWhatsAppConversations,
  getConversationMessages,
  initWhatsAppSession,
} from '../services/whatsapp.service.js';

export class WhatsAppController {
  /**
   * Get WhatsApp Linked Device connection status and current QR code
   */
  static async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const status = await getWhatsAppStatus(orgId);
      res.status(200).json(status);
    } catch (err: any) {
      console.error('Error fetching WhatsApp status:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch WhatsApp status.' });
    }
  }

  /**
   * Request / Refresh QR Code for Linked Device scanning
   */
  static async refreshQr(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      await initWhatsAppSession(orgId);
      const status = await getWhatsAppStatus(orgId);
      res.status(200).json(status);
    } catch (err: any) {
      console.error('Error refreshing WhatsApp QR:', err);
      res.status(500).json({ error: err.message || 'Failed to refresh WhatsApp QR.' });
    }
  }

  /**
   * Send WhatsApp message to a phone number or lead
   */
  static async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { toPhone, message, leadId } = req.body;

      if (!toPhone || !message) {
        res.status(400).json({ error: 'Recipient phone number (toPhone) and message are required.' });
        return;
      }

      const result = await sendWhatsAppMessage(orgId, toPhone, message, leadId);
      res.status(200).json({
        success: true,
        message: 'WhatsApp message sent successfully.',
        messageId: result.messageId,
      });
    } catch (err: any) {
      console.error('Error sending WhatsApp message:', err);
      res.status(500).json({ error: err.message || 'Failed to send WhatsApp message.' });
    }
  }

  /**
   * Disconnect and unlink WhatsApp device
   */
  static async disconnect(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      await disconnectWhatsApp(orgId);
      res.status(200).json({
        success: true,
        message: 'WhatsApp device unlinked successfully.',
      });
    } catch (err: any) {
      console.error('Error disconnecting WhatsApp:', err);
      res.status(500).json({ error: err.message || 'Failed to disconnect WhatsApp.' });
    }
  }

  /**
   * List conversations / chats for in-CRM WhatsApp Inbox
   */
  static async getConversations(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const conversations = await listWhatsAppConversations(orgId);
      res.status(200).json({ conversations });
    } catch (err: any) {
      console.error('Error fetching WhatsApp conversations:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch conversations.' });
    }
  }

  /**
   * Get chat history for a specific contact or lead
   */
  static async getMessages(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { phone } = req.params;

      if (!phone) {
        res.status(400).json({ error: 'Phone number parameter is required.' });
        return;
      }

      const messages = await getConversationMessages(orgId, phone);
      res.status(200).json({ messages });
    } catch (err: any) {
      console.error('Error fetching WhatsApp messages:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch messages.' });
    }
  }
}
