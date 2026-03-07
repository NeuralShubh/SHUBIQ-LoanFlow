const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, requireAdmin, applyBranchFilter } = require('../middleware/auth');

const router = express.Router();
const LOAN_STATUSES = new Set(['ACTIVE', 'OVERDUE', 'COMPLETED', 'CANCELLED']);
const CREATE_LOAN_MAX_RETRIES = 5;

function isUniqueConstraintError(error, fieldName) {
  return Boolean(error && error.code === 'P2002' && Array.isArray(error.meta?.target) && error.meta.target.includes(fieldName));
}


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
    if (status) {
      const normalizedStatus = String(status).toUpperCase();
      if (!LOAN_STATUSES.has(normalizedStatus)) return res.status(400).json({ error: 'Invalid loan status' });
      where.status = normalizedStatus;
    }
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
    const principalNum = Number(principal);
    const interestRateNum = Number(interestRate);
    const durationWeeksNum = Number(durationWeeks);
    const fixedFeeRateNum = Number(fixedFeeRate || 2);
    const loanDateObj = new Date(loanDate);
    const emiStartDateObj = new Date(emiStartDate);

    if (!Number.isFinite(principalNum) || principalNum <= 0) return res.status(400).json({ error: 'Invalid principal amount' });
    if (!Number.isFinite(interestRateNum) || interestRateNum < 0 || interestRateNum > 100) return res.status(400).json({ error: 'Invalid interest rate' });
    if (!Number.isInteger(durationWeeksNum) || durationWeeksNum < 1 || durationWeeksNum > 260) return res.status(400).json({ error: 'Duration must be 1-260 weeks' });
    if (!Number.isFinite(fixedFeeRateNum) || fixedFeeRateNum < 0 || fixedFeeRateNum > 20) return res.status(400).json({ error: 'Invalid fixed fee rate' });
    if (Number.isNaN(loanDateObj.getTime()) || Number.isNaN(emiStartDateObj.getTime())) return res.status(400).json({ error: 'Invalid loan/EMI date' });
    if (emiStartDateObj < loanDateObj) return res.status(400).json({ error: 'EMI start date cannot be before loan date' });

    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) return res.status(404).json({ error: 'Member not found' });
    if (req.user.role === 'STAFF' && member.branchId !== req.user.branchId) {
      return res.status(403).json({ error: 'Staff can only create loans in their own branch' });
    }

    const calcs = calculateLoan(
      principalNum,
      interestRateNum,
      durationWeeksNum,
      fixedFeeRateNum
    );
    const staffId = req.user.role === 'STAFF' ? req.user.id : null;
    for (let attempt = 1; attempt <= CREATE_LOAN_MAX_RETRIES; attempt += 1) {
      const loanId = await getNextLoanId();
      try {
        const createdLoan = await prisma.$transaction(async (tx) => {
          const loan = await tx.loan.create({
            data: {
              loanId,
              memberId,
              branchId: member.branchId,
              centreId: member.centreId,
              staffId,
              principal: principalNum,
              interestRate: interestRateNum,
              durationWeeks: durationWeeksNum,
              fixedFeeRate: fixedFeeRateNum,
              ...calcs,
              loanDate: loanDateObj,
              emiStartDate: emiStartDateObj,
              notes: notes ? String(notes).trim() : null,
            },
          });

          const emiData = generateEmiSchedule(loan.id, emiStartDateObj, durationWeeksNum, calcs.weeklyEmi);
          await tx.emiPayment.createMany({ data: emiData });
          await tx.member.update({ where: { id: memberId }, data: { status: 'ACTIVE' } });
          return loan;
        });

        const fullLoan = await prisma.loan.findUnique({
          where: { id: createdLoan.id },
          include: { member: true, branch: true, centre: true, emis: { orderBy: { emiNumber: 'asc' } } },
        });

        return res.status(201).json(fullLoan);
      } catch (error) {
        if (isUniqueConstraintError(error, 'loanId') && attempt < CREATE_LOAN_MAX_RETRIES) continue;
        throw error;
      }
    }
    return res.status(503).json({ error: 'Please retry loan creation' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create loan' });
  }
});

module.exports = router;

