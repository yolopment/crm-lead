import { Router } from 'express';
import { SettingsController } from '../controllers/settings.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', SettingsController.getCustomizations);
router.put('/lead-stages', SettingsController.updateLeadStages);
router.put('/call-dispositions', SettingsController.updateCallDispositions);
router.put('/products', SettingsController.updateProducts);
router.put('/lead-fields', SettingsController.updateLeadFields);
router.put('/setup-progress', SettingsController.updateSetupProgress);
router.post('/availability', SettingsController.toggleAvailability);

export default router;

