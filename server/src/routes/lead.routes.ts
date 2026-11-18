import { Router } from 'express';
import { LeadController } from '../controllers/lead.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', LeadController.listLeads);
router.post('/', LeadController.createLead);
router.patch('/:leadId/stage', LeadController.updateStage);
router.patch('/:leadId', LeadController.updateLead);

export default router;

