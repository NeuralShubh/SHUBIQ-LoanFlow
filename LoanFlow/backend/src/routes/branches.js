const express = require('express');
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');

const router = express.Router();

// GET /api/branches
router.get('/', authenticate, async (req, res) => {
  try {
    const memberCountFilter = req.user.role === 'STAFF' ? { staffId: req.user.id, isActive: true } : { isActive: true };
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      include: {
        centres: { where: { isActive: true } },
        _count: {
          select: {
            members: { where: memberCountFilter },
            loans: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    });
    res.json(branches);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
});

// GET /api/branches/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const memberCountFilter = req.user.role === 'STAFF' ? { staffId: req.user.id, isActive: true } : { isActive: true };
    const branch = await prisma.branch.findUnique({
      where: { id: req.params.id },
      include: {
        centres: {
          where: { isActive: true },
          include: {
            _count: {
              select: {
                members: { where: memberCountFilter },
              },
            },
          },
        },
        _count: {
          select: {
            members: { where: memberCountFilter },
            loans: true,
          },
        },
      },
    });
    if (!branch) return res.status(404).json({ error: 'Branch not found' });
    res.json(branch);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch branch' });
  }
});

// POST /api/branches
router.post('/', authenticate, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Branch name required' });

    // Auto-generate code
    const count = await prisma.branch.count();
    const code = `B${String(count + 1).padStart(2, '0')}`;

    const branch = await prisma.branch.create({
      data: { code, name, createdById: req.user.id },
    });
    res.status(201).json(branch);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create branch' });
  }
});

// PUT /api/branches/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name } = req.body;
    const existing = await prisma.branch.findUnique({ where: { id: req.params.id } });
    if (!existing || !existing.isActive) return res.status(404).json({ error: 'Branch not found' });
    const canManage = req.user.role === 'ADMIN' || existing.createdById === req.user.id;
    if (!canManage) return res.status(403).json({ error: 'Only creator or admin can edit this branch' });

    const branch = await prisma.branch.update({
      where: { id: req.params.id },
      data: { name },
    });
    res.json(branch);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update branch' });
  }
});

// DELETE /api/branches/:id (soft delete, only if empty)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const branch = await prisma.branch.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: {
            centres: { where: { isActive: true } },
            members: { where: { isActive: true } },
            loans: true,
          },
        },
      },
    });

    if (!branch || !branch.isActive) return res.status(404).json({ error: 'Branch not found' });

    const canManage = req.user.role === 'ADMIN' || branch.createdById === req.user.id;
    if (!canManage) return res.status(403).json({ error: 'Only creator or admin can delete this branch' });

    const isEmpty = (branch._count.centres || 0) === 0 && (branch._count.members || 0) === 0 && (branch._count.loans || 0) === 0;
    if (!isEmpty) {
      return res.status(400).json({ error: 'Branch must be empty (no centres, members, or loans) before delete' });
    }

    await prisma.branch.update({ where: { id: branch.id }, data: { isActive: false } });
    res.json({ message: 'Branch deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete branch' });
  }
});

module.exports = router;
