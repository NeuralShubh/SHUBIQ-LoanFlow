const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, applyBranchFilter } = require('../middleware/auth');

const router = express.Router();

const LOAN_STATUSES = new Set(['ACTIVE', 'OVERDUE', 'COMPLETED', 'CANCELLED']);
const EMI_STATUSES = new Set(['PENDING', 'PAID', 'OVERDUE', 'PARTIAL']);
const MEMBER_STATUSES = new Set(['ACTIVE', 'INACTIVE', 'SUSPENDED']);


// GET /api/reports/loans
router.get('/loans', authenticate, async (req, res) => {
  try {
    const { from, to, branchId, centreId, staffId, status } = req.query;
    const filter = {
      ...applyBranchFilter(req),
      ...(req.user.role === 'STAFF' ? { staffId: req.user.id } : {}),
    };
    const where = { ...filter };
    const normalizedStatus = String(status || '').toUpperCase();
    if (normalizedStatus && LOAN_STATUSES.has(normalizedStatus)) where.status = normalizedStatus;
    if (branchId) where.branchId = branchId;
    if (centreId) where.centreId = centreId;
    if (staffId) where.staffId = staffId;
    if (from || to) {
      where.loanDate = {};
      if (from) where.loanDate.gte = new Date(from);
      if (to) where.loanDate.lte = new Date(to + 'T23:59:59');
    }

    const loans = await prisma.loan.findMany({
      where,
      include: { member: true, branch: true, centre: true, staff: { select: { name: true } }, emis: true },
      orderBy: { loanDate: 'desc' },
    });

    const summary = {
      totalLoans: loans.length,
      totalDisbursed: loans.reduce((s, l) => s + l.principal, 0),
      totalPayable: loans.reduce((s, l) => s + l.totalPayable, 0),
      totalCollected: loans.reduce((s, l) => s + l.emis.filter(e => e.status === 'PAID').reduce((a, e) => a + (e.paidAmount || 0), 0), 0),
      activeCount: loans.filter(l => l.status === 'ACTIVE').length,
      overdueCount: loans.filter(l => l.status === 'OVERDUE').length,
      completedCount: loans.filter(l => l.status === 'COMPLETED').length,
    };

    res.json({ loans, summary });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate loan report' });
  }
});

// GET /api/reports/emis
router.get('/emis', authenticate, async (req, res) => {
  try {
    const { from, to, branchId, centreId, staffId, status } = req.query;
    const filter = applyBranchFilter(req);
    const where = {};
    const normalizedStatus = String(status || '').toUpperCase();
    if (normalizedStatus && EMI_STATUSES.has(normalizedStatus)) where.status = normalizedStatus;
    if (from || to) {
      where.dueDate = {};
      if (from) where.dueDate.gte = new Date(from);
      if (to) where.dueDate.lte = new Date(to + 'T23:59:59');
    }
    if (normalizedStatus === 'OVERDUE') {
      where.dueDate = where.dueDate || {};
      where.dueDate.lt = new Date();
    }
    where.loan = {
      ...filter,
      ...(req.user.role === 'STAFF' ? { staffId: req.user.id } : {}),
    };
    if (branchId) where.loan.branchId = branchId;
    if (centreId) where.loan.centreId = centreId;
    if (staffId) where.loan.staffId = staffId;

    const emis = await prisma.emiPayment.findMany({
      where,
      include: { loan: { include: { member: true, branch: true, centre: true, staff: { select: { id: true, name: true } } } } },
      orderBy: { dueDate: 'desc' },
    });

    res.json(emis);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate EMI report' });
  }
});

// GET /api/reports/branch-summary
router.get('/branch-summary', authenticate, async (req, res) => {
  try {
    const { branchId, centreId, from, to, status } = req.query;
    const branchWhere = { isActive: true };
    if (req.user.role === 'STAFF' && req.user.branchId) {
      branchWhere.id = req.user.branchId;
    } else if (branchId) {
      branchWhere.id = branchId;
    }
    if (centreId) branchWhere.centres = { some: { id: centreId, isActive: true } };

    const branches = await prisma.branch.findMany({
      where: branchWhere,
      orderBy: { code: 'asc' },
    });

    const summary = await Promise.all(branches.map(async (b) => {
      const loanWhere = { branchId: b.id };
      if (req.user.role === 'STAFF') loanWhere.staffId = req.user.id;
      if (centreId) loanWhere.centreId = centreId;
      if (status) loanWhere.status = status.toUpperCase();
      if (from || to) {
        loanWhere.loanDate = {};
        if (from) loanWhere.loanDate.gte = new Date(from);
        if (to) loanWhere.loanDate.lte = new Date(to + 'T23:59:59');
      }

      const memberWhere = { isActive: true, branchId: b.id };
      if (req.user.role === 'STAFF') memberWhere.staffId = req.user.id;
      if (centreId) memberWhere.centreId = centreId;

      const [loans, memberCount] = await Promise.all([
        prisma.loan.findMany({ where: loanWhere, include: { emis: true } }),
        prisma.member.count({ where: memberWhere }),
      ]);

      const activeLoans = loans.filter(l => l.status === 'ACTIVE').length;
      const overdueLoans = loans.filter(l => l.status === 'OVERDUE').length;
      const totalDisbursed = loans.reduce((s, l) => s + l.principal, 0);
      const totalCollected = loans.reduce(
        (s, l) => s + l.emis.filter(e => e.status === 'PAID').reduce((a, e) => a + (e.paidAmount || 0), 0), 0
      );
      const recoveryRate = totalDisbursed > 0 ? (totalCollected / totalDisbursed) * 100 : 0;
      return {
        id: b.id,
        code: b.code,
        name: b.name,
        memberCount,
        activeLoans,
        overdueLoans,
        totalDisbursed,
        totalCollected,
        recoveryRate,
      };
    }));

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate branch summary' });
  }
});

