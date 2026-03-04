const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

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
      where: { role: 'STAFF' },
      include: { branch: true },
      orderBy: { createdAt: 'desc' },
    });
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

    const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (exists) return res.status(400).json({ error: 'Email already in use' });

    const hashed = await bcrypt.hash(password, 10);
    const staff = await prisma.user.create({
      data: { name, email: email.toLowerCase(), phone, password: hashed, role: 'STAFF', branchId: branchId || null },
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
    const data = { name, phone, branchId: branchId || null };
    if (email) data.email = email.toLowerCase();
    if (password) data.password = await bcrypt.hash(password, 10);

    const staff = await prisma.user.update({
      where: { id: req.params.id },
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
    await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Staff deactivated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to deactivate staff' });
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
    await prisma.qrCode.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'QR code removed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove QR code' });
  }
});

module.exports = router;


