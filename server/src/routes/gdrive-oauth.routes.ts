import { Router } from 'express';
import { GDriveOAuthController } from '../controllers/gdrive-oauth.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Public OAuth callback from Google
router.get('/callback', GDriveOAuthController.oauthCallback);

// Protected endpoints for client organization admins
router.get('/auth-url', authenticate, GDriveOAuthController.getAuthUrl);
router.get('/status', authenticate, GDriveOAuthController.getStatus);
router.post('/destination', authenticate, GDriveOAuthController.setDestination);
router.post('/disconnect', authenticate, GDriveOAuthController.disconnect);
router.post('/simulate-connect', authenticate, GDriveOAuthController.simulateConnect);

export default router;
