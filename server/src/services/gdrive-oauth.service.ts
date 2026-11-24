import { Response } from 'express';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { encrypt, decrypt } from '../utils/encryption.js';

/**
 * Check if Google OAuth Client credentials are provided
 */
export function isOAuthAppConfigured(): boolean {
  return !!config.googleOAuthClientId && !!config.googleOAuthClientSecret;
}

/**
 * Create a new OAuth2 client instance
 */
export function getOAuth2Client() {
  return new google.auth.OAuth2(
    config.googleOAuthClientId,
    config.googleOAuthClientSecret,
    config.googleOAuthRedirectUri
  );
}

/**
 * Generate Google OAuth consent URL for a specific organization
 */
export function generateOAuthUrl(orgId: string): string {
  if (!isOAuthAppConfigured()) {
    throw new Error('Google OAuth credentials not configured in server environment.');
  }

  const oauth2Client = getOAuth2Client();

  const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    state: orgId, // State parameter securely ties callback to the requesting organization
  });
}

/**
 * Handle OAuth callback from Google: exchange code for tokens,
 * retrieve email, encrypt tokens, create CRM recordings folder, and update organization.
 */
export async function handleOAuthCallback(code: string, orgId: string): Promise<{ email: string; folderId: string }> {
  const oauth2Client = getOAuth2Client();

  // 1. Exchange authorization code for tokens
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  if (!tokens.access_token) {
    throw new Error('Failed to retrieve access token from Google.');
  }

  // 2. Fetch user's email address
  let googleEmail = 'unknown@gmail.com';
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    if (userInfo.data.email) {
      googleEmail = userInfo.data.email;
    }
  } catch (err) {
    console.warn('Could not retrieve user info from Google OAuth:', err);
  }

  // 3. Encrypt access and refresh tokens with AES-256-GCM
  const encryptedAccessToken = encrypt(tokens.access_token);
  const encryptedRefreshToken = tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined;
  const tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000);

  // 4. Create or locate the "CRM Call Recordings" folder in the client's Drive
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  let folderId = '';

  try {
    // Check if folder already exists
    const searchRes = await drive.files.list({
      q: "name = 'CRM Call Recordings' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (searchRes.data.files && searchRes.data.files.length > 0) {
      folderId = searchRes.data.files[0].id!;
      console.log(`📁 Located existing Google Drive folder: ${folderId}`);
    } else {
      // Create new folder
      const folderRes = await drive.files.create({
        requestBody: {
          name: 'CRM Call Recordings',
          mimeType: 'application/vnd.google-apps.folder',
          description: 'Auto-synced call recordings from CRM-LEAD Companion App',
        },
        fields: 'id',
      });
      folderId = folderRes.data.id!;
      console.log(`📁 Created new Google Drive folder: ${folderId}`);
    }
  } catch (driveErr) {
    console.error('Error creating CRM folder in client Drive:', driveErr);
  }

  // 5. Update Organization record in database
  const updateData: any = {
    gdriveAccessToken: encryptedAccessToken,
    gdriveTokenExpiry: tokenExpiry,
    gdriveEmail: googleEmail,
    gdriveConnectedAt: new Date(),
    orgStorageDriver: 'gdrive_oauth',
  };

  if (encryptedRefreshToken) {
    updateData.gdriveRefreshToken = encryptedRefreshToken;
  }
  if (folderId) {
    updateData.gdriveFolderId = folderId;
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: updateData,
  });

  return {
    email: googleEmail,
    folderId,
  };
}

/**
 * Get authenticated Google Drive client for a specific organization using stored OAuth tokens
 */
