import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response } from 'express';
import { config } from '../config/index.js';

// Configure disk storage for incoming call audio
const storage = multer.diskStorage({
  destination: (req: Request, file, cb) => {
    const orgId = req.user?.orgId || 'unassigned';
    const targetDir = path.join(config.recordingsDir, orgId);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: (req: Request, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase() || '.m4a';
    cb(null, `call-${uniqueSuffix}${ext}`);
  },
});

export const audioUpload = multer({
  storage,
  limits: {
    fileSize: config.maxAudioSizeMB * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.m4a', '.mp3', '.wav', '.aac', '.amr', '.3gp', '.ogg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format. Allowed: ${allowedExts.join(', ')}`));
    }
  },
});

/**
 * Stream audio files with HTTP Range support for seamless seeking in browser
 */
export function streamAudioFile(filePath: string, req: Request, res: Response): void {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(config.recordingsDir, filePath);

  if (!fs.existsSync(absolutePath)) {
    res.status(404).json({ error: 'Call recording audio file not found on server.' });
    return;
  }

  const stat = fs.statSync(absolutePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const ext = path.extname(absolutePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.wav': 'audio/wav',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.amr': 'audio/amr',
    '.3gp': 'audio/3gpp',
  };
  const contentType = mimeMap[ext] || 'audio/mpeg';

  if (range) {
    // Parse range: e.g. "bytes=0-1024"
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;

    const fileStream = fs.createReadStream(absolutePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    });

    fileStream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    });

    fs.createReadStream(absolutePath).pipe(res);
  }
}

