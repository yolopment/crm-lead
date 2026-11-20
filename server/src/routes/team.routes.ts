import { Router } from 'express';
import { TeamController } from '../controllers/team.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { requireActiveOrg, checkUserLimit } from '../middleware/planLimits.js';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(requireActiveOrg);

// View team members
router.get('/', TeamController.listMembers);

// Admin-only actions with Plan User Limit enforcement
router.post('/', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), checkUserLimit, TeamController.addMember);
router.patch('/:id', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), TeamController.updateMember);
router.delete('/:id', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), TeamController.deleteMember);
router.post('/invite', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), checkUserLimit, TeamController.inviteTeammate);
router.delete('/invites/:id', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), TeamController.revokeInvite);
router.post('/invites/:id/resend', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), TeamController.resendInvite);
router.post('/:userId/pairing-token', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), TeamController.generatePairingToken);

export default router;

