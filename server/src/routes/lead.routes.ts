import { Router } from 'express';
import { LeadController } from '../controllers/lead.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireActiveOrg, checkLeadLimit } from '../middleware/planLimits.js';

const router = Router();

router.use(authenticate);
router.use(requireActiveOrg);

router.get('/', LeadController.listLeads);
router.get('/followups', LeadController.getFollowups);
router.post('/bulk-upload', checkLeadLimit, LeadController.bulkUploadLeads);
router.get('/:leadId', LeadController.getLeadById);
router.post('/:leadId/notes', LeadController.addNote);
router.post('/', checkLeadLimit, LeadController.createLead);
router.patch('/:leadId/stage', LeadController.updateStage);
router.patch('/:leadId', LeadController.updateLead);
router.delete('/:leadId', LeadController.deleteLead);

export default router;

