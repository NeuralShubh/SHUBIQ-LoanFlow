const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const MEMBER_STATUSES = new Set(['ACTIVE', 'INACTIVE', 'SUSPENDED']);


// GET /api/members
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, branchId, centreId, status } = req.query;
    const where = { isActive: true };
    if (req.user.role === 'STAFF') where.staffId = req.user.id;
    if (branchId) where.branchId = branchId;
    if (centreId) where.centreId = centreId;
    const normalizedStatus = String(status || '').toUpperCase();
    if (normalizedStatus && MEMBER_STATUSES.has(normalizedStatus)) where.status = normalizedStatus;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { memberId: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const members = await prisma.member.findMany({
      where,
      include: {
        branch: true,
        centre: true,
        staff: { select: { id: true, name: true } },
        loans: {
          where: { status: { in: ['ACTIVE', 'OVERDUE'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(members);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// GET /api/members/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const where = { id: req.params.id, isActive: true };
    if (req.user.role === 'STAFF') where.staffId = req.user.id;

    const member = await prisma.member.findFirst({
      where,
      include: {
        branch: true,
        centre: true,
        staff: { select: { id: true, name: true } },
        loans: {
          include: {
            emis: { orderBy: { emiNumber: 'asc' } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!member) return res.status(404).json({ error: 'Member not found' });
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch member' });
  }
});

// POST /api/members
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, phone, aadhar, area, branchId, centreId } = req.body;
    if (!name || !phone || !branchId || !centreId) {
      return res.status(400).json({ error: 'Name, phone, branch, and centre are required' });
    }

    const count = await prisma.member.count();
    const memberId = `M${String(count + 1).padStart(3, '0')}`;
    const staffId = req.user.role === 'STAFF' ? req.user.id : null;

    const member = await prisma.member.create({
      data: { memberId, name, phone, aadhar, area, branchId, centreId, staffId },
      include: { branch: true, centre: true },
    });
    res.status(201).json(member);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create member' });
  }
});

// PUT /api/members/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name, phone, aadhar, area, status } = req.body;
    const where = { id: req.params.id, isActive: true };
    if (req.user.role === 'STAFF') where.staffId = req.user.id;

    const existing = await prisma.member.findFirst({ where, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Member not found' });

    const member = await prisma.member.update({
      where: { id: existing.id },
      data: { name, phone, aadhar, area, ...(status && { status: status.toUpperCase() }) },
      include: { branch: true, centre: true },
    });
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// DELETE /api/members/:id (soft delete)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const where = { id: req.params.id, isActive: true };
    if (req.user.role === 'STAFF') where.staffId = req.user.id;

    const existing = await prisma.member.findFirst({ where, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Member not found' });

    await prisma.member.update({ where: { id: existing.id }, data: { isActive: false } });
    res.json({ message: 'Member deactivated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to deactivate member' });
  }
});

module.exports = router;

