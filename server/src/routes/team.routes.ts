import { Router } from 'express';
import { TeamController } from '../controllers/team.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

// View team members
router.get('/', TeamController.listMembers);

// Admin-only actions
router.post('/', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), TeamController.addMember);
router.post('/:userId/pairing-token', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), TeamController.generatePairingToken);

export default router;

