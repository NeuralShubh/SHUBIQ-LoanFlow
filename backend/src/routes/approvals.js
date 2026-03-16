const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { executeApprovalAction } = require('../services/approvals');

const router = express.Router();

// GET /api/approvals?status=PENDING
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const status = String(req.query.status || 'PENDING').toUpperCase();
    const approvals = await prisma.approvalRequest.findMany({
      where: { status },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(approvals);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch approvals' });
  }
});

// POST /api/approvals/:id/approve
router.post('/:id/approve', authenticate, requireAdmin, async (req, res) => {
  try {
    const approval = await prisma.approvalRequest.findUnique({ where: { id: req.params.id } });
    if (!approval || approval.status !== 'PENDING') {
      return res.status(404).json({ error: 'Approval not found or already processed' });
    }
    if (approval.requestedById === req.user.id) {
      return res.status(400).json({ error: 'A different admin must approve this request' });
    }

    await executeApprovalAction(approval);

    const updated = await prisma.approvalRequest.update({
      where: { id: approval.id },
      data: { status: 'APPROVED', approvedById: req.user.id, approvedAt: new Date() },
    });

    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to approve request' });
  }
});

// POST /api/approvals/:id/reject
router.post('/:id/reject', authenticate, requireAdmin, async (req, res) => {
  try {
    const approval = await prisma.approvalRequest.findUnique({ where: { id: req.params.id } });
    if (!approval || approval.status !== 'PENDING') {
      return res.status(404).json({ error: 'Approval not found or already processed' });
    }
    const updated = await prisma.approvalRequest.update({
      where: { id: approval.id },
      data: { status: 'REJECTED', approvedById: req.user.id, approvedAt: new Date() },
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to reject request' });
  }
});

module.exports = router;