// GET /api/reports/staff-summary
router.get('/staff-summary', authenticate, async (req, res) => {
  try {
    const { branchId, centreId } = req.query;
    const filter = applyBranchFilter(req);
    const where = { role: 'STAFF', isActive: true, ...filter };
    if (branchId) where.branchId = branchId;
    if (centreId) {
      where.OR = [
        { members: { some: { centreId, isActive: true } } },
        { loans: { some: { centreId } } },
      ];
    }

    const staff = await prisma.user.findMany({
      where,
      include: {
        branch: true,
        loans: { include: { emis: true } },
        members: true,
      },
    });

    const summary = staff.map(s => ({
      id: s.id,
      name: s.name,
      branch: s.branch?.name,
      memberCount: s.members.length,
      activeLoans: s.loans.filter(l => l.status === 'ACTIVE').length,
      totalDisbursed: s.loans.reduce((sum, l) => sum + l.principal, 0),
      totalCollected: s.loans.reduce(
        (sum, l) => sum + l.emis.filter(e => e.status === 'PAID').reduce((a, e) => a + (e.paidAmount || 0), 0), 0
      ),
    }));

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate staff summary' });
  }
});

// GET /api/reports/members
router.get('/members', authenticate, async (req, res) => {
  try {
    const { branchId, centreId, staffId, search, status } = req.query;
    const filter = {
      ...applyBranchFilter(req),
      ...(req.user.role === 'STAFF' ? { staffId: req.user.id } : {}),
    };
    const where = { isActive: true, ...filter };
    if (branchId) where.branchId = branchId;
    if (centreId) where.centreId = centreId;
    if (staffId) where.staffId = staffId;
    const normalizedStatus = String(status || '').toUpperCase();
    if (normalizedStatus && MEMBER_STATUSES.has(normalizedStatus)) where.status = normalizedStatus;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { memberId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const members = await prisma.member.findMany({
      where,
      include: {
        branch: true,
        centre: true,
        staff: { select: { id: true, name: true } },
        loans: {
          include: { emis: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const summary = {
      totalMembers: members.length,
      activeMembers: members.filter(m => m.status === 'ACTIVE').length,
      inactiveMembers: members.filter(m => m.status === 'INACTIVE').length,
      suspendedMembers: members.filter(m => m.status === 'SUSPENDED').length,
      withLoans: members.filter(m => m.loans.length > 0).length,
    };

    res.json({ members, summary });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate member report' });
  }
});

// GET /api/reports/centre-summary
router.get('/centre-summary', authenticate, async (req, res) => {
  try {
    const { branchId, centreId } = req.query;
    const filter = applyBranchFilter(req);
    const where = { isActive: true, ...filter };
    if (branchId) where.branchId = branchId;
    if (centreId) where.id = centreId;

    const centres = await prisma.centre.findMany({
      where,
      include: { branch: true },
      orderBy: { code: 'asc' },
    });

    const summary = await Promise.all(centres.map(async (c) => {
      const [memberCount, loans] = await Promise.all([
        prisma.member.count({
          where: {
            isActive: true,
            centreId: c.id,
            ...(req.user.role === 'STAFF' ? { staffId: req.user.id } : {}),
          },
        }),
        prisma.loan.findMany({
          where: {
            centreId: c.id,
            ...(req.user.role === 'STAFF' ? { staffId: req.user.id } : {}),
          },
          include: { emis: true },
        }),
      ]);

      const activeLoans = loans.filter(l => l.status === 'ACTIVE').length;
      const overdueLoans = loans.filter(l => l.status === 'OVERDUE').length;
      const totalDisbursed = loans.reduce((sum, l) => sum + l.principal, 0);
      const totalCollected = loans.reduce(
        (sum, l) => sum + l.emis.filter(e => e.status === 'PAID').reduce((a, e) => a + (e.paidAmount || 0), 0), 0
      );
      const recoveryRate = totalDisbursed > 0 ? (totalCollected / totalDisbursed) * 100 : 0;

      return {
        id: c.id,
        code: c.code,
        name: c.name,
        branchCode: c.branch?.code,
        branchName: c.branch?.name,
        memberCount,
        activeLoans,
        overdueLoans,
        totalDisbursed,
        totalCollected,
        recoveryRate,
      };
    }));

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate centre summary' });
  }
});

module.exports = router;

