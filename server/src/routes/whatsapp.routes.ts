import { Router } from 'express';
import { WhatsAppController } from '../controllers/whatsapp.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { Role } from '@prisma/client';

const router = Router();

// Protected endpoints for authenticated organization members
router.use(authenticate);

router.get('/status', WhatsAppController.getStatus);
router.post('/refresh-qr', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), WhatsAppController.refreshQr);
router.post('/send', WhatsAppController.sendMessage);
router.post('/disconnect', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), WhatsAppController.disconnect);
router.get('/conversations', WhatsAppController.getConversations);
router.get('/conversations/:phone/messages', WhatsAppController.getMessages);

export default router;
