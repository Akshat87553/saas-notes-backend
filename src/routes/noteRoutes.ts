// src/routes/noteRoutes.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();
const prisma = new PrismaClient();
const FREE_PLAN_NOTE_LIMIT = 3;

router.use(protect);

// create
router.post('/', async (req, res) => {
  try {
    const { title, content } = req.body;
    const { tenantId, id: authorId, role } = req.user!;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    // if tenant is FREE and user is not ADMIN, enforce tenant limit
    if (tenant.plan === 'FREE' && role !== 'ADMIN') {
      const noteCount = await prisma.note.count({ where: { tenantId } });
      if (noteCount >= FREE_PLAN_NOTE_LIMIT) {
        return res.status(403).json({ message: `Free plan limit of ${FREE_PLAN_NOTE_LIMIT} notes reached. Please ask an Admin to upgrade.` });
      }
    }

    const note = await prisma.note.create({
      data: { title, content, tenantId, authorId },
    });
    res.status(201).json(note);
  } catch (err) {
    console.error('Create note error', err);
    res.status(500).json({ message: 'Error creating note' });
  }
});

// list
router.get('/', async (req, res) => {
  try {
    const notes = await prisma.note.findMany({
      where: { tenantId: req.user!.tenantId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(notes);
  } catch (err) {
    console.error('Fetch notes error', err);
    res.status(500).json({ message: 'Error fetching notes' });
  }
});

// get single
router.get('/:id', async (req, res) => {
  try {
    const note = await prisma.note.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
    });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json(note);
  } catch (err) {
    console.error('Get note error', err);
    res.status(500).json({ message: 'Error retrieving note' });
  }
});

// update
router.put('/:id', async (req, res) => {
  const { title, content } = req.body;
  try {
    const result = await prisma.note.updateMany({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
      data: { title, content },
    });
    if (result.count === 0) return res.status(404).json({ message: 'Note not found or you lack permission' });
    const updated = await prisma.note.findUnique({ where: { id: req.params.id } });
    res.json(updated);
  } catch (err) {
    console.error('Update note error', err);
    res.status(500).json({ message: 'Error updating note' });
  }
});

// delete
router.delete('/:id', async (req, res) => {
  try {
    const result = await prisma.note.deleteMany({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
    });
    if (result.count === 0) return res.status(404).json({ message: 'Note not found or you lack permission' });
    res.status(204).send();
  } catch (err) {
    console.error('Delete note error', err);
    res.status(500).json({ message: 'Error deleting note' });
  }
});

export default router;
