import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../utils/prisma.js';
import { Role, CallStatus } from '@prisma/client';

export class TeamController {
  /**
   * List all team members with their real-time call performance metrics
   */
  static async listMembers(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;

      const members = await prisma.user.findMany({
        where: { orgId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isOnLeave: true,
          createdAt: true,
          devices: {
            select: {
              id: true,
              deviceName: true,
              lastSyncAt: true,
              batteryLevel: true,
            },
          },
          calls: {
            select: {
              id: true,
              status: true,
              durationSec: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      // Format team members and compute individual call statistics
      const formatted = members.map((member) => {
        const totalCalls = member.calls.length;
        const connectedCalls = member.calls.filter((c) => c.status === CallStatus.CONNECTED).length;
        const missedCalls = member.calls.filter((c) => c.status === CallStatus.MISSED).length;
        const totalTalkTimeSec = member.calls.reduce((sum, c) => sum + (c.durationSec || 0), 0);
        const connectRate = totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0;

        return {
          id: member.id,
          name: member.name,
          email: member.email,
          phone: member.phone,
          role: member.role,
          isOnLeave: member.isOnLeave,
          createdAt: member.createdAt,
          hasPairedDevice: member.devices.length > 0,
          devices: member.devices,
          stats: {
            totalCalls,
            connectedCalls,
            missedCalls,
            totalTalkTimeSec,
            totalTalkTimeFormatted: `${Math.floor(totalTalkTimeSec / 60)}m ${totalTalkTimeSec % 60}s`,
            connectRate,
          },
        };
      });

      res.status(200).json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch team members.' });
    }
  }

  /**
   * Add a new agent or manager to the organization
   */
  static async addMember(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { name, email, password, phone, role } = req.body;

      if (!name || !email || !password) {
        res.status(400).json({ error: 'Name, email, and temporary password are required.' });
        return;
      }

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        res.status(409).json({ error: 'A user with this email address already exists.' });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userRole = role === 'ADMIN' ? Role.ADMIN : role === 'MANAGER' ? Role.MANAGER : Role.AGENT;

      // Generate initial pairing token for the Android app
      const pairingToken = crypto.randomBytes(16).toString('hex');

      const newUser = await prisma.user.create({
        data: {
          orgId,
          name,
          email,
          password: hashedPassword,
          phone,
          role: userRole,
          deviceToken: pairingToken,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isOnLeave: true,
          deviceToken: true,
          createdAt: true,
        },
      });

      res.status(201).json({
        message: 'Team member added successfully.',
        member: newUser,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to add team member.' });
    }
  }

  /**
   * Generate or reset mobile device pairing token for an agent
   */
  static async generatePairingToken(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const orgId = req.user!.orgId;

      const user = await prisma.user.findFirst({
        where: { id: userId, orgId },
      });

      if (!user) {
        res.status(404).json({ error: 'User not found in this organization.' });
        return;
      }

      const newPairingToken = crypto.randomBytes(16).toString('hex');

      await prisma.user.update({
        where: { id: user.id },
        data: { deviceToken: newPairingToken },
      });

      res.status(200).json({
        message: 'New pairing token generated.',
        deviceToken: newPairingToken,
        qrPayload: JSON.stringify({
          serverUrl: `${req.protocol}://${req.get('host')}`,
          deviceToken: newPairingToken,
          userEmail: user.email,
        }),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to generate pairing token.' });
    }
  }
}

