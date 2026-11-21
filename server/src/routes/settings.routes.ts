import { Router } from 'express';
import { SettingsController } from '../controllers/settings.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/', SettingsController.getCustomizations);
router.put('/lead-stages', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), SettingsController.updateLeadStages);
router.put('/call-dispositions', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), SettingsController.updateCallDispositions);
router.put('/products', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), SettingsController.updateProducts);
router.put('/lead-fields', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), SettingsController.updateLeadFields);
router.put('/setup-progress', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), SettingsController.updateSetupProgress);
router.post('/availability', SettingsController.toggleAvailability);

export default router;