export async function getClientDrive(orgId: string): Promise<{ drive: any; folderId: string | null } | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      gdriveAccessToken: true,
      gdriveRefreshToken: true,
      gdriveTokenExpiry: true,
      gdriveFolderId: true,
      orgStorageDriver: true,
    },
  });

  if (!org || !org.gdriveAccessToken) {
    return null;
  }

  try {
    const oauth2Client = getOAuth2Client();

    const accessToken = decrypt(org.gdriveAccessToken);
    const refreshToken = org.gdriveRefreshToken ? decrypt(org.gdriveRefreshToken) : undefined;

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: org.gdriveTokenExpiry ? new Date(org.gdriveTokenExpiry).getTime() : undefined,
    });

    // Auto-persist refreshed tokens when Google SDK updates them
    oauth2Client.on('tokens', async (newTokens) => {
      try {
        const dataToUpdate: any = {};
        if (newTokens.access_token) {
          dataToUpdate.gdriveAccessToken = encrypt(newTokens.access_token);
        }
        if (newTokens.refresh_token) {
          dataToUpdate.gdriveRefreshToken = encrypt(newTokens.refresh_token);
        }
        if (newTokens.expiry_date) {
          dataToUpdate.gdriveTokenExpiry = new Date(newTokens.expiry_date);
        }

        if (Object.keys(dataToUpdate).length > 0) {
          await prisma.organization.update({
            where: { id: orgId },
            data: dataToUpdate,
          });
          console.log(`🔄 Automatically refreshed OAuth tokens for organization ${orgId}`);
        }
      } catch (saveErr) {
        console.error('Failed to save refreshed OAuth tokens:', saveErr);
      }
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    return {
      drive,
      folderId: org.gdriveFolderId,
    };
  } catch (err) {
    console.error(`Error initializing client Google Drive for org ${orgId}:`, err);
    return null;
  }
}

/**
 * Upload a call recording directly into the client's own Google Drive folder
 */
export async function uploadCallToClientDrive(
  orgId: string,
  localFilePath: string,
  fileName: string,
  mimeType: string = 'audio/mp4',
  description?: string
): Promise<{ fileId: string; webViewLink?: string; webContentLink?: string } | null> {
  const clientDriveData = await getClientDrive(orgId);
  if (!clientDriveData) return null;

  const { drive, folderId } = clientDriveData;

  try {
    const fileMetadata: any = {
      name: fileName,
      parents: folderId ? [folderId] : undefined,
      description: description || 'CRM-LEAD Call Recording',
    };

    const media = {
      mimeType: mimeType || 'audio/mp4',
      body: fs.createReadStream(localFilePath),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, name, webViewLink, webContentLink',
    });

    const file = response.data;

    // Optional: add reader permission so link can be accessed seamlessly
    try {
      await drive.permissions.create({
        fileId: file.id,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });
    } catch {
      // Permission might be inherited from parent folder
    }

    return {
      fileId: file.id!,
      webViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
      webContentLink: file.webContentLink || undefined,
    };
  } catch (err) {
    console.error(`Failed to upload recording to client Drive (org ${orgId}):`, err);
    return null;
  }
}

/**
 * Stream a call recording directly from client Google Drive API to Express response
 */
export async function streamCallFromClientDrive(
  orgId: string,
  fileId: string,
  res: Response
): Promise<boolean> {
  const clientDriveData = await getClientDrive(orgId);
  if (!clientDriveData) return false;

  const { drive } = clientDriveData;
  try {
    let mimeType = 'audio/mp4';
    let fileSize: number | undefined;

    try {
      const meta = await drive.files.get({
        fileId,
        fields: 'mimeType, size, name',
      });
      if (meta.data.mimeType && meta.data.mimeType !== 'application/octet-stream') {
        mimeType = meta.data.mimeType;
      }
      if (meta.data.size) {
        fileSize = parseInt(meta.data.size, 10);
      }
    } catch (metaErr) {
      // Fallback to audio/mp4
    }

    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    if (fileSize && !isNaN(fileSize)) {
      res.setHeader('Content-Length', fileSize.toString());
    }

    response.data
      .on('error', (err: any) => {
        console.error('Error in Client Google Drive audio stream:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream audio from Google Drive.' });
        }
      })
      .pipe(res);

    return true;
  } catch (err: any) {
    console.error(`Failed to stream file ${fileId} from client Drive (org ${orgId}):`, err);
    return false;
  }
}

/**
 * Super Admin Master Google Drive Storage Functions (Multi-Account Cluster)
 */
