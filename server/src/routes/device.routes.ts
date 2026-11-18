import { Router } from 'express';
import { DeviceController } from '../controllers/device.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Mobile device pairing (unauthenticated, authenticated via deviceToken in body)
router.post('/pair', DeviceController.pairDevice);

// List paired devices (authenticated by dashboard JWT)
router.get('/', authenticate, DeviceController.listDevices);

// Unpair / delete device
router.delete('/:id', authenticate, DeviceController.unpairDevice);

export default router;

