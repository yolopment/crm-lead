import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';

export class DeviceController {
  /**
   * Pair and register a mobile device using the agent's pairing token
   */
  static async pairDevice(req: Request, res: Response): Promise<void> {
    try {
      const {
        deviceToken,
        deviceHardwareId,
        brand,
        deviceName,
        androidVersion,
        appVersion,
        batteryLevel,
        isCharging,
        networkType,
        ipAddress,
        storageAccess,
        callLogAccess,
        batteryOptimized,
        recordingFolder,
      } = req.body;

      if (!deviceToken) {
        res.status(400).json({ error: 'Device pairing token is required.' });
        return;
      }

      // Find user by device pairing token
      const user = await prisma.user.findFirst({
        where: { deviceToken: deviceToken.trim() },
        include: { organization: true },
      });

      if (!user) {
        res.status(401).json({
          error: 'Invalid pairing token. Please check your token in CRM Settings > Team.',
        });
        return;
      }

      // Generate a stable hardware ID if none provided
      const hardwareId = deviceHardwareId || `hw-${user.id}-${(deviceName || 'android').toLowerCase().replace(/\s+/g, '-')}`;

      // Clean device name
      let cleanName = (deviceName || 'Android Companion Device').trim();
      let cleanBrand = (brand || '').trim();
      if (!cleanBrand && cleanName.includes(' ')) {
        cleanBrand = cleanName.split(' ')[0];
      }

      // Compute health state: if permissions are revoked, mark DEGRADED
      const isHealthy = storageAccess !== false && callLogAccess !== false;
      const state = isHealthy ? 'HEALTHY' : 'DEGRADED';

      // Upsert the device in PostgreSQL
      const device = await prisma.device.upsert({
        where: { deviceHardwareId: hardwareId },
        update: {
          brand: cleanBrand || undefined,
          deviceName: cleanName,
          androidVersion: androidVersion || undefined,
          appVersion: appVersion || undefined,
          batteryLevel: typeof batteryLevel === 'number' ? batteryLevel : undefined,
          isCharging: typeof isCharging === 'boolean' ? isCharging : undefined,
          networkType: networkType || undefined,
          ipAddress: ipAddress || undefined,
          storageAccess: typeof storageAccess === 'boolean' ? storageAccess : true,
          callLogAccess: typeof callLogAccess === 'boolean' ? callLogAccess : true,
          batteryOptimized: typeof batteryOptimized === 'boolean' ? batteryOptimized : false,
          recordingFolder: recordingFolder || 'Recordings/Call',
          state,
          recordingsWorking: true,
          lastSyncAt: new Date(),
          userId: user.id,
          orgId: user.orgId,
        },
        create: {
          deviceHardwareId: hardwareId,
          brand: cleanBrand || 'Android',
          deviceName: cleanName,
          androidVersion: androidVersion || 'Android',
          appVersion: appVersion || 'v1.7.54',
          batteryLevel: typeof batteryLevel === 'number' ? batteryLevel : 90,
          isCharging: typeof isCharging === 'boolean' ? isCharging : false,
          networkType: networkType || 'Wi-Fi',
          ipAddress: ipAddress || undefined,
          storageAccess: typeof storageAccess === 'boolean' ? storageAccess : true,
          callLogAccess: typeof callLogAccess === 'boolean' ? callLogAccess : true,
          batteryOptimized: typeof batteryOptimized === 'boolean' ? batteryOptimized : false,
          recordingFolder: recordingFolder || 'Recordings/Call',
          state,
          recordingsWorking: true,
          lastSyncAt: new Date(),
          userId: user.id,
          orgId: user.orgId,
        },
      });

      console.log(`📱 Device paired: "${device.deviceName}" for ${user.name} (${user.organization.name})`);

      res.status(200).json({
        success: true,
        message: `Device successfully paired to ${user.name}!`,
        device: {
          id: device.id,
          deviceName: device.deviceName,
          brand: device.brand,
          lastSyncAt: device.lastSyncAt,
          androidVersion: device.androidVersion,
          batteryLevel: device.batteryLevel,
          networkType: device.networkType,
        },
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          organization: user.organization.name,
        },
      });
    } catch (error: any) {
      console.error('Device pairing error:', error);
      res.status(500).json({ error: error.message || 'Failed to pair device.' });
    }
  }

  /**
   * Delete / Unpair a device
   */
  static async unpairDevice(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;

      await prisma.device.deleteMany({
        where: { id, orgId },
      });

      res.status(200).json({ success: true, message: 'Device unpaired successfully.' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to unpair device.' });
    }
  }

  /**
   * List all paired devices across the organization
   */
  static async listDevices(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;

      const devices = await prisma.device.findMany({
        where: { orgId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { lastSyncAt: 'desc' },
      });

      res.status(200).json(devices);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch devices.' });
    }
  }
}