export async function getMasterDriveStatus() {
  const isConfigured = isOAuthAppConfigured();
  
  // 1. Fetch all connected master storage accounts
  const accounts = await prisma.masterStorageAccount.findMany({
    orderBy: { priority: 'asc' },
  });

  if (!accounts || accounts.length === 0) {
    return {
      isConnected: false,
      isOAuthConfigured: isConfigured,
      email: null,
      folderId: null,
      folderUrl: null,
      connectedAt: null,
      totalLimitBytes: 0,
      totalUsageBytes: 0,
      availableBytes: 0,
      usageInDriveBytes: 0,
      accounts: [],
    };
  }

  // 2. Fetch live Google Drive quotas for all accounts in parallel
  let clusterLimitBytes = 0;
  let clusterUsageBytes = 0;
  let clusterAvailableBytes = 0;

  const accountsWithQuotas = await Promise.all(
    accounts.map(async (acc) => {
      let limit = Number(acc.totalLimitBytes);
      let usage = Number(acc.totalUsageBytes);
      let available = Number(acc.availableBytes);

      try {
        const client = await getClientForMasterAccount(acc);
        if (client?.drive) {
          const aboutRes = await client.drive.about.get({ fields: 'storageQuota, user' });
          const q = aboutRes.data.storageQuota;
          if (q) {
            limit = Number(q.limit) || limit;
            usage = Number(q.usage) || 0;
            available = Math.max(0, limit - usage);

            // Update database snapshot asynchronously
            prisma.masterStorageAccount.update({
              where: { id: acc.id },
              data: {
                totalLimitBytes: BigInt(limit),
                totalUsageBytes: BigInt(usage),
                availableBytes: BigInt(available),
              },
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn(`Failed to refresh live quota for master account ${acc.email}:`, err);
      }

      clusterLimitBytes += limit;
      clusterUsageBytes += usage;
      clusterAvailableBytes += available;

      return {
        id: acc.id,
        email: acc.email,
        name: acc.name || acc.email.split('@')[0],
        status: acc.status,
        priority: acc.priority,
        folderId: acc.folderId,
        folderUrl: acc.folderUrl,
        totalLimitBytes: limit,
        totalUsageBytes: usage,
        availableBytes: available,
        connectedAt: acc.connectedAt,
      };
    })
  );

  const primary = accountsWithQuotas[0];

  return {
    isConnected: true,
    isOAuthConfigured: isConfigured,
    email: primary?.email || null,
    folderId: primary?.folderId || null,
    folderUrl: primary?.folderUrl || null,
    connectedAt: primary?.connectedAt || null,
    totalLimitBytes: clusterLimitBytes,
    totalUsageBytes: clusterUsageBytes,
    availableBytes: clusterAvailableBytes,
    accountsCount: accountsWithQuotas.length,
    accounts: accountsWithQuotas,
  };
}

export async function disconnectMasterDrive(accountId?: string): Promise<boolean> {
  try {
    if (accountId) {
      await prisma.masterStorageAccount.delete({
        where: { id: accountId },
      });
    } else {
      await prisma.masterStorageAccount.deleteMany();
      await prisma.systemSetting.deleteMany({
        where: { key: 'MASTER_GDRIVE_CONFIG' },
      });
    }
    return true;
  } catch (err) {
    console.error('Failed to disconnect master Google Drive:', err);
    return false;
  }
}

export async function handleMasterOAuthCallback(code: string): Promise<{ email: string; folderId: string }> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  if (!tokens.access_token) {
    throw new Error('Failed to retrieve access token from Google.');
  }

  let googleEmail = 'unknown@gmail.com';
  let displayName = 'Google Account';
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    if (userInfo.data.email) {
      googleEmail = userInfo.data.email;
      displayName = userInfo.data.name || googleEmail.split('@')[0];
    }
  } catch (err) {
    console.warn('Could not retrieve user info from Google OAuth for Master:', err);
  }

  const encryptedAccessToken = encrypt(tokens.access_token);
  const encryptedRefreshToken = tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined;
  const tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000);

  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  let folderId = '';

  try {
    const searchRes = await drive.files.list({
      q: "name = 'CRM-LEAD Master Recordings' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (searchRes.data.files && searchRes.data.files.length > 0) {
      folderId = searchRes.data.files[0].id!;
      console.log(`📁 Located existing Master Google Drive folder for ${googleEmail}: ${folderId}`);
    } else {
      const folderRes = await drive.files.create({
        requestBody: {
          name: 'CRM-LEAD Master Recordings',
          mimeType: 'application/vnd.google-apps.folder',
          description: 'Master central storage pool for CRM-LEAD SaaS audio recordings',
        },
        fields: 'id',
      });
      folderId = folderRes.data.id!;
      console.log(`📁 Created new Master Google Drive folder for ${googleEmail}: ${folderId}`);
    }
  } catch (driveErr) {
    console.error(`Error creating Master CRM folder for ${googleEmail}:`, driveErr);
  }

  // Get quota information
  let limit = BigInt(5497558138880);
  let usage = BigInt(0);
  let available = limit;
  try {
    const aboutRes = await drive.about.get({ fields: 'storageQuota' });
    if (aboutRes.data.storageQuota) {
      limit = BigInt(aboutRes.data.storageQuota.limit || '5497558138880');
      usage = BigInt(aboutRes.data.storageQuota.usage || '0');
      available = limit > usage ? limit - usage : BigInt(0);
    }
  } catch {}

  const count = await prisma.masterStorageAccount.count();
  const folderUrl = folderId ? `https://drive.google.com/drive/folders/${folderId}` : null;

  await prisma.masterStorageAccount.upsert({
    where: { email: googleEmail },
    create: {
      email: googleEmail,
      name: displayName,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiry,
      folderId,
      folderUrl,
      totalLimitBytes: limit,
      totalUsageBytes: usage,
      availableBytes: available,
      status: 'ACTIVE',
      priority: count + 1,
      connectedAt: new Date(),
    },
    update: {
      name: displayName,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiry,
      folderId,
      folderUrl,
      totalLimitBytes: limit,
      totalUsageBytes: usage,
      availableBytes: available,
      status: 'ACTIVE',
    },
  });

  return {
    email: googleEmail,
    folderId,
  };
}

/**
 * Get authenticated Google Drive client for a specific MasterStorageAccount
 */
export async function getClientForMasterAccount(account: any): Promise<{ drive: any; masterFolderId: string } | null> {
  try {
    const oauth2Client = getOAuth2Client();
    let accessToken = decrypt(account.accessToken);
    const refreshToken = account.refreshToken ? decrypt(account.refreshToken) : undefined;
    const isExpired = account.tokenExpiry ? new Date(account.tokenExpiry).getTime() <= Date.now() + 60 * 1000 : true;

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (isExpired && refreshToken) {
      const refreshed = await oauth2Client.refreshAccessToken();
      accessToken = refreshed.credentials.access_token!;
      const newExpiry = refreshed.credentials.expiry_date
        ? new Date(refreshed.credentials.expiry_date)
        : new Date(Date.now() + 3600 * 1000);

      await prisma.masterStorageAccount.update({
        where: { id: account.id },
        data: {
          accessToken: encrypt(accessToken),
          tokenExpiry: newExpiry,
        },
      });
      oauth2Client.setCredentials(refreshed.credentials);
    }

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    return { drive, masterFolderId: account.folderId };
  } catch (err) {
    console.error(`Failed to get client for master account ${account.email}:`, err);
    return null;
  }
}

/**
 * Get active master drive client with available storage (Auto-Spillover & Load Balancing)
 */
export async function getMasterDriveClient(): Promise<{ drive: any; masterFolderId: string; accountId: string } | null> {
  const accounts = await prisma.masterStorageAccount.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { priority: 'asc' },
  });

  if (!accounts || accounts.length === 0) return null;

  // Find the first account with at least 100 MB available space (Auto-Spillover)
  for (const account of accounts) {
    if (Number(account.availableBytes) > 100 * 1024 * 1024) {
      const client = await getClientForMasterAccount(account);
      if (client) {
        return { ...client, accountId: account.id };
      }
    }
  }

  // Fallback to highest priority account
  const fallbackClient = await getClientForMasterAccount(accounts[0]);
  if (fallbackClient) {
    return { ...fallbackClient, accountId: accounts[0].id };
  }
  return null;
}

