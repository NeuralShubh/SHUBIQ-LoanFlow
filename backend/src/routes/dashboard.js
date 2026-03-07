const express = require('express');
const { Prisma } = require('@prisma/client');
const { authenticate, applyBranchFilter } = require('../middleware/auth');

const router = express.Router();
const prisma = require('../lib/prisma');

const CACHE_TTL_MS = Number(process.env.DASHBOARD_CACHE_TTL_MS || 10 * 1000);
const statsCache = new Map();

function getCacheKey(req) {
  return req.user.role === 'ADMIN'
    ? 'admin'
    : `staff:${req.user.id}:branch:${req.user.branchId || 'none'}`;
}

function getCached(map, key) {
  if (CACHE_TTL_MS <= 0) return null;
  const entry = map.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    map.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(map, key, value) {
  map.set(key, { ts: Date.now(), value });
}

function toNumber(value) {
  return Number(value || 0);
}

// GET /api/dashboard/stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    const cacheKey = getCacheKey(req);
    const cached = getCached(statsCache, cacheKey);
    if (cached) return res.json(cached);

    const filter = {
      ...applyBranchFilter(req),
      ...(req.user.role === 'STAFF' ? { staffId: req.user.id } : {}),
    };
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const todayEnd = new Date(new Date().setHours(23, 59, 59, 999));
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const nextMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - 6);
    const tomorrowStart = new Date();
    tomorrowStart.setHours(0, 0, 0, 0);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const dataScopeCondition = req.user.role === 'ADMIN'
      ? Prisma.sql``
      : Prisma.sql`AND l."branchId" = ${req.user.branchId} AND l."staffId" = ${req.user.id}`;

    const totalMembers = await prisma.member.count({ where: { ...filter, isActive: true } });
    const activeLoans = await prisma.loan.count({ where: { ...filter, status: 'ACTIVE' } });
    const totalDisbursed = await prisma.loan.aggregate({ where: { ...filter }, _sum: { principal: true } });
    const totalPayable = await prisma.loan.aggregate({ where: { ...filter }, _sum: { totalPayable: true } });
    const todayDueEmis = await prisma.emiPayment.findMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
        dueDate: { gte: todayStart, lte: todayEnd },
        loan: { ...filter },
      },
      select: {
        id: true,
        emiNumber: true,
        amount: true,
        status: true,
        loan: {
          select: {
            memberId: true,
            member: {
              select: {
                name: true,
              },
            },
            branch: {
              select: {
                code: true,
              },
            },
            centre: {
              select: {
                code: true,
              },
            },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    });
    const emiAgg = await prisma.$queryRaw(Prisma.sql`
        SELECT
          COALESCE(SUM(CASE WHEN ep.status = 'PAID' THEN COALESCE(ep."paidAmount", 0) ELSE 0 END), 0) AS total_recovered,
          COALESCE(SUM(CASE WHEN ep.status = 'OVERDUE' AND ep."dueDate" < NOW() THEN 1 ELSE 0 END), 0) AS overdue_count,
          COALESCE(SUM(CASE WHEN ep."dueDate" >= ${weekStart} AND ep."dueDate" < ${tomorrowStart} THEN ep.amount ELSE 0 END), 0) AS weekly_target,
          COALESCE(SUM(CASE WHEN ep.status = 'PAID' AND ep."paidDate" >= ${weekStart} AND ep."paidDate" < ${tomorrowStart} THEN COALESCE(ep."paidAmount", 0) ELSE 0 END), 0) AS weekly_collected,
          COALESCE(SUM(CASE WHEN ep."dueDate" >= ${monthStart} AND ep."dueDate" < ${nextMonthStart} THEN ep.amount ELSE 0 END), 0) AS monthly_target,
          COALESCE(SUM(CASE WHEN ep.status = 'PAID' AND ep."paidDate" >= ${monthStart} AND ep."paidDate" < ${nextMonthStart} THEN COALESCE(ep."paidAmount", 0) ELSE 0 END), 0) AS monthly_collected
        FROM "emi_payments" ep
        JOIN "loans" l ON l.id = ep."loanId"
        WHERE 1 = 1
        ${dataScopeCondition}
      `);

    const agg = emiAgg[0] || {};
    const totalDisbursedAmt = toNumber(totalDisbursed._sum.principal);
    const totalPayableAmt = toNumber(totalPayable._sum.totalPayable);
    const totalRecoveredAmt = toNumber(agg.total_recovered);
    const weeklyTargetAmt = toNumber(agg.weekly_target);
    const weeklyCollectedAmt = toNumber(agg.weekly_collected);
    const monthlyTargetAmt = toNumber(agg.monthly_target);
    const monthlyCollectedAmt = toNumber(agg.monthly_collected);

    let storage = null;
    if (req.user.role === 'ADMIN') {
      const sizeResult = await prisma.$queryRaw`SELECT pg_database_size(current_database()) AS size_bytes`;
      const usedBytes = Number(sizeResult?.[0]?.size_bytes || 0);
      storage = {
        usedBytes,
        usedMB: Number((usedBytes / (1024 * 1024)).toFixed(2)),
        usedGB: Number((usedBytes / (1024 * 1024 * 1024)).toFixed(3)),
      };
    }

    const payload = {
      totalMembers,
      activeLoans,
      overdueEmis: Math.round(toNumber(agg.overdue_count)),
      totalDisbursed: totalDisbursedAmt,
      totalRecovered: totalRecoveredAmt,
      outstanding: totalPayableAmt - totalRecoveredAmt,
      weeklyProgress: weeklyTargetAmt > 0 ? (weeklyCollectedAmt / weeklyTargetAmt) * 100 : 0,
      monthlyProgress: monthlyTargetAmt > 0 ? (monthlyCollectedAmt / monthlyTargetAmt) * 100 : 0,
      todayDueEmis,
      storage,
    };

    setCached(statsCache, cacheKey, payload);
    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// GET /api/dashboard/chart - monthly EMI collection (last 6 months)
router.get('/chart', authenticate, async (req, res) => {
  try {
    // Chart is intentionally uncached for near real-time dashboard behavior.
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    const dataScopeCondition = req.user.role === 'ADMIN'
      ? Prisma.sql``
      : Prisma.sql`AND l."branchId" = ${req.user.branchId} AND l."staffId" = ${req.user.id}`;

    const rows = await prisma.$queryRaw(Prisma.sql`
      WITH months AS (
        SELECT (date_trunc('month', CURRENT_DATE) - (n * interval '1 month'))::date AS month_start
        FROM generate_series(5, 0, -1) AS n
      ),
      disbursed AS (
        SELECT
          date_trunc('month', l."loanDate")::date AS month_start,
          COALESCE(SUM(l.principal), 0) AS disbursed
        FROM "loans" l
        WHERE l."loanDate" >= (date_trunc('month', CURRENT_DATE) - interval '5 month')
          AND l."loanDate" < (date_trunc('month', CURRENT_DATE) + interval '1 month')
          ${dataScopeCondition}
        GROUP BY 1
      ),
      collected AS (
        SELECT
          date_trunc('month', ep."paidDate")::date AS month_start,
          COALESCE(SUM(COALESCE(ep."paidAmount", 0)), 0) AS collected
        FROM "emi_payments" ep
        JOIN "loans" l ON l.id = ep."loanId"
        WHERE ep.status = 'PAID'
          AND ep."paidDate" IS NOT NULL
          AND ep."paidDate" >= (date_trunc('month', CURRENT_DATE) - interval '5 month')
          AND ep."paidDate" < (date_trunc('month', CURRENT_DATE) + interval '1 month')
          ${dataScopeCondition}
        GROUP BY 1
      )
      SELECT
        to_char(m.month_start, 'YYYY-MM') AS key,
        to_char(m.month_start, 'Mon') AS label,
        COALESCE(d.disbursed, 0) AS disbursed,
        COALESCE(c.collected, 0) AS collected
      FROM months m
      LEFT JOIN disbursed d ON d.month_start = m.month_start
      LEFT JOIN collected c ON c.month_start = m.month_start
      ORDER BY m.month_start ASC
    `);

    const chartData = rows.map((row) => ({
      key: row.key,
      label: row.label,
      disbursed: toNumber(row.disbursed),
      collected: toNumber(row.collected),
    }));

    res.json({
      updatedAt: new Date().toISOString(),
      data: chartData,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});

module.exports = router;

