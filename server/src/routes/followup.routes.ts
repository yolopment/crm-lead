import { Router } from 'express';
import {
  listFollowups,
  createFollowup,
  completeFollowup,
  rescheduleFollowup,
  deleteFollowup,
} from '../controllers/followup.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', listFollowups);
router.post('/', createFollowup);
router.patch('/:id/complete', completeFollowup);
router.patch('/:id/reschedule', rescheduleFollowup);
router.delete('/:id', deleteFollowup);

export default router;

