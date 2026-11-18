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
};

// Ensure recordings storage directory exists
if (!fs.existsSync(config.recordingsDir)) {
  fs.mkdirSync(config.recordingsDir, { recursive: true });
}

