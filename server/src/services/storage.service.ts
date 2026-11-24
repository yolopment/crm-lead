import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response } from 'express';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/index.js';
import { prisma } from '../utils/prisma.js';
import {
  uploadToGoogleDrive,
  deleteFromGoogleDrive,
  streamFromGoogleDrive,
  isGoogleDriveConfigured,
} from './gdrive.service.js';
import {
  uploadCallToClientDrive,
  uploadCallToMasterDrive,
  getMasterDriveStatus,
  streamCallFromClientDrive,
  streamCallFromMasterDrive,
} from './gdrive-oauth.service.js';

// Format and normalize S3 / Cloudflare R2 endpoint
const formattedEndpoint = config.s3Endpoint
  ? config.s3Endpoint.startsWith('http://') || config.s3Endpoint.startsWith('https://')
    ? config.s3Endpoint
    : `https://${config.s3Endpoint}`
  : undefined;

// S3-compatible client for Cloudflare R2 / Backblaze B2 / AWS S3
const isCloudStorage = (config.storageDriver === 's3' || config.storageDriver === 'r2') && !!config.s3AccessKeyId;

const s3Client = isCloudStorage
  ? new S3Client({
      region: config.s3Region || 'auto',
      endpoint: formattedEndpoint,
      credentials: {
        accessKeyId: config.s3AccessKeyId,
        secretAccessKey: config.s3SecretAccessKey,
      },
    })
  : null;

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

/**
 * Uploads audio file to Cloudflare R2, Google Drive, or local disk.
 * In 'dual' / 'both' mode: uploads to Cloudflare R2 (for 0$ instant streaming)
 * AND uploads a backup copy to company Google Drive folder.
 * Deletes local temp file to keep Hostinger VPS disk 100% clean.
 */
