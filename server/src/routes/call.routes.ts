import { Router } from 'express';
import { CallController } from '../controllers/call.controller.js';
import { authenticate } from '../middleware/auth.js';
import { audioUpload } from '../services/storage.service.js';

const router = Router();

// Audio streaming can be accessed with auth or token
router.get('/:callId/audio', authenticate, CallController.streamAudio);

// Call Synchronization endpoints (used by Android companion app)
router.post('/sync', authenticate, CallController.syncCalls);
router.post('/upload-by-match', authenticate, audioUpload.single('audio'), CallController.uploadByMatch);
router.post('/:callId/upload-recording', authenticate, audioUpload.single('audio'), CallController.uploadRecording);
router.post('/:callId/audio', authenticate, audioUpload.single('audio'), CallController.uploadRecording);

// Dashboard endpoints
router.get('/', authenticate, CallController.getCalls);
router.get('/stats', authenticate, CallController.getStats);
router.get('/activity', authenticate, CallController.getActivity);
router.post('/:callId/notes', authenticate, CallController.addNote);

export default router;

