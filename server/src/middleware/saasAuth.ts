import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { prisma } from '../utils/prisma.js';

export interface AuthenticatedSaasAdmin {
  id: string;
  email: string;
  name: string;
  saasRole: string;
}

declare global {
  namespace Express {
    interface Request {
      saasAdmin?: AuthenticatedSaasAdmin;
    }
  }
}

/**
 * Middleware to authenticate SaaS Super Admin requests via JWT
 */
export async function authenticateSaasAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
      return;
    }

    let decoded: { saasAdminId: string; saasRole: string };
    try {
      decoded = jwt.verify(token, config.jwtSecret) as { saasAdminId: string; saasRole: string };
    } catch {
      res.status(401).json({ error: 'Invalid or expired SaaS admin token.' });
      return;
    }

    if (!decoded || !decoded.saasAdminId) {
      res.status(401).json({ error: 'Invalid token payload.' });
      return;
    }

    const saasAdmin = await prisma.saasAdmin.findUnique({
      where: { id: decoded.saasAdminId },
      select: {
        id: true,
        email: true,
        name: true,
        saasRole: true,
      },
    });

    if (!saasAdmin) {
      res.status(401).json({ error: 'SaaS Admin account not found.' });
      return;
    }

    req.saasAdmin = saasAdmin;
    next();
  } catch (error) {
    console.error('[SaasAuth Error]:', error);
    res.status(500).json({ error: 'Internal server error during authentication.' });
  }
}

/**
 * Role-based access control middleware for SaaS Admins
 */
export function requireSaasRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.saasAdmin) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    if (!allowedRoles.includes(req.saasAdmin.saasRole)) {
      res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
      return;
    }

    next();
  };
}