export async function processAndSaveAudio(
  file: Express.Multer.File,
  orgId: string,
  callId: string
): Promise<{ audioPath: string; audioSize: number; gdriveUrl?: string }> {
  let primaryAudioPath = '';
  let gdriveUrl: string | undefined = undefined;

  // 0. Check if client organization has connected their own Google Drive (Phase 3: Per-Client 15 GB Drive)
  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        orgStorageDriver: true,
        gdriveAccessToken: true,
        gdriveFolderId: true,
        storageQuotaBytes: true,
        storageUsedBytes: true,
      },
    });

    const isClientDriveConnected = org?.orgStorageDriver === 'gdrive_oauth' && !!org?.gdriveAccessToken;

    if (isClientDriveConnected) {
      const currentUsed = org.storageUsedBytes || BigInt(0);
      const quota = org.storageQuotaBytes || BigInt(15 * 1024 * 1024 * 1024);

      if (currentUsed + BigInt(file.size) > quota) {
        console.warn(`⚠️ Storage Quota Alert: Organization ${orgId} has exceeded its storage quota (${currentUsed} / ${quota} bytes).`);
      }

      const ext = path.extname(file.originalname).toLowerCase() || '.m4a';
      const driveFileName = `Call-${callId}-${Date.now()}${ext}`;

      const clientDriveResult = await uploadCallToClientDrive(
        orgId,
        file.path,
        driveFileName,
        file.mimetype || 'audio/mp4',
        `Call recording for call ID ${callId}`
      );

      if (clientDriveResult) {
        gdriveUrl = clientDriveResult.webViewLink;
        primaryAudioPath = `client_gdrive:${clientDriveResult.fileId}:${clientDriveResult.webViewLink || ''}`;

        // Increment organization's storageUsedBytes
        const updatedOrg = await prisma.organization.update({
          where: { id: orgId },
          data: {
            storageUsedBytes: {
              increment: BigInt(file.size),
            },
          },
        });

        // Record a snapshot in StorageUsageLog for SaaS analytics
        try {
          await prisma.storageUsageLog.create({
            data: {
              orgId,
              bytesUsed: updatedOrg.storageUsedBytes,
              bytesQuota: updatedOrg.storageQuotaBytes,
            },
          });
        } catch {
          // Non-fatal logging error
        }

        console.log(`☁️ Uploaded call recording directly to Client Google Drive (org ${orgId})`);
      }
    }
  } catch (clientDriveErr) {
    console.error('Error uploading to client Google Drive:', clientDriveErr);
  }

  const isDual = config.storageDriver === 'dual' || config.storageDriver === 'both';
  const isGdriveOnly = config.storageDriver === 'gdrive';
  const isR2OrS3 = config.storageDriver === 'r2' || config.storageDriver === 's3' || !!s3Client;

  // 1. If Google Drive is enabled (either standalone or dual mode)
  if (!primaryAudioPath && (isDual || isGdriveOnly) && isGoogleDriveConfigured()) {
    const ext = path.extname(file.originalname).toLowerCase() || '.m4a';
    const driveFileName = `Call-${callId}-${Date.now()}${ext}`;
    const gdriveResult = await uploadToGoogleDrive(
      file.path,
      driveFileName,
      file.mimetype || 'audio/mp4',
      `Call recording for call ID ${callId} (Org: ${orgId})`
    );

    if (gdriveResult) {
      gdriveUrl = gdriveResult.webViewLink;
      if (isGdriveOnly) {
        primaryAudioPath = `gdrive:${gdriveResult.fileId}`;
      }
    }
  }

  // 1b. Check if Super Admin Master 5 TB Google Drive is connected as default platform storage
  if (!primaryAudioPath && orgId !== 'unassigned') {
    try {
      const masterStatus = await getMasterDriveStatus();
      if (masterStatus.isConnected) {
        const orgRecord = await prisma.organization.findUnique({
          where: { id: orgId },
          select: { name: true, storageUsedBytes: true, storageQuotaBytes: true },
        });

        const orgName = orgRecord?.name || `Org_${orgId.substring(0, 6)}`;
        const ext = path.extname(file.originalname).toLowerCase() || '.m4a';
        const driveFileName = `Call-${callId}-${Date.now()}${ext}`;

        const masterResult = await uploadCallToMasterDrive(
          orgId,
          orgName,
          file.path,
          driveFileName,
          file.mimetype || 'audio/mp4'
        );

        if (masterResult) {
          gdriveUrl = masterResult.webViewLink;
          primaryAudioPath = `master_gdrive:${masterResult.fileId}:${masterResult.webViewLink || ''}`;

          // Increment organization's storage used bytes
          const updated = await prisma.organization.update({
            where: { id: orgId },
            data: {
              storageUsedBytes: { increment: BigInt(file.size) },
            },
          });

          try {
            await prisma.storageUsageLog.create({
              data: {
                orgId,
                bytesUsed: updated.storageUsedBytes,
                bytesQuota: updated.storageQuotaBytes,
              },
            });
          } catch {
            // Ignore log error
          }

          console.log(`☁️ Uploaded call recording to Super Admin Master 5 TB Drive for "${orgName}"`);
        }
      }
    } catch (masterErr) {
      console.error('Error uploading to Master Google Drive:', masterErr);
    }
  }

  // 2. If R2 / S3 is enabled (or dual mode with R2 as primary streamer)
  if (!primaryAudioPath && (isR2OrS3 || isDual) && s3Client) {
    const ext = path.extname(file.originalname).toLowerCase() || '.m4a';
    const key = `recordings/${orgId}/${callId}-${Date.now()}${ext}`;
    const fileBuffer = fs.readFileSync(file.path);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: config.s3Bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: file.mimetype || 'audio/mp4',
      })
    );

    primaryAudioPath = key;
  }

  // 3. Fallback to local storage if neither R2 nor GDrive set primary path
  if (!primaryAudioPath) {
    if (isGdriveOnly && gdriveUrl) {
      primaryAudioPath = gdriveUrl;
    } else {
      primaryAudioPath = path.join(orgId, file.filename);
    }
  }

  // 4. If audio was stored on server drivers (local or R2), increment organization storageUsedBytes
  if (!primaryAudioPath.startsWith('client_gdrive:') && !primaryAudioPath.startsWith('master_gdrive:')) {
    try {
      const updatedOrg = await prisma.organization.update({
        where: { id: orgId },
        data: {
          storageUsedBytes: {
            increment: BigInt(file.size),
          },
        },
      });

      // Snapshot log for analytics
      await prisma.storageUsageLog.create({
        data: {
          orgId,
          bytesUsed: updatedOrg.storageUsedBytes,
          bytesQuota: updatedOrg.storageQuotaBytes,
        },
      });
    } catch (e) {
      // Non-fatal tracking error
    }
  }

  // 5. Delete local temporary file if offloaded to Cloudflare R2 / GDrive
  if (primaryAudioPath !== path.join(orgId, file.filename)) {
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (e) {
      // Ignore
    }
  }

  return {
    audioPath: primaryAudioPath,
    audioSize: file.size,
    gdriveUrl,
  };
}

/**
 * Stream audio file or redirect to Cloudflare R2 / S3 pre-signed URL / Google Drive
 */
