import { Router } from 'express';
import { PolicyController } from '../controllers/policy.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

// Get and update call policy
router.get('/', PolicyController.getPolicy);
router.post('/', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), PolicyController.updatePolicy);

// Company Do-Not-Track list
router.post('/dnt', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), PolicyController.addDnt);
router.delete('/dnt/:id', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), PolicyController.removeDnt);

export default router;

