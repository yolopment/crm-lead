import { Router } from 'express';
import { FormController } from '../controllers/form.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Public submission & fetch route
router.get('/public/:slug', FormController.getPublicForm);
router.post('/public/:slug/submit', FormController.submitForm);

// Authenticated management routes
router.use(authenticate);
router.get('/', FormController.listForms);
router.get('/:formId', FormController.getForm);
router.get('/:formId/submissions', FormController.getSubmissions);
router.post('/', FormController.createForm);
router.post('/:formId/duplicate', FormController.duplicateForm);
router.patch('/:formId/status', FormController.toggleStatus);
router.put('/:formId', FormController.updateForm);
router.patch('/:formId', FormController.updateForm);
router.delete('/:formId', FormController.deleteForm);

export default router;

