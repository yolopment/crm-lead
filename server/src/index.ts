import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/index.js';

import authRoutes from './routes/auth.routes.js';
import teamRoutes from './routes/team.routes.js';
import callRoutes from './routes/call.routes.js';
import leadRoutes from './routes/lead.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import deviceRoutes from './routes/device.routes.js';
import policyRoutes from './routes/policy.routes.js';
import smsRoutes from './routes/sms.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import formRoutes from './routes/form.routes.js';
import followupRoutes from './routes/followup.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import superadminRoutes from './routes/superadmin.routes.js';
import gdriveOAuthRoutes from './routes/gdrive-oauth.routes.js';
import billingRoutes from './routes/billing.routes.js';
import whatsappRoutes from './routes/whatsapp.routes.js';
import publicRoutes from './routes/public.routes.js';
import { restoreActiveWhatsAppSessions } from './services/whatsapp.service.js';

const app = express();

// Security and middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allows audio playback across domains
  contentSecurityPolicy: false,
}));
app.use(cors({
  origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
  credentials: true,
}));
app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Public landing, SEO, AI visibility, and documentation routes
app.use('/', publicRoutes);

// Health Check for Hostinger Nginx monitoring
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// Mount API v1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/team', teamRoutes);
app.use('/api/v1/calls', callRoutes);
app.use('/api/v1/leads', leadRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/devices', deviceRoutes);
app.use('/api/v1/policy', policyRoutes);
app.use('/api/v1/sms', smsRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/forms', formRoutes);
app.use('/api/v1/followups', followupRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/superadmin', superadminRoutes);
app.use('/api/v1/integrations/gdrive', gdriveOAuthRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/whatsapp', whatsappRoutes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[API Server Error]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// Start Server
app.listen(config.port, '0.0.0.0', () => {
  console.log(`🚀 CRM-LEAD Backend running on http://0.0.0.0:${config.port}`);
  console.log(`📁 Audio recordings directory: ${config.recordingsDir}`);

  // Restore active WhatsApp Linked Device sessions
  restoreActiveWhatsAppSessions().catch(console.error);
});

export default app;

