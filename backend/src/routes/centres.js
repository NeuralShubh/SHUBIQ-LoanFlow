const express = require('express');
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');

const router = express.Router();
const CREATE_CENTRE_MAX_RETRIES = 5;

function isUniqueConstraintError(error, fieldName) {
  return Boolean(error && error.code === 'P2002' && Array.isArray(error.meta?.target) && error.meta.target.includes(fieldName));
}

async function getNextCentreCode() {
  const centres = await prisma.centre.findMany({
    where: { code: { startsWith: 'C' } },
    select: { code: true },
  });
  let maxNum = 0;
  for (const centre of centres) {
    const match = /^C(\d+)$/.exec(centre.code);
    if (!match) continue;
    const num = parseInt(match[1], 10);
    if (!Number.isNaN(num) && num > maxNum) maxNum = num;
  }
  return `C${String(maxNum + 1).padStart(2, '0')}`;
}

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
    const normalizedName = String(name).trim();
    if (!normalizedName) return res.status(400).json({ error: 'Name required' });

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, isActive: true },
    });
    if (!branch || !branch.isActive) return res.status(400).json({ error: 'Invalid branch' });

    for (let attempt = 1; attempt <= CREATE_CENTRE_MAX_RETRIES; attempt += 1) {
      const code = await getNextCentreCode();
      try {
        const centre = await prisma.centre.create({
          data: { code, name: normalizedName, branchId, createdById: req.user.id },
        });
        return res.status(201).json(centre);
      } catch (error) {
        if (isUniqueConstraintError(error, 'code') && attempt < CREATE_CENTRE_MAX_RETRIES) continue;
        throw error;
      }
    }
    return res.status(503).json({ error: 'Please retry centre creation' });
  } catch (error) {
    console.error(error);
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

// DELETE /api/centres/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const centre = await prisma.centre.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    if (!centre || !centre.isActive) return res.status(404).json({ error: 'Centre not found' });

    const canManage = req.user.role === 'ADMIN' || centre.createdById === req.user.id;
    if (!canManage) return res.status(403).json({ error: 'Only creator or admin can delete this centre' });

    const hasMembers = (centre._count.members || 0) > 0;
    if (hasMembers) {
      return res.status(400).json({ error: 'Centre must have no members before delete' });
    }

    await prisma.centre.update({ where: { id: centre.id }, data: { isActive: false } });
    res.json({ message: 'Centre deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete centre' });
  }
});

module.exports = router;
