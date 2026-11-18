import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../utils/prisma.js';
import { Role, CallStatus } from '@prisma/client';

export class TeamController {
  /**
   * List all team members with their real-time call performance metrics and pending invitations
   */
  static async listMembers(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;

      const [members, invitations] = await Promise.all([
        prisma.user.findMany({
          where: { orgId },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            isOnLeave: true,
            deviceToken: true,
            createdAt: true,
            devices: {
              select: {
                id: true,
                deviceName: true,
                brand: true,
                androidVersion: true,
                appVersion: true,
                state: true,
                recordingsWorking: true,
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
        }),
        prisma.invitation.findMany({
          where: { orgId },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      // Format team members and compute individual call statistics
      const formattedMembers = members.map((member) => {
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
          deviceSummary: member.devices.length > 0
            ? `${member.devices.length} device · ${member.devices[0].deviceName || 'Android'}`
            : null,
          deviceToken: member.deviceToken,
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

      const formattedInvites = invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role === 'ADMIN' ? 'Admin' : 'Caller',
        expiresFormatted: `expires ${new Date(inv.expiresAt).toLocaleDateString('en-GB')}`,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      }));

      // Return both arrays so legacy consumers still work or new tab consumer can read both
      res.status(200).json({
        members: formattedMembers,
        pendingInvitations: formattedInvites,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch team members.' });
    }
  }

  /**
   * Invite a new teammate by email (LeadZam screenshot 1)
   */
  static async inviteTeammate(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { email, role = 'AGENT' } = req.body;

      if (!email) {
        res.status(400).json({ error: 'Email address is required.' });
        return;
      }

      const cleanEmail = email.trim().toLowerCase();

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (existingUser) {
        res.status(409).json({ error: 'A team member with this email address already exists.' });
        return;
      }

      const token = crypto.randomBytes(16).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const invitation = await prisma.invitation.upsert({
        where: { orgId_email: { orgId, email: cleanEmail } },
        update: {
          role: role === 'ADMIN' ? Role.ADMIN : Role.AGENT,
          token,
          expiresAt,
        },
        create: {
          orgId,
          email: cleanEmail,
          role: role === 'ADMIN' ? Role.ADMIN : Role.AGENT,
          token,
          expiresAt,
        },
      });

      res.status(201).json({
        message: `Invitation sent to ${cleanEmail}.`,
        invitation,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to invite teammate.' });
    }
  }

  /**
   * Revoke a pending teammate invitation
   */
  static async revokeInvite(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;

      await prisma.invitation.deleteMany({
        where: { id, orgId },
      });

      res.status(200).json({ message: 'Invitation revoked.' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to revoke invitation.' });
    }
  }

  /**
   * Resend / extend a pending teammate invitation
   */
  static async resendInvite(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;

      const updated = await prisma.invitation.updateMany({
        where: { id, orgId },
        data: {
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      res.status(200).json({ message: 'Invitation resent.' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to resend invitation.' });
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
