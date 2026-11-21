import { Router } from 'express';
import { SuperAdminController } from '../controllers/superadmin.controller.js';
import { authenticateSaasAdmin } from '../middleware/saasAuth.js';

const router = Router();

// Public auth route
router.post('/login', SuperAdminController.login);
router.get('/login', (req, res) => res.redirect('/superadmin/login'));

// SaaS Admin authentication required for all routes below
router.use(authenticateSaasAdmin);

// Dashboard & Alerts
router.get('/dashboard/stats', SuperAdminController.getDashboardStats);
router.get('/alerts', SuperAdminController.getSystemAlerts);

// Data Export (CSV)
router.get('/export/organizations', SuperAdminController.exportOrganizations);
router.get('/export/invoices', SuperAdminController.exportInvoices);
router.get('/export/storage', SuperAdminController.exportStorage);

// Background Cron Jobs
router.post('/cron/daily-storage-snapshot', SuperAdminController.runStorageSnapshotCron);

// Organizations
router.get('/organizations', SuperAdminController.listOrganizations);
router.post('/organizations', SuperAdminController.createOrganization);
router.get('/organizations/:id', SuperAdminController.getOrganizationDetail);
router.patch('/organizations/:id/plan', SuperAdminController.updateOrgPlan);
router.post('/organizations/:id/plan', SuperAdminController.updateOrgPlan);
router.post('/organizations/:id/impersonate', SuperAdminController.impersonateOrganization);
router.post('/organizations/:id/suspend', SuperAdminController.suspendOrganization);
router.patch('/organizations/:id/suspend', SuperAdminController.suspendOrganization);
router.post('/organizations/:id/reactivate', SuperAdminController.reactivateOrganization);
router.patch('/organizations/:id/reactivate', SuperAdminController.reactivateOrganization);
router.post('/organizations/:id/extend-trial', SuperAdminController.extendTrial);
router.patch('/organizations/:id/extend-trial', SuperAdminController.extendTrial);
router.post('/organizations/:id/delete', SuperAdminController.deleteOrganization);
router.delete('/organizations/:id/delete', SuperAdminController.deleteOrganization);
router.delete('/organizations/:id', SuperAdminController.deleteOrganization);

// Plans
router.get('/plans', SuperAdminController.listPlans);
router.put('/plans/:id', SuperAdminController.updatePlan);
router.patch('/plans/:id', SuperAdminController.updatePlan);

// Invoices
router.get('/invoices', SuperAdminController.listInvoices);
router.post('/invoices', SuperAdminController.createManualInvoice);

// Storage
router.get('/storage/overview', SuperAdminController.getStorageOverview);
router.get('/storage/master-status', SuperAdminController.getMasterDriveStatus);
router.get('/storage/master-auth-url', SuperAdminController.getMasterDriveAuthUrl);
router.post('/storage/master-disconnect', SuperAdminController.disconnectMasterDrive);
router.delete('/storage/master-accounts/:id', SuperAdminController.disconnectMasterDrive);
router.put('/storage/organizations/:id/quota', SuperAdminController.updateOrgStorageQuota);
router.patch('/storage/organizations/:id/quota', SuperAdminController.updateOrgStorageQuota);
router.post('/storage/organizations/:id/quota', SuperAdminController.updateOrgStorageQuota);

export default router;