export async function streamAudioOrRedirect(
  audioPath: string,
  req: Request,
  res: Response,
  orgId?: string
): Promise<void> {
  const effectiveOrgId = orgId || (req as any).user?.orgId;

  // 1. Google Drive direct URLs (extract file ID and stream binary audio directly)
  if (audioPath.startsWith('http://') || audioPath.startsWith('https://')) {
    const driveMatch = audioPath.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([^/?&#]+)/);
    if (driveMatch && driveMatch[1]) {
      const fileId = driveMatch[1];
      if (effectiveOrgId) {
        const clientStreamed = await streamCallFromClientDrive(effectiveOrgId, fileId, res);
        if (clientStreamed) return;
      }
      const masterStreamed = await streamCallFromMasterDrive(fileId, res);
      if (masterStreamed) return;
    }
    res.redirect(audioPath);
    return;
  }

  // 2. Client-connected Google Drive
  if (audioPath.startsWith('client_gdrive:')) {
    const parts = audioPath.split(':');
    const fileId = parts[1];
    if (fileId && effectiveOrgId) {
      const streamed = await streamCallFromClientDrive(effectiveOrgId, fileId, res);
      if (streamed) return;
    }
    // Fallback: try master drive cluster in case it was stored there
    if (fileId) {
      const masterStreamed = await streamCallFromMasterDrive(fileId, res);
      if (masterStreamed) return;
    }
    // Fallback: if web view link is attached, redirect as last resort
    const webViewLink = parts.length >= 3 ? parts.slice(2).join(':') : null;
    if (webViewLink && (webViewLink.startsWith('http://') || webViewLink.startsWith('https://'))) {
      res.redirect(webViewLink);
      return;
    }
    if (fileId) {
      res.redirect(`https://drive.google.com/file/d/${fileId}/view`);
      return;
    }
  }

  // 3. Super Admin Master Google Drive Cluster
  if (audioPath.startsWith('master_gdrive:')) {
    const parts = audioPath.split(':');
    const fileId = parts[1];
    if (fileId) {
      const masterStreamed = await streamCallFromMasterDrive(fileId, res);
      if (masterStreamed) return;
    }
    // Fallback: try client drive
    if (fileId && effectiveOrgId) {
      const clientStreamed = await streamCallFromClientDrive(effectiveOrgId, fileId, res);
      if (clientStreamed) return;
    }
    // Fallback: if web view link is attached, redirect as last resort
    const webViewLink = parts.length >= 3 ? parts.slice(2).join(':') : null;
    if (webViewLink && (webViewLink.startsWith('http://') || webViewLink.startsWith('https://'))) {
      res.redirect(webViewLink);
      return;
    }
    if (fileId) {
      res.redirect(`https://drive.google.com/file/d/${fileId}/view`);
      return;
    }
  }

  // 4. Google Drive streaming (service account)
  if (audioPath.startsWith('gdrive:')) {
    const fileId = audioPath.replace('gdrive:', '');
    await streamFromGoogleDrive(fileId, res);
    return;
  }

  // 5. Cloudflare R2 / S3 storage
  if (s3Client && (audioPath.startsWith('recordings/') || config.storageDriver !== 'local')) {
    if (config.s3PublicUrl) {
      const publicBase = config.s3PublicUrl.replace(/\/$/, '');
      res.redirect(`${publicBase}/${audioPath}`);
      return;
    }

    // Generate pre-signed streaming URL valid for 2 hours
    const command = new GetObjectCommand({
      Bucket: config.s3Bucket,
      Key: audioPath,
    });
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 7200 });
    res.redirect(presignedUrl);
    return;
  }

  // 6. Local VPS disk streaming
  streamAudioFile(audioPath, req, res);
}

/**
 * Delete audio file from Cloudflare R2 / S3 / Google Drive or local disk
 * Also decrements organization.storageUsedBytes if orgId and size are provided
 */
export async function deleteAudioFile(audioPath: string, orgId?: string, audioSizeBytes?: number): Promise<boolean> {
  let deleted = false;
  try {
    if (audioPath.startsWith('gdrive:')) {
      const fileId = audioPath.replace('gdrive:', '');
      deleted = await deleteFromGoogleDrive(fileId);
    } else if (s3Client && (audioPath.startsWith('recordings/') || config.storageDriver !== 'local')) {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: config.s3Bucket,
          Key: audioPath,
        })
      );
      deleted = true;
    } else {
      const absolutePath = path.isAbsolute(audioPath) ? audioPath : path.join(config.recordingsDir, audioPath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        deleted = true;
      }
    }

    // Decrement storageUsedBytes when recording is removed
    if (deleted && orgId && audioSizeBytes && audioSizeBytes > 0) {
      try {
        await prisma.organization.update({
          where: { id: orgId },
          data: {
            storageUsedBytes: {
              decrement: BigInt(audioSizeBytes),
            },
          },
        });
      } catch (decErr) {
        console.warn('Could not decrement storageUsedBytes on file delete:', decErr);
      }
    }
  } catch (err) {
    console.error(`Failed to delete recording (${audioPath}):`, err);
  }
  return deleted;
}

/**
 * Daily background routine to snapshot storage consumption across all organizations
 */
export async function runDailyStorageSnapshot(): Promise<number> {
  try {
    const orgs = await prisma.organization.findMany({
      select: {
        id: true,
        storageUsedBytes: true,
        storageQuotaBytes: true,
      },
    });

    for (const org of orgs) {
      await prisma.storageUsageLog.create({
        data: {
          orgId: org.id,
          bytesUsed: org.storageUsedBytes,
          bytesQuota: org.storageQuotaBytes,
        },
      });
    }

    console.log(`📸 Storage snapshot recorded for ${orgs.length} organizations.`);
    return orgs.length;
  } catch (err) {
    console.error('Error running daily storage snapshot:', err);
    return 0;
  }
}

export { isCloudStorage, s3Client };


