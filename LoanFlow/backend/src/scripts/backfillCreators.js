const prisma = require('../lib/prisma');

async function pickAdminId() {
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!admin) {
    throw new Error('No active admin found for fallback ownership.');
  }
  return admin.id;
}

async function mostFrequentStaffFromMembers(where) {
  const members = await prisma.member.findMany({
    where: { ...where, staffId: { not: null } },
    select: { staffId: true },
  });
  if (members.length === 0) return null;

  const freq = new Map();
  for (const m of members) {
    if (!m.staffId) continue;
    freq.set(m.staffId, (freq.get(m.staffId) || 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

async function mostFrequentStaffFromLoans(where) {
  const loans = await prisma.loan.findMany({
    where: { ...where, staffId: { not: null } },
    select: { staffId: true },
  });
  if (loans.length === 0) return null;

  const freq = new Map();
  for (const l of loans) {
    if (!l.staffId) continue;
    freq.set(l.staffId, (freq.get(l.staffId) || 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

async function earliestStaffInBranch(branchId) {
  const user = await prisma.user.findFirst({
    where: { role: 'STAFF', isActive: true, branchId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return user?.id || null;
}

async function backfillBranches(adminId) {
  const branches = await prisma.branch.findMany({
    where: { createdById: null },
    select: { id: true, code: true, name: true },
  });

  let updated = 0;
  for (const branch of branches) {
    let ownerId = await mostFrequentStaffFromMembers({ branchId: branch.id });
    if (!ownerId) {
      ownerId = await mostFrequentStaffFromLoans({ branchId: branch.id });
    }
    if (!ownerId) {
      ownerId = await earliestStaffInBranch(branch.id);
    }
    if (!ownerId) {
      ownerId = adminId;
    }

    await prisma.branch.update({
      where: { id: branch.id },
      data: { createdById: ownerId },
    });
    updated += 1;
  }

  return { total: branches.length, updated };
}

async function backfillCentres(adminId) {
  const centres = await prisma.centre.findMany({
    where: { createdById: null },
    select: { id: true, code: true, name: true, branchId: true },
  });

  let updated = 0;
  for (const centre of centres) {
    let ownerId = await mostFrequentStaffFromMembers({ centreId: centre.id });
    if (!ownerId) {
      ownerId = await mostFrequentStaffFromLoans({ centreId: centre.id });
    }
    if (!ownerId) {
      const branch = await prisma.branch.findUnique({
        where: { id: centre.branchId },
        select: { createdById: true },
      });
      ownerId = branch?.createdById || null;
    }
    if (!ownerId) {
      ownerId = await earliestStaffInBranch(centre.branchId);
    }
    if (!ownerId) {
      ownerId = adminId;
    }

    await prisma.centre.update({
      where: { id: centre.id },
      data: { createdById: ownerId },
    });
    updated += 1;
  }

  return { total: centres.length, updated };
}

async function main() {
  const adminId = await pickAdminId();
  const branchResult = await backfillBranches(adminId);
  const centreResult = await backfillCentres(adminId);

  const remaining = await prisma.$transaction([
    prisma.branch.count({ where: { createdById: null } }),
    prisma.centre.count({ where: { createdById: null } }),
  ]);

  console.log(
    JSON.stringify(
      {
        backfill: {
          branches: branchResult,
          centres: centreResult,
        },
        remainingNullCreatedBy: {
          branches: remaining[0],
          centres: remaining[1],
        },
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
