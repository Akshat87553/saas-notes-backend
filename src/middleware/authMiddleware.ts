// src/middleware/authMiddleware.ts
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
// src/middleware/authMiddleware.ts

import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Add a custom property to the Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        tenantId: string;
        role: string;
        plan: string;
      };
    }
  }
}

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    // split safely and ensure token is present
    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Not authorized, invalid authorization header' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET is not defined in environment variables.');
      return res.status(500).json({ message: 'Internal Server Error: Server configuration issue.' });
    }

    // Now token and secret are definitely strings — TS will be happy
    const decoded = jwt.verify(token, secret);

    // jwt.verify returns string | JwtPayload; guard and then cast
    if (typeof decoded === 'object' && decoded !== null && 'userId' in decoded) {
      const userId = (decoded as JwtPayload).userId as string;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { tenant: true },
      });

      if (!user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      req.user = {
        id: user.id,
        tenantId: user.tenantId,
        role: user.role,
        plan: user.tenant.plan,
      };

      return next();
    }

    return res.status(401).json({ message: 'Not authorized, invalid token payload' });
  } catch (err) {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

export const adminOnly = (req: Request, res: Response, next: NextFunction) => {
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden: Admins only' });
  }
};