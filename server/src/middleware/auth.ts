import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { prisma } from '../utils/prisma.js';
import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  orgId: string;
  email: string;
  role: Role;
  name: string;
  isOnLeave: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const deviceTokenHeader = (req.headers['x-device-token'] as string | undefined) ||
      (req.headers['x-pairing-token'] as string | undefined) ||
      (authHeader?.startsWith('Device ') ? authHeader.substring(7).trim() : undefined);

    // Check device token from Android companion app
    if (deviceTokenHeader) {
      const user = await prisma.user.findFirst({
        where: { deviceToken: deviceTokenHeader },
        select: {
          id: true,
          orgId: true,
          email: true,
          role: true,
          name: true,
          isOnLeave: true,
        },
      });

      if (!user) {
        res.status(401).json({ error: 'Invalid device token. Please re-pair your Android device.' });
        return;
      }

      req.user = user;
      next();
      return;
    }

    // Check JWT token in query param (used for audio streaming URLs)
    const queryToken = req.query.token as string | undefined;

    // Check JWT bearer token
    const rawToken = queryToken || (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

    if (!rawToken) {
      res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
      return;
    }

    const token = rawToken;
    let decoded: { userId: string; orgId: string } | null = null;
    try {
      decoded = jwt.verify(token, config.jwtSecret) as { userId: string; orgId: string };
    } catch (e) {
      // Fallback: check if rawToken is a companion device token
      const userByDeviceToken = await prisma.user.findFirst({
        where: { deviceToken: token },
        select: {
          id: true,
          orgId: true,
          email: true,
          role: true,
          name: true,
          isOnLeave: true,
        },
      });
      if (userByDeviceToken) {
        req.user = userByDeviceToken;
        next();
        return;
      }
      throw e;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        orgId: true,
        email: true,
        role: true,
        name: true,
        isOnLeave: true,
      },
    });

    if (!user) {
      res.status(401).json({ error: 'User account not found.' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export function requireRole(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
      return;
    }

    next();
  };
}

