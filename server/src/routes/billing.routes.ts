import { Router } from 'express';
import { BillingController } from '../controllers/billing.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Client Billing & Subscription Endpoints
router.get('/overview', authenticate, BillingController.getOverview);
router.get('/plans', authenticate, BillingController.getPlans);
router.post('/create-order', authenticate, BillingController.createOrder);
router.post('/verify-payment', authenticate, BillingController.verifyPayment);

// Storage Add-on Endpoints
router.post('/storage-addon/order', authenticate, BillingController.createStorageAddonOrder);
router.post('/storage-addon/verify', authenticate, BillingController.verifyStorageAddon);

export default router;
