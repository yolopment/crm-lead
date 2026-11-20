import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret-for-dev-only-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  recordingsDir: path.resolve(process.env.RECORDINGS_DIR || './uploads/recordings'),
  maxAudioSizeMB: parseInt(process.env.MAX_AUDIO_SIZE_MB || '50', 10),
  metaVerifyToken: process.env.META_VERIFY_TOKEN || 'leadzam_meta_verify_token',
  metaAccessToken: process.env.META_ACCESS_TOKEN || '',
  corsOrigins: (process.env.CORS_ORIGINS || '*').split(',').map((s) => s.trim()),

  // Storage Drivers: 'local' | 'r2' | 's3' | 'gdrive' | 'dual' / 'both' (Cloudflare R2 + Google Drive)
  storageDriver: (process.env.STORAGE_DRIVER || 'local').toLowerCase() as 'local' | 's3' | 'r2' | 'gdrive' | 'dual' | 'both',
  s3Endpoint: (process.env.S3_ENDPOINT || '').trim().replace(/\/$/, ''),
  s3Region: process.env.S3_REGION || 'auto',
  s3AccessKeyId: (process.env.S3_ACCESS_KEY_ID || '').trim(),
  s3SecretAccessKey: (process.env.S3_SECRET_ACCESS_KEY || '').trim(),
  s3Bucket: (process.env.S3_BUCKET || process.env.S3_BUCKET_NAME || 'crm-recordings').trim(),
  s3PublicUrl: (process.env.S3_PUBLIC_URL || '').trim().replace(/\/$/, ''),

  // Google Drive Storage Configuration (Service Account / Server-wide)
  gdriveCredentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
  gdriveServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '',
  gdriveClientEmail: process.env.GOOGLE_CLIENT_EMAIL || '',
  gdrivePrivateKey: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  gdriveFolderId: (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim(),

  // Client-Facing Google Drive OAuth Configuration (Per-Client 15 GB Free Drive)
  googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
  googleOAuthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
  googleOAuthRedirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:5001/api/v1/integrations/gdrive/callback',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // Razorpay Payment Gateway Configuration (Phase 4: Subscription & Billing)
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
};

// Ensure recordings storage directory exists
if (!fs.existsSync(config.recordingsDir)) {
  fs.mkdirSync(config.recordingsDir, { recursive: true });
}

