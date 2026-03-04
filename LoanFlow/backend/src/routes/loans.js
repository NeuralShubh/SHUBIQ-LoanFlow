const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, requireAdmin, applyBranchFilter } = require('../middleware/auth');

const router = express.Router();


function calculateLoan(principal, interestRate, durationWeeks, fixedFeeRate = 2) {
  const interestAmount = (principal * interestRate * (durationWeeks / 52)) / 100;
  const fixedFee = (principal * fixedFeeRate) / 100;
  const totalPayable = principal + interestAmount + fixedFee;
  const weeklyEmi = totalPayable / durationWeeks;
  return { interestAmount, fixedFee, totalPayable, weeklyEmi };
}

function generateEmiSchedule(loanId, emiStartDate, durationWeeks, weeklyEmi) {
  const emis = [];
  const start = new Date(emiStartDate);
  for (let i = 1; i <= durationWeeks; i++) {
    const dueDate = new Date(start);
    dueDate.setDate(dueDate.getDate() + (i - 1) * 7);
    emis.push({
      loanId,
      emiNumber: i,
      dueDate,
      amount: Math.round(weeklyEmi * 100) / 100,
      status: 'PENDING',
    });
  }
  return emis;
}

async function getNextLoanId() {
  const loans = await prisma.loan.findMany({
    where: { loanId: { startsWith: 'LN' } },
    select: { loanId: true },
  });

  let maxNum = 0;
  for (const loan of loans) {
    const match = /^LN(\d+)$/.exec(loan.loanId);
    if (!match) continue;
    const num = parseInt(match[1], 10);
    if (!Number.isNaN(num) && num > maxNum) maxNum = num;
  }

  return `LN${String(maxNum + 1).padStart(3, '0')}`;
}

// GET /api/loans
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, status, branchId, centreId } = req.query;
    const filter = {
      ...applyBranchFilter(req),
      ...(req.user.role === 'STAFF' ? { staffId: req.user.id } : {}),
    };
    const where = { ...filter };
    if (status) where.status = status.toUpperCase();
    if (branchId) where.branchId = branchId;
    if (centreId) where.centreId = centreId;
    if (search) {
      where.OR = [
        { loanId: { contains: search, mode: 'insensitive' } },
        { member: { name: { contains: search, mode: 'insensitive' } } },
        { member: { memberId: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const loans = await prisma.loan.findMany({
      where,
      include: {
        member: true,
        branch: true,
        centre: true,
        staff: { select: { id: true, name: true } },
        emis: { orderBy: { emiNumber: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(loans);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch loans' });
  }
});

// GET /api/loans/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const loan = await prisma.loan.findUnique({
      where: { id: req.params.id },
      include: {
        member: true,
        branch: true,
        centre: true,
        staff: { select: { id: true, name: true } },
        emis: { orderBy: { emiNumber: 'asc' } },
      },
    });
    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    if (req.user.role === 'STAFF' && loan.staffId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(loan);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch loan' });
  }
});

// POST /api/loans
router.post('/', authenticate, async (req, res) => {
  try {
    const { memberId, principal, interestRate, durationWeeks, fixedFeeRate, loanDate, emiStartDate, notes } = req.body;
    if (!memberId || !principal || !interestRate || !durationWeeks || !loanDate || !emiStartDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const calcs = calculateLoan(
      parseFloat(principal),
      parseFloat(interestRate),
      parseInt(durationWeeks),
      parseFloat(fixedFeeRate || 2)
    );

    const loanId = await getNextLoanId();
    const staffId = req.user.role === 'STAFF' ? req.user.id : null;

    const loan = await prisma.loan.create({
      data: {
        loanId,
        memberId,
        branchId: member.branchId,
        centreId: member.centreId,
        staffId,
        principal: parseFloat(principal),
        interestRate: parseFloat(interestRate),
        durationWeeks: parseInt(durationWeeks),
        fixedFeeRate: parseFloat(fixedFeeRate || 2),
        ...calcs,
        loanDate: new Date(loanDate),
        emiStartDate: new Date(emiStartDate),
        notes,
      },
      include: { member: true, branch: true, centre: true },
    });

    // Generate EMI schedule
    const emiData = generateEmiSchedule(loan.id, emiStartDate, parseInt(durationWeeks), calcs.weeklyEmi);
    await prisma.emiPayment.createMany({ data: emiData });

    // Update member status to ACTIVE
    await prisma.member.update({ where: { id: memberId }, data: { status: 'ACTIVE' } });

    const fullLoan = await prisma.loan.findUnique({
      where: { id: loan.id },
      include: { member: true, branch: true, centre: true, emis: { orderBy: { emiNumber: 'asc' } } },
    });

    res.status(201).json(fullLoan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create loan' });
  }
});

module.exports = router;