/**
 * Upload call recording to Master Google Drive in an isolated tenant subfolder
 */
export async function uploadCallToMasterDrive(
  orgId: string,
  orgName: string,
  filePath: string,
  fileName: string,
  mimeType: string = 'audio/mp4'
): Promise<{ fileId: string; webViewLink: string; webContentLink?: string; accountId?: string } | null> {
  const master = await getMasterDriveClient();
  if (!master) return null;

  try {
    const { drive, masterFolderId, accountId } = master;
    const sanitizedOrgName = orgName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const orgSubfolderName = `${sanitizedOrgName} (${orgId.substring(0, 8)})`;

    // 1. Locate or create org subfolder inside Master folder
    let orgFolderId = masterFolderId;
    if (masterFolderId) {
      const searchRes = await drive.files.list({
        q: `'${masterFolderId}' in parents and name = '${orgSubfolderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (searchRes.data.files && searchRes.data.files.length > 0) {
        orgFolderId = searchRes.data.files[0].id!;
      } else {
        const createRes = await drive.files.create({
          requestBody: {
            name: orgSubfolderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [masterFolderId],
          },
          fields: 'id',
        });
        orgFolderId = createRes.data.id!;
      }
    }

    // 2. Upload the audio file into the org subfolder
    const fileStream = fs.createReadStream(filePath);
    const parents = orgFolderId ? [orgFolderId] : undefined;

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents,
        mimeType,
      },
      media: {
        mimeType,
        body: fileStream,
      },
      fields: 'id, name, webViewLink, webContentLink',
    });

    const file = response.data;
    return {
      fileId: file.id!,
      webViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
      webContentLink: file.webContentLink || undefined,
      accountId,
    };
  } catch (err) {
    console.error(`Failed to upload recording to Master Drive for org ${orgId}:`, err);
    return null;
  }
}

/**
 * Stream a call recording directly from Super Admin Master Google Drive cluster to Express response
 */
export async function streamCallFromMasterDrive(
  fileId: string,
  res: Response
): Promise<boolean> {
  const accounts = await prisma.masterStorageAccount.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { priority: 'asc' },
  });

  if (!accounts || accounts.length === 0) return false;

  for (const account of accounts) {
    try {
      const client = await getClientForMasterAccount(account);
      if (!client) continue;

      const { drive } = client;
      let mimeType = 'audio/mp4';
      let fileSize: number | undefined;

      try {
        const meta = await drive.files.get({
          fileId,
          fields: 'mimeType, size, name',
        });
        if (meta.data.mimeType && meta.data.mimeType !== 'application/octet-stream') {
          mimeType = meta.data.mimeType;
        }
        if (meta.data.size) {
          fileSize = parseInt(meta.data.size, 10);
        }
      } catch {
        // If file not found in this account, try next account
        continue;
      }

      const response = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Accept-Ranges', 'bytes');
      if (fileSize && !isNaN(fileSize)) {
        res.setHeader('Content-Length', fileSize.toString());
      }

      response.data
        .on('error', (err: any) => {
          console.error('Error in Master Google Drive audio stream:', err);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to stream audio from Master Drive.' });
          }
        })
        .pipe(res);

      return true;
    } catch {
      // Continue to next master account
    }
  }

  return false;
}

/**
 * Disconnect Google Drive from client organization
 */
export async function disconnectClientDrive(orgId: string): Promise<boolean> {
  try {
    await prisma.organization.update({
      where: { id: orgId },
      data: {
        gdriveAccessToken: null,
        gdriveRefreshToken: null,
        gdriveTokenExpiry: null,
        gdriveEmail: null,
        gdriveFolderId: null,
        gdriveConnectedAt: null,
        orgStorageDriver: 'local',
      },
    });
    return true;
  } catch (err) {
    console.error(`Failed to disconnect Google Drive for org ${orgId}:`, err);
    return false;
  }
}

/**
 * Get current Google Drive connection status for client settings page
 */
export async function getClientDriveStatus(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      orgStorageDriver: true,
      gdriveEmail: true,
      gdriveFolderId: true,
      gdriveConnectedAt: true,
      storageUsedBytes: true,
      storageQuotaBytes: true,
      gdriveAccessToken: true,
    },
  });

  if (!org) {
    return { isConnected: false };
  }

  const hasLinkedGoogle = !!org.gdriveEmail && !!org.gdriveAccessToken;
  const isUsingOwnGoogle = hasLinkedGoogle && org.orgStorageDriver === 'gdrive_oauth';

  let googleTotalLimitBytes = 15 * 1024 * 1024 * 1024; // 15 GB default
  let googleTotalUsageBytes = 0;
  let googleAvailableBytes = googleTotalLimitBytes;
  let googleUsageInDriveBytes = 0;

  // If connected, query Google Drive API for the REAL live storage quota of this Google Account
  if (hasLinkedGoogle) {
    try {
      const clientData = await getClientDrive(orgId);
      if (clientData?.drive) {
        const aboutRes = await clientData.drive.about.get({ fields: 'storageQuota, user' });
        const q = aboutRes.data.storageQuota;
        if (q) {
          googleTotalLimitBytes = Number(q.limit) || googleTotalLimitBytes;
          googleTotalUsageBytes = Number(q.usage) || 0;
          googleUsageInDriveBytes = Number(q.usageInDrive) || 0;
          googleAvailableBytes = Math.max(0, googleTotalLimitBytes - googleTotalUsageBytes);
        }
      }
    } catch (quotaErr) {
      console.warn(`Could not fetch live Google Drive quota for org ${orgId}:`, quotaErr);
    }
  }

  return {
    isConnected: hasLinkedGoogle,
    isUsingOwnGoogle,
    storageDestination: isUsingOwnGoogle ? 'OWN_GDRIVE' : 'PLATFORM',
    provider: org.orgStorageDriver,
    email: org.gdriveEmail,
    folderId: org.gdriveFolderId,
    folderUrl: org.gdriveFolderId ? `https://drive.google.com/drive/folders/${org.gdriveFolderId}` : null,
    connectedAt: org.gdriveConnectedAt,
    storageUsedBytes: Number(org.storageUsedBytes), // CRM audio recordings bytes tracked
    storageQuotaBytes: Number(org.storageQuotaBytes), // Platform plan quota
    googleTotalLimitBytes, // Real live Google account capacity (e.g. 15 GB or 5 TB)
    googleTotalUsageBytes, // Real live total used by Gmail, Drive, Photos
    googleAvailableBytes,  // Real live available free space in Google account
    googleUsageInDriveBytes,
    isOAuthConfigured: isOAuthAppConfigured(),
  };
}

/**
 * Switch storage destination for an organization
 * 'PLATFORM' -> Use CRM platform cloud storage pool (quota managed by superadmin)
 * 'OWN_GDRIVE' -> Use organization's connected Google Drive account
 */
export async function setStorageDestination(orgId: string, destination: 'PLATFORM' | 'OWN_GDRIVE'): Promise<{ success: boolean; destination: string }> {
  if (destination === 'OWN_GDRIVE') {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { gdriveEmail: true, gdriveAccessToken: true },
    });

    if (!org?.gdriveAccessToken) {
      throw new Error('Please connect your Google Drive account first before selecting this option.');
    }

    await prisma.organization.update({
      where: { id: orgId },
      data: { orgStorageDriver: 'gdrive_oauth' },
    });
    return { success: true, destination: 'OWN_GDRIVE' };
  } else {
    // Switch to platform storage
    await prisma.organization.update({
      where: { id: orgId },
      data: { orgStorageDriver: 'local' },
    });
    return { success: true, destination: 'PLATFORM' };
  }
}
