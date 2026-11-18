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

const app = express();

// Security and middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allows audio playback across domains
}));
app.use(cors({
  origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
  credentials: true,
}));
app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
});

export default app;

