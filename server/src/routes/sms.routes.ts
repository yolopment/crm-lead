import { Router } from 'express';
import { SmsController } from '../controllers/sms.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Sync SMS messages from mobile companion app (supports x-device-token header)
router.post('/sync', authenticate, SmsController.syncSms);

// List SMS messages for dashboard
router.get('/', authenticate, SmsController.listSms);

// Delete an SMS message
router.delete('/:id', authenticate, SmsController.deleteSms);

export default router;
