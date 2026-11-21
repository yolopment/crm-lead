import { Router } from 'express';
import { GDriveOAuthController } from '../controllers/gdrive-oauth.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { Role } from '@prisma/client';

const router = Router();

// Public OAuth callback from Google
router.get('/callback', GDriveOAuthController.oauthCallback);

// Protected endpoints for client organization admins
router.use(authenticate);
router.get('/auth-url', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), GDriveOAuthController.getAuthUrl);
router.get('/status', GDriveOAuthController.getStatus);
router.post('/destination', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), GDriveOAuthController.setDestination);
router.post('/disconnect', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), GDriveOAuthController.disconnect);
router.post('/simulate-connect', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), GDriveOAuthController.simulateConnect);

export default router;
