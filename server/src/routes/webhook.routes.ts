import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller.js';

const router = Router();

router.get('/meta', WebhookController.verifyMeta);
router.post('/meta', WebhookController.handleMetaLead);

export default router;

