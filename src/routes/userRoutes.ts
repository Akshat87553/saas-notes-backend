// backend/src/routes/userRoutes.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /users
 * Returns list of users belonging to the authenticated user's tenant.
 * Protected route (any authenticated user can view the tenant's users).
 */
router.get('/', protect, async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant context missing' });
    }

    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, email: true, role: true },
      orderBy: { email: 'asc' },
    });

    res.json(users);
  } catch (err) {
    console.error('GET /users error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /users/invite
 * Invite a new user to the current tenant (Admins only).
 * For this assignment we return a temporary password in the response.
 */
router.post('/invite', protect, adminOnly, async (req, res) => {
  try {
    const { email } = req.body;
    const { tenantId } = req.user!;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Please provide a valid email for the new user' });
    }

    // normalize email (basic)
    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(400).json({ message: 'A user with this email already exists' });
    }

    // Temporary password for invited user (assignment/testing convenience).
    // NOTE: In production, generate a secure random token and email a one-time link instead.
    const tempPassword = 'password';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        role: 'MEMBER', // Invited users are always Members
        tenantId,
      },
      select: { id: true, email: true, role: true },
    });

    res.status(201).json({
      message: 'User invited successfully.',
      user: newUser,
      // IMPORTANT: Only for this assignment. Do not send passwords in real apps.
      temporaryPassword: tempPassword,
    });
  } catch (err) {
    console.error('POST /users/invite error', err);
    res.status(500).json({ message: 'Internal server error while inviting user' });
  }
});

export default router;
