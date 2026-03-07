const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const MEMBER_STATUSES = new Set(['ACTIVE', 'INACTIVE', 'SUSPENDED']);
const CREATE_MEMBER_MAX_RETRIES = 5;

function isUniqueConstraintError(error, fieldName) {
  return Boolean(error && error.code === 'P2002' && Array.isArray(error.meta?.target) && error.meta.target.includes(fieldName));
}

async function getNextMemberCode() {
  const members = await prisma.member.findMany({
    where: { memberId: { startsWith: 'M' } },
    select: { memberId: true },
  });
  let maxNum = 0;
  for (const member of members) {
    const match = /^M(\d+)$/.exec(member.memberId);
    if (!match) continue;
    const num = parseInt(match[1], 10);
    if (!Number.isNaN(num) && num > maxNum) maxNum = num;
  }
  return `M${String(maxNum + 1).padStart(3, '0')}`;
}


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
    const normalizedName = String(name).trim();
    const normalizedPhone = String(phone).trim();
    if (!normalizedName) return res.status(400).json({ error: 'Valid name is required' });
    if (!/^\d{10,15}$/.test(normalizedPhone)) return res.status(400).json({ error: 'Phone must be 10-15 digits' });

    if (req.user.role === 'STAFF' && req.user.branchId !== branchId) {
      return res.status(403).json({ error: 'Staff can only create members in their own branch' });
    }

    const centre = await prisma.centre.findUnique({
      where: { id: centreId },
      select: { id: true, branchId: true, isActive: true },
    });
    if (!centre || !centre.isActive) return res.status(400).json({ error: 'Invalid centre' });
    if (centre.branchId !== branchId) return res.status(400).json({ error: 'Centre does not belong to selected branch' });

    const staffId = req.user.role === 'STAFF' ? req.user.id : null;
    for (let attempt = 1; attempt <= CREATE_MEMBER_MAX_RETRIES; attempt += 1) {
      const memberId = await getNextMemberCode();
      try {
        const member = await prisma.member.create({
          data: {
            memberId,
            name: normalizedName,
            phone: normalizedPhone,
            aadhar: aadhar ? String(aadhar).trim() : null,
            area: area ? String(area).trim() : null,
            branchId,
            centreId,
            staffId,
          },
          include: { branch: true, centre: true },
        });
        return res.status(201).json(member);
      } catch (error) {
        if (isUniqueConstraintError(error, 'memberId') && attempt < CREATE_MEMBER_MAX_RETRIES) continue;
        throw error;
      }
    }
    return res.status(503).json({ error: 'Please retry member creation' });
  } catch (error) {
    console.error(error);
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

// DELETE /api/members/:id (hard delete with related records)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const where = { id: req.params.id, isActive: true };
    if (req.user.role === 'STAFF') where.staffId = req.user.id;

    const existing = await prisma.member.findFirst({ where, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Member not found' });

    await prisma.$transaction(async (tx) => {
      await tx.emiPayment.deleteMany({ where: { loan: { memberId: existing.id } } });
      await tx.loan.deleteMany({ where: { memberId: existing.id } });
      await tx.member.delete({ where: { id: existing.id } });
    });
    res.json({ message: 'Member deleted with related data' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete member' });
  }
});

module.exports = router;

