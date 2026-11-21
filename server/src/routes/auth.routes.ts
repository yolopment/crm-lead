import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.get('/login', (req, res) => res.redirect('/login'));
router.get('/invite/:token', AuthController.getInviteDetails);
router.post('/accept-invite', AuthController.acceptInvite);
router.get('/me', authenticate, AuthController.getProfile);
router.post('/leave/toggle', authenticate, AuthController.toggleLeave);

export default router;

