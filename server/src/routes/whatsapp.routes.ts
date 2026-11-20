import { Router } from 'express';
import { WhatsAppController } from '../controllers/whatsapp.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Protected endpoints for authenticated organization members
router.use(authenticate);

router.get('/status', WhatsAppController.getStatus);
router.post('/refresh-qr', WhatsAppController.refreshQr);
router.post('/send', WhatsAppController.sendMessage);
router.post('/disconnect', WhatsAppController.disconnect);
router.get('/conversations', WhatsAppController.getConversations);
router.get('/conversations/:phone/messages', WhatsAppController.getMessages);

export default router;
