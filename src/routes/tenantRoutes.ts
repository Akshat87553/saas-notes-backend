// src/routes/tenantRoutes.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = Router();
const prisma = new PrismaClient();

// get tenant info for the current authenticated user
router.get('/me', protect, async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const noteCount = await prisma.note.count({ where: { tenantId } });
    res.json({ slug: tenant.slug, plan: tenant.plan, noteCount });
  } catch (err) {
    console.error('GET /tenants/me', err);
    res.status(500).json({ message: 'Internal error' });
  }
});

// upgrade tenant plan to PRO (admin only)
router.post('/:slug/upgrade', protect, adminOnly, async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) return res.status(400).json({ message: 'Missing slug' });

    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    // ensure requesting admin belongs to this tenant
    if (tenant.id !== req.user!.tenantId) {
      return res.status(403).json({ message: "Forbidden: you can only upgrade your tenant" });
    }

    if (tenant.plan === 'PRO') {
      return res.status(400).json({ message: 'Tenant already PRO' });
    }

    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { plan: 'PRO' },
    });

    // immediate effect: plan is stored as PRO and subsequent note creates will be unlimited
    res.json({ message: 'Plan upgraded to PRO', tenant: updated });
  } catch (err) {
    console.error('POST /tenants/:slug/upgrade', err);
    res.status(500).json({ message: 'Internal error upgrading tenant' });
  }
});

router.post('/:slug/downgrade', protect, adminOnly, async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) return res.status(400).json({ message: 'Missing slug' });

    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    // ensure requesting admin belongs to this tenant
    if (tenant.id !== req.user!.tenantId) {
      return res.status(403).json({ message: "Forbidden: you can only downgrade your own tenant" });
    }

    if (tenant.plan === 'FREE') {
      return res.status(400).json({ message: 'Tenant is already on FREE plan' });
    }

    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { plan: 'FREE' },
    });

    // immediate effect: plan stored as FREE
    res.json({ message: 'Plan downgraded to FREE', tenant: updated });
  } catch (err) {
    console.error('POST /tenants/:slug/downgrade', err);
    res.status(500).json({ message: 'Internal error downgrading tenant' });
  }
});

export default router;
