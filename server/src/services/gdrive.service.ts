import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { Response } from 'express';
import { config } from '../config/index.js';

let driveClient: any = null;

/**
 * Check if Google Drive storage is fully configured
 */
export function isGoogleDriveConfigured(): boolean {
  return (
    !!config.gdriveFolderId &&
    (!!config.gdriveCredentialsPath ||
      !!config.gdriveServiceAccountJson ||
      (!!config.gdriveClientEmail && !!config.gdrivePrivateKey))
  );
}

/**
 * Initialize and return Google Drive v3 client
 */
export function getDriveClient() {
  if (driveClient) return driveClient;
  if (!isGoogleDriveConfigured()) return null;

  try {
    let auth: any = null;

    if (config.gdriveServiceAccountJson) {
      const credentials = JSON.parse(config.gdriveServiceAccountJson);
      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
    } else if (config.gdriveCredentialsPath && fs.existsSync(config.gdriveCredentialsPath)) {
      auth = new google.auth.GoogleAuth({
        keyFile: config.gdriveCredentialsPath,
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
    } else if (config.gdriveClientEmail && config.gdrivePrivateKey) {
      auth = new google.auth.JWT({
        email: config.gdriveClientEmail,
        key: config.gdrivePrivateKey,
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
    }

    if (auth) {
      driveClient = google.drive({ version: 'v3', auth });
      return driveClient;
    }
  } catch (error) {
    console.error('Failed to initialize Google Drive client:', error);
  }

  return null;
}

/**
 * Upload recording to designated Google Drive folder
 */
export async function uploadToGoogleDrive(
  localFilePath: string,
  fileName: string,
  mimeType: string = 'audio/mp4',
  description?: string
): Promise<{ fileId: string; webViewLink?: string; webContentLink?: string } | null> {
  const drive = getDriveClient();
  if (!drive) return null;

  try {
    const fileMetadata: any = {
      name: fileName,
      parents: config.gdriveFolderId ? [config.gdriveFolderId] : undefined,
      description: description || 'CRM Call Recording',
    };

    const media = {
      mimeType: mimeType || 'audio/mp4',
      body: fs.createReadStream(localFilePath),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink',
    });

    const file = response.data;

    // Optional: make file readable with link
    try {
      await drive.permissions.create({
        fileId: file.id,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });
    } catch (permErr) {
      // Permission might be inherited from folder
    }

    return {
      fileId: file.id!,
      webViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
      webContentLink: file.webContentLink || undefined,
    };
  } catch (error) {
    console.error('Google Drive upload error:', error);
    return null;
  }
}

/**
 * Delete recording from Google Drive
 */
export async function deleteFromGoogleDrive(fileId: string): Promise<boolean> {
  const drive = getDriveClient();
  if (!drive || !fileId) return false;

  try {
    await drive.files.delete({ fileId });
    return true;
  } catch (err) {
    console.error(`Failed to delete Google Drive file (${fileId}):`, err);
    return false;
  }
}

/**
 * Stream audio file directly from Google Drive API to client response
 */
export async function streamFromGoogleDrive(fileId: string, res: Response): Promise<void> {
  const drive = getDriveClient();
  if (!drive) {
    res.status(500).json({ error: 'Google Drive is not configured.' });
    return;
  }

  try {
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    res.setHeader('Content-Type', 'audio/mp4');
    res.setHeader('Accept-Ranges', 'bytes');

    response.data
      .on('end', () => {})
      .on('error', (err: any) => {
        console.error('Stream error from Google Drive:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream audio from Google Drive.' });
        }
      })
      .pipe(res);
  } catch (err: any) {
    console.error('Failed to get file from Google Drive:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Error streaming from Google Drive.' });
    }
  }
}
