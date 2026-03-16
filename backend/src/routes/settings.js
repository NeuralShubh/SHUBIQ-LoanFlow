const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { ACTIONS, getPendingApproval, createApprovalRequest } = require('../services/approvals');

const router = express.Router();
const STAFF_CODE_PREFIX = 'PF';

function buildNextStaffCode(currentMax) {
  return `${STAFF_CODE_PREFIX}${String(currentMax + 1).padStart(2, '0')}`;
}

async function getNextStaffCode() {
  const staff = await prisma.user.findMany({
    where: { staffCode: { startsWith: STAFF_CODE_PREFIX } },
    select: { staffCode: true },
  });
  let maxNum = 0;
  for (const s of staff) {
    const match = new RegExp(`^${STAFF_CODE_PREFIX}(\\d{2,})$`).exec(s.staffCode || '');
    if (!match) continue;
    const num = parseInt(match[1], 10);
    if (!Number.isNaN(num) && num > maxNum) maxNum = num;
  }
  return buildNextStaffCode(maxNum);
}

async function ensureStaffCodes(staffList) {
  let maxNum = 0;
  for (const s of staffList) {
    const match = new RegExp(`^${STAFF_CODE_PREFIX}(\\d{2,})$`).exec(s.staffCode || '');
    if (!match) continue;
    const num = parseInt(match[1], 10);
    if (!Number.isNaN(num) && num > maxNum) maxNum = num;
  }
  const missing = staffList.filter((s) => !s.staffCode);
  for (const s of missing) {
    maxNum += 1;
    await prisma.user.update({
      where: { id: s.id },
      data: { staffCode: buildNextStaffCode(maxNum) },
    });
  }
}

// PUT /api/settings/profile
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing && existing.id !== req.user.id) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name: String(name).trim(),
        email: normalizedEmail,
        phone: phone ? String(phone).trim() : null,
      },
      include: { branch: true },
    });

    const { password, ...result } = updated;
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// â”€â”€ STAFF MANAGEMENT (Admin only) â”€â”€

// GET /api/settings/staff
router.get('/staff', authenticate, requireAdmin, async (req, res) => {
  try {
    const staff = await prisma.user.findMany({
      where: { role: 'STAFF', isActive: true },
      include: { branch: true },
      orderBy: { createdAt: 'desc' },
    });
    await ensureStaffCodes(staff);
    res.json(staff.map(({ password, ...s }) => s));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// POST /api/settings/staff
router.post('/staff', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, email, phone, password, branchId } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();

    const exists = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (exists) return res.status(400).json({ error: 'Email already in use' });

    const hashed = await bcrypt.hash(String(password), 10);
    const staffCode = await getNextStaffCode();
    const staff = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: normalizedEmail,
        phone: phone ? String(phone).trim() : null,
        password: hashed,
        role: 'STAFF',
        branchId: branchId || null,
        staffCode,
      },
      include: { branch: true },
    });
    const { password: _, ...result } = staff;
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create staff' });
  }
});

// PUT /api/settings/staff/:id
router.put('/staff/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, email, phone, branchId, password } = req.body;
    const existing = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, role: true, email: true },
    });
    if (!existing || existing.role !== 'STAFF') {
      return res.status(404).json({ error: 'Staff not found' });
    }

    const data = { name, phone, branchId: branchId || null };
    if (email) {
      const normalizedEmail = String(email).trim().toLowerCase();
      const conflict = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (conflict && conflict.id !== existing.id) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      data.email = normalizedEmail;
    }
    if (typeof name === 'string') data.name = name.trim();
    if (typeof phone === 'string') data.phone = phone.trim();
    if (password) {
      if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      data.password = await bcrypt.hash(String(password), 10);
    }

    const staff = await prisma.user.update({
      where: { id: existing.id },
      data,
      include: { branch: true },
    });
    const { password: _, ...result } = staff;
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update staff' });
  }
});

// DELETE /api/settings/staff/:id
router.delete('/staff/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const existing = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, role: true, name: true, email: true },
    });
    if (!existing || existing.role !== 'STAFF') {
      return res.status(404).json({ error: 'Staff not found' });
    }

    const existingApproval = await getPendingApproval(ACTIONS.STAFF_DELETE, existing.id);
    if (existingApproval) {
      return res.status(202).json({ message: 'Delete already pending approval' });
    }

    await createApprovalRequest({
      actionType: ACTIONS.STAFF_DELETE,
      targetType: 'STAFF',
      targetId: existing.id,
      requestedById: req.user.id,
      payload: { name: existing.name, email: existing.email },
    });
    res.status(202).json({ message: 'Delete request submitted for approval' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete staff' });
  }
});

// â”€â”€ QR CODES â”€â”€

// GET /api/settings/qr
router.get('/qr', authenticate, async (req, res) => {
  try {
    const qrs = await prisma.qrCode.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
    res.json(qrs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch QR codes' });
  }
});

// POST /api/settings/qr
router.post('/qr', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, upiId } = req.body;
    if (!name || !upiId) return res.status(400).json({ error: 'Name and UPI ID required' });
    const qr = await prisma.qrCode.create({ data: { name, upiId } });
    res.status(201).json(qr);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create QR code' });
  }
});

// DELETE /api/settings/qr/:id
router.delete('/qr/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const qr = await prisma.qrCode.findUnique({ where: { id: req.params.id } });
    if (!qr) return res.status(404).json({ error: 'QR code not found' });

    const existingApproval = await getPendingApproval(ACTIONS.QR_DELETE, qr.id);
    if (existingApproval) {
      return res.status(202).json({ message: 'Delete already pending approval' });
    }

    await createApprovalRequest({
      actionType: ACTIONS.QR_DELETE,
      targetType: 'QR',
      targetId: qr.id,
      requestedById: req.user.id,
      payload: { name: qr.name, upiId: qr.upiId },
    });
    res.status(202).json({ message: 'Delete request submitted for approval' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove QR code' });
  }
});

module.exports = router;


