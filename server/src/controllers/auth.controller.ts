import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { google } from 'googleapis';
import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { Role } from '@prisma/client';

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { organizationName, name, email, password, phone } = req.body;

      if (!organizationName || !name || !email || !password) {
        res.status(400).json({ error: 'Organization name, user name, email, and password are required.' });
        return;
      }

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        res.status(409).json({ error: 'An account with this email already exists.' });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const slug = organizationName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);

      const organization = await prisma.organization.create({
        data: {
          name: organizationName,
          slug,
          phone,
          users: {
            create: {
              name,
              email,
              password: hashedPassword,
              phone,
              role: Role.ADMIN,
            },
          },
        },
        include: {
          users: true,
        },
      });

      const user = organization.users[0];
      const token = jwt.sign(
        { userId: user.id, orgId: organization.id },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn as any }
      );

      res.status(201).json({
        message: 'Organization and admin account created successfully.',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isOnLeave: user.isOnLeave,
        },
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Internal server error during registration.' });
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required.' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { email },
        include: { organization: true },
      });

      if (!user) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }

      // Ensure user has a deviceToken for companion mobile app syncing
      let deviceToken = user.deviceToken;
      if (!deviceToken) {
        const crypto = await import('crypto');
        deviceToken = crypto.randomBytes(8).toString('hex');
        await prisma.user.update({
          where: { id: user.id },
          data: { deviceToken },
        });
      }

      const token = jwt.sign(
        { userId: user.id, orgId: user.orgId },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn as any }
      );

      res.status(200).json({
        message: 'Login successful.',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          deviceToken,
          isOnLeave: user.isOnLeave,
        },
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          slug: user.organization.slug,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Internal server error during login.' });
    }
  }

  static async googleAuth(req: Request, res: Response): Promise<void> {
    try {
      if (!config.googleOAuthClientId || !config.googleOAuthClientSecret) {
        res.redirect('/login?error=Google%20OAuth%20not%20configured%20on%20server');
        return;
      }

      const oauth2Client = new google.auth.OAuth2(
        config.googleOAuthClientId,
        config.googleOAuthClientSecret,
        config.googleAuthRedirectUri
      );

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
          'openid',
        ],
        prompt: 'select_account',
      });

      res.redirect(authUrl);
    } catch (error: any) {
      console.error('Error initiating Google OAuth:', error);
      res.redirect('/login?error=' + encodeURIComponent(error.message || 'Failed to initiate Google login'));
    }
  }

  static async googleAuthCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, error } = req.query;

      if (error) {
        res.redirect(`/login?error=${encodeURIComponent(String(error))}`);
        return;
      }

      if (!code || typeof code !== 'string') {
        res.redirect('/login?error=Missing%20authorization%20code');
        return;
      }

      const oauth2Client = new google.auth.OAuth2(
        config.googleOAuthClientId,
        config.googleOAuthClientSecret,
        config.googleAuthRedirectUri
      );

      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();

      const email = userInfo.data.email;
      const name = userInfo.data.name || email?.split('@')[0] || 'Google User';
      const picture = userInfo.data.picture;

      if (!email) {
        res.redirect('/login?error=Unable%20to%20retrieve%20email%20from%20Google');
        return;
      }

      // Check if user already exists
      let user: any = await prisma.user.findUnique({
        where: { email },
        include: { organization: true },
      });

      if (!user) {
        // Auto-provision Organization and User for first-time Google sign-in
        const randomPassword = crypto.randomBytes(16).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        const orgName = `${name}'s Workspace`;
        const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);
        const deviceToken = crypto.randomBytes(8).toString('hex');

        const organization = await prisma.organization.create({
          data: {
            name: orgName,
            slug,
            orgStatus: 'TRIAL',
            planTier: 'FREE',
            trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
            users: {
              create: {
                name,
                email,
                password: hashedPassword,
                role: Role.ADMIN,
                avatarUrl: picture,
                deviceToken,
              },
            },
          },
          include: {
            users: true,
          },
        });

        user = {
          ...organization.users[0],
          organization,
        } as any;
      } else {
        // Ensure user has deviceToken & updated avatar
        const updates: any = {};
        if (!user.avatarUrl && picture) updates.avatarUrl = picture;
        if (!user.deviceToken) {
          updates.deviceToken = crypto.randomBytes(8).toString('hex');
        }
        if (Object.keys(updates).length > 0) {
          user = (await prisma.user.update({
            where: { id: user.id },
            data: updates,
            include: { organization: true },
          })) as any;
        }
      }

      const token = jwt.sign(
        { userId: user.id, orgId: user.orgId },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn as any }
      );

      res.redirect(`/login?google_token=${encodeURIComponent(token)}`);
    } catch (error: any) {
      console.error('Error in Google OAuth callback:', error);
      res.redirect('/login?error=' + encodeURIComponent(error.message || 'Google sign in failed'));
    }
  }

  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        include: {
          organization: true,
          devices: true,
        },
      });

      if (!user) {
        res.status(404).json({ error: 'User profile not found.' });
        return;
      }

      const { password, ...safeUser } = user;

      // Compute trial days remaining
      const org = user.organization;
      let trialDaysRemaining: number | null = null;
      let subscriptionStatus = org.orgStatus as string;

      if (org.orgStatus === 'TRIAL' && org.trialEndsAt) {
        const msLeft = org.trialEndsAt.getTime() - Date.now();
        trialDaysRemaining = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
        if (trialDaysRemaining === 0) subscriptionStatus = 'EXPIRED';
      }

      res.status(200).json({
        ...safeUser,
        subscription: {
          status: subscriptionStatus,
          trialEndsAt: org.trialEndsAt,
          trialDaysRemaining,
          customPriceMonthly: (org as any).customPriceMonthly ?? null,
          customPriceYearly: (org as any).customPriceYearly ?? null,
          billingCycle: (org as any).billingCycle ?? null,
          maxUsers: org.maxUsers,
          maxLeads: org.maxLeads,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch user profile.' });
    }
  }

  /**
   * GET /api/v1/auth/subscription-status
   * Used by the Android companion app to show trial countdown
   */
  static async getSubscriptionStatus(req: Request, res: Response): Promise<void> {
    try {
      const org: any = await prisma.organization.findUnique({
        where: { id: req.user!.orgId },
        select: {
          id: true,
          name: true,
          orgStatus: true,
          trialEndsAt: true,
          maxUsers: true,
          maxLeads: true,
          storageQuotaBytes: true,
          storageUsedBytes: true,
          customPriceMonthly: true,
          customPriceYearly: true,
          billingCycle: true,
          activatedAt: true,
        } as any,
      });

      if (!org) {
        res.status(404).json({ error: 'Organization not found.' });
        return;
      }

      let trialDaysRemaining: number | null = null;
      let status = org.orgStatus as string;

      if (org.orgStatus === 'TRIAL' && org.trialEndsAt) {
        const msLeft = (org.trialEndsAt as Date).getTime() - Date.now();
        trialDaysRemaining = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
        if (trialDaysRemaining === 0) status = 'EXPIRED';
      }

      res.status(200).json({
        status,
        trialEndsAt: (org as any).trialEndsAt,
        trialDaysRemaining,
        customPriceMonthly: (org as any).customPriceMonthly ?? null,
        customPriceYearly: (org as any).customPriceYearly ?? null,
        billingCycle: (org as any).billingCycle ?? null,
        maxUsers: org.maxUsers,
        maxLeads: org.maxLeads,
        storageQuotaBytes: Number(org.storageQuotaBytes),
        storageUsedBytes: Number(org.storageUsedBytes),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch subscription status.' });
    }
  }

  static async toggleLeave(req: Request, res: Response): Promise<void> {
    try {
      const { isOnLeave } = req.body;
      const updatedUser = await prisma.user.update({
        where: { id: req.user!.id },
        data: {
          isOnLeave: typeof isOnLeave === 'boolean' ? isOnLeave : !req.user!.isOnLeave,
        },
        select: {
          id: true,
          name: true,
          email: true,
          isOnLeave: true,
        },
      });

      res.status(200).json({
        message: updatedUser.isOnLeave
          ? 'You are now marked as ON LEAVE. New leads will skip you.'
          : 'You are now marked as ACTIVE. New leads will be routed to you.',
        user: updatedUser,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update leave status.' });
    }
  }

  static async getInviteDetails(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      const invite = await prisma.invitation.findFirst({
        where: {
          OR: [{ token }, { id: token }],
        },
        include: { org: { select: { id: true, name: true } } },
      });

      if (!invite) {
        res.status(404).json({ error: 'Invitation not found or has been revoked.' });
        return;
      }

      if (new Date(invite.expiresAt) < new Date()) {
        res.status(410).json({ error: 'This invitation link has expired. Please ask your administrator to resend it.' });
        return;
      }

      res.status(200).json({
        email: invite.email,
        role: invite.role,
        organizationName: invite.org.name,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to verify invite.' });
    }
  }

  static async acceptInvite(req: Request, res: Response): Promise<void> {
    try {
      const { token, name, password, phone } = req.body;

      if (!token || !name || !password) {
        res.status(400).json({ error: 'Token, name, and password are required.' });
        return;
      }

      const invite = await prisma.invitation.findFirst({
        where: {
          OR: [{ token }, { id: token }],
        },
        include: { org: true },
      });

      if (!invite) {
        res.status(404).json({ error: 'Invitation link is invalid or already used.' });
        return;
      }

      if (new Date(invite.expiresAt) < new Date()) {
        res.status(410).json({ error: 'Invitation link has expired.' });
        return;
      }

      const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });
      if (existingUser) {
        res.status(409).json({ error: 'An account with this email address already exists.' });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const crypto = await import('crypto');
      const pairingToken = crypto.randomBytes(16).toString('hex');

      const user = await prisma.user.create({
        data: {
          orgId: invite.orgId,
          name,
          email: invite.email,
          password: hashedPassword,
          phone,
          role: invite.role,
          deviceToken: pairingToken,
        },
      });

      // Delete the used invitation
      await prisma.invitation.delete({
        where: { id: invite.id },
      });

      const authToken = jwt.sign(
        { userId: user.id, orgId: invite.orgId },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn as any }
      );

      res.status(201).json({
        message: 'Welcome! You have joined the workspace.',
        token: authToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          deviceToken: pairingToken,
        },
        organization: {
          id: invite.org.id,
          name: invite.org.name,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to accept invitation.' });
    }
  }
}
