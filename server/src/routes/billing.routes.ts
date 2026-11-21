import { Router } from 'express';
import { BillingController } from '../controllers/billing.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

// Client Billing & Subscription Endpoints
router.get('/overview', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), BillingController.getOverview);
router.get('/plans', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), BillingController.getPlans);
router.post('/create-order', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), BillingController.createOrder);
router.post('/verify-payment', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), BillingController.verifyPayment);

// Storage Add-on Endpoints
router.post('/storage-addon/order', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), BillingController.createStorageAddonOrder);
router.post('/storage-addon/verify', requireRole([Role.ADMIN, Role.SUPER_ADMIN]), BillingController.verifyStorageAddon);

export default router;
