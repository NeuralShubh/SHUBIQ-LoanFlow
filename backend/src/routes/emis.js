const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, applyBranchFilter } = require('../middleware/auth');

const router = express.Router();

// GET /api/emis/pending?centreId=...
router.get('/pending', authenticate, async (req, res) => {
  try {
    const { centreId } = req.query;
    if (!centreId) return res.status(400).json({ error: 'centreId required' });

    const filter = applyBranchFilter(req);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const emis = await prisma.emiPayment.findMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
        dueDate: { lte: todayEnd },
        loan: {
          centreId: String(centreId),
          ...filter,
          ...(req.user.role === 'STAFF' ? { staffId: req.user.id } : {}),
        },
      },
      include: {
        loan: {
          include: {
            member: true,
            branch: true,
            centre: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    res.json(emis);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch pending EMIs' });
  }
});


async function recalculateLoanStatus(loanId) {
  const loanWithEmis = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { emis: true },
  });
  if (!loanWithEmis) return;

  const allPaid = loanWithEmis.emis.length > 0 && loanWithEmis.emis.every(e => e.status === 'PAID');
  const hasOverdue = loanWithEmis.emis.some(e => e.status === 'OVERDUE');
  const nextStatus = allPaid ? 'COMPLETED' : (hasOverdue ? 'OVERDUE' : 'ACTIVE');

  await prisma.loan.update({ where: { id: loanId }, data: { status: nextStatus } });
}

// POST /api/emis/:id/pay
router.post('/:id/pay', authenticate, async (req, res) => {
  try {
    const { paidAmount, paymentMethod, notes } = req.body;
    if (!paidAmount || !paymentMethod) {
      return res.status(400).json({ error: 'Amount and payment method required' });
    }

    const emi = await prisma.emiPayment.findUnique({
      where: { id: req.params.id },
      include: { loan: { include: { emis: true } } },
    });
    if (!emi) return res.status(404).json({ error: 'EMI not found' });

    const filter = applyBranchFilter(req);
    if (filter.branchId && emi.loan.branchId !== filter.branchId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role === 'STAFF' && emi.loan.staffId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (emi.status === 'PAID') return res.status(400).json({ error: 'EMI already paid' });

    const updatedEmi = await prisma.emiPayment.update({
      where: { id: req.params.id },
      data: {
        paidAmount: parseFloat(paidAmount),
        paymentMethod: paymentMethod.toUpperCase(),
        paidDate: new Date(),
        status: 'PAID',
        notes,
      },
    });

    await prisma.emiPayment.updateMany({
      where: {
        loanId: emi.loanId,
        status: 'PENDING',
        dueDate: { lt: new Date() },
      },
      data: { status: 'OVERDUE' },
    });

    await recalculateLoanStatus(emi.loanId);

    res.json(updatedEmi);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// POST /api/emis/:id/undo
router.post('/:id/undo', authenticate, async (req, res) => {
  try {
    const emi = await prisma.emiPayment.findUnique({
      where: { id: req.params.id },
      include: { loan: true },
    });
    if (!emi) return res.status(404).json({ error: 'EMI not found' });

    const filter = applyBranchFilter(req);
    if (filter.branchId && emi.loan.branchId !== filter.branchId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role === 'STAFF' && emi.loan.staffId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (emi.status !== 'PAID') {
      return res.status(400).json({ error: 'Only paid EMI can be undone' });
    }

    const isOverdue = new Date(emi.dueDate) < new Date();
    const updated = await prisma.emiPayment.update({
      where: { id: emi.id },
      data: {
        status: isOverdue ? 'OVERDUE' : 'PENDING',
        paidAmount: null,
        paidDate: null,
        paymentMethod: null,
      },
    });

    await recalculateLoanStatus(emi.loanId);

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to undo EMI payment' });
  }
});

// POST /api/emis/update-overdue - cron-like endpoint
router.post('/update-overdue', authenticate, async (req, res) => {
  try {
    const result = await prisma.emiPayment.updateMany({
      where: { status: 'PENDING', dueDate: { lt: new Date() } },
      data: { status: 'OVERDUE' },
    });

    // Update loan statuses
    const overdueLoans = await prisma.emiPayment.findMany({
      where: { status: 'OVERDUE' },
      select: { loanId: true },
      distinct: ['loanId'],
    });
    await prisma.loan.updateMany({
      where: { id: { in: overdueLoans.map(e => e.loanId) }, status: 'ACTIVE' },
      data: { status: 'OVERDUE' },
    });

    res.json({ updated: result.count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update overdue' });
  }
});

module.exports = router;

