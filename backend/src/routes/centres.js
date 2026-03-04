const express = require('express');
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');

const router = express.Router();

// GET /api/centres
router.get('/', authenticate, async (req, res) => {
  try {
    const { branchId } = req.query;
    const where = { isActive: true };
    if (branchId) where.branchId = branchId;
    const memberCountFilter = req.user.role === 'STAFF' ? { staffId: req.user.id, isActive: true } : { isActive: true };
    const centres = await prisma.centre.findMany({
      where,
      include: {
        branch: true,
        _count: {
          select: {
            members: { where: memberCountFilter },
          },
        },
      },
      orderBy: { code: 'asc' },
    });
    res.json(centres);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch centres' });
  }
});

// POST /api/centres
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, branchId } = req.body;
    if (!name || !branchId) return res.status(400).json({ error: 'Name and branchId required' });
    const count = await prisma.centre.count();
    const code = `C${String(count + 1).padStart(2, '0')}`;
    const centre = await prisma.centre.create({ data: { code, name, branchId, createdById: req.user.id } });
    res.status(201).json(centre);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create centre' });
  }
});

// PUT /api/centres/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    const centre = await prisma.centre.findUnique({ where: { id: req.params.id } });
    if (!centre || !centre.isActive) return res.status(404).json({ error: 'Centre not found' });

    const canManage = req.user.role === 'ADMIN' || centre.createdById === req.user.id;
    if (!canManage) return res.status(403).json({ error: 'Only creator or admin can edit this centre' });

    const updated = await prisma.centre.update({
      where: { id: centre.id },
      data: { name },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update centre' });
  }
});

// DELETE /api/centres/:id (soft delete, only if empty)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const centre = await prisma.centre.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: {
            members: { where: { isActive: true } },
            loans: true,
          },
        },
      },
    });

    if (!centre || !centre.isActive) return res.status(404).json({ error: 'Centre not found' });

    const canManage = req.user.role === 'ADMIN' || centre.createdById === req.user.id;
    if (!canManage) return res.status(403).json({ error: 'Only creator or admin can delete this centre' });

    const isEmpty = (centre._count.members || 0) === 0 && (centre._count.loans || 0) === 0;
    if (!isEmpty) {
      return res.status(400).json({ error: 'Centre must be empty (no members or loans) before delete' });
    }

    await prisma.centre.update({ where: { id: centre.id }, data: { isActive: false } });
    res.json({ message: 'Centre deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete centre' });
  }
});

module.exports = router;
