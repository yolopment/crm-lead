import { Request, Response } from 'express';
import {
  generateOAuthUrl,
  handleOAuthCallback,
  getClientDriveStatus,
  disconnectClientDrive,
  isOAuthAppConfigured,
  getMasterDriveStatus,
  handleMasterOAuthCallback,
  disconnectMasterDrive,
  setStorageDestination,
} from '../services/gdrive-oauth.service.js';
import { config } from '../config/index.js';
import { prisma } from '../utils/prisma.js';

export class GDriveOAuthController {
  /**
   * Get Google OAuth Consent Screen URL for the authenticated organization
   */
  static async getAuthUrl(req: Request, res: Response): Promise<void> {
    try {
      if (!isOAuthAppConfigured()) {
        res.status(503).json({
          error: 'Google Drive integration is not configured on this server. Please contact support.',
          isConfigured: false,
        });
        return;
      }

      const orgId = req.user!.orgId;
      const url = generateOAuthUrl(orgId);

      res.status(200).json({
        url,
        isConfigured: true,
      });
    } catch (err: any) {
      console.error('Error generating Google OAuth URL:', err);
      res.status(500).json({ error: err.message || 'Failed to generate authorization URL.' });
    }
  }

  /**
   * Google OAuth Callback Endpoint
   */
  static async oauthCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state, error } = req.query;

      if (error) {
        console.warn('Google OAuth denied or failed:', error);
        res.redirect(`${config.frontendUrl}/dashboard/settings?tab=storage&error=${encodeURIComponent(String(error))}`);
        return;
      }

      if (!code || !state) {
        res.redirect(`${config.frontendUrl}/dashboard/settings?tab=storage&error=missing_code_or_state`);
        return;
      }

      if (state === 'SUPERADMIN_MASTER_STORAGE') {
        await handleMasterOAuthCallback(String(code));
        console.log(`✅ Master 5 TB Google Drive connected successfully`);
        res.redirect(`${config.frontendUrl}/superadmin/storage?master=connected`);
        return;
      }

      const orgId = String(state);
      await handleOAuthCallback(String(code), orgId);

      console.log(`✅ Google Drive successfully connected for organization ${orgId}`);
      res.redirect(`${config.frontendUrl}/dashboard/settings?tab=storage&gdrive=connected`);
    } catch (err: any) {
      console.error('Error in Google OAuth callback:', err);
      if (req.query.state === 'SUPERADMIN_MASTER_STORAGE') {
        res.redirect(`${config.frontendUrl}/superadmin/storage?error=${encodeURIComponent(err.message || 'oauth_failed')}`);
      } else {
        res.redirect(`${config.frontendUrl}/dashboard/settings?tab=storage&error=${encodeURIComponent(err.message || 'oauth_failed')}`);
      }
    }
  }

  /**
   * Get client Google Drive connection status and storage statistics
   */
  static async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const status = await getClientDriveStatus(orgId);
      res.status(200).json(status);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch Google Drive status.' });
    }
  }

  /**
   * Set recording storage destination ('PLATFORM' vs 'OWN_GDRIVE')
   */
  static async setDestination(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { destination } = req.body;

      if (!destination || (destination !== 'PLATFORM' && destination !== 'OWN_GDRIVE')) {
        res.status(400).json({ error: 'Valid destination is required (PLATFORM or OWN_GDRIVE).' });
        return;
      }

      const result = await setStorageDestination(orgId, destination);
      res.status(200).json({
        success: true,
        message: destination === 'OWN_GDRIVE'
          ? 'Call recordings will now be saved directly to your connected Google Drive.'
          : 'Call recordings will now be saved to CRM-LEAD Platform Cloud Storage.',
        destination: result.destination,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update storage destination.' });
    }
  }

  /**
   * Disconnect client Google Drive
   */
  static async disconnect(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      await disconnectClientDrive(orgId);
      res.status(200).json({
        success: true,
        message: 'Google Drive has been disconnected. Storage reverted to server default.',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to disconnect Google Drive.' });
    }
  }

  /**
   * Simulate Google Drive Connection (For Development & Testing)
   */
  static async simulateConnect(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { email = 'client.drive@gmail.com' } = req.body;

      await prisma.organization.update({
        where: { id: orgId },
        data: {
          gdriveAccessToken: 'simulated_dev_token',
          gdriveEmail: email,
          gdriveFolderId: 'simulated_crm_folder_id',
          gdriveConnectedAt: new Date(),
          orgStorageDriver: 'gdrive_oauth',
          storageQuotaBytes: BigInt(15 * 1024 * 1024 * 1024),
        },
      });

      res.status(200).json({
        success: true,
        message: 'Google Drive connected (Dev Simulation Mode). Call recordings will be tagged for Drive storage.',
        email,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Simulation failed.' });
    }
  }
}
