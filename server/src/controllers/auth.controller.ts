import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
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
      res.status(200).json(safeUser);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch user profile.' });
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
}
