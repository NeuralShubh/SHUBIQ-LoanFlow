require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const DEMO_STAFF_PASSWORD = process.env.DEMO_STAFF_PASSWORD || '';

function calcLoan(principal, rate, weeks, feeRate = 2) {
  const interest = (principal * rate * (weeks / 52)) / 100;
  const fee = (principal * feeRate) / 100;
  const total = principal + interest + fee;
  const emi = total / weeks;

  return {
    interestAmount: Number(interest.toFixed(2)),
    fixedFee: Number(fee.toFixed(2)),
    totalPayable: Number(total.toFixed(2)),
    weeklyEmi: Number(emi.toFixed(2)),
  };
}

function genEmis(loanId, startDate, weeks, emi) {
  const emis = [];
  const start = new Date(startDate);
  for (let i = 1; i <= weeks; i += 1) {
    const dueDate = new Date(start);
    dueDate.setDate(dueDate.getDate() + (i - 1) * 7);
    emis.push({
      loanId,
      emiNumber: i,
      dueDate,
      amount: emi,
      status: 'PENDING',
    });
  }
  return emis;
}

async function getNextCode(model, field, prefix, pad) {
  const rows = await prisma[model].findMany({
    where: { [field]: { startsWith: prefix } },
    select: { [field]: true },
  });
  let maxNum = 0;
  for (const row of rows) {
    const value = row[field];
    const match = new RegExp(`^${prefix}(\\d+)$`).exec(value);
    if (!match) continue;
    const num = parseInt(match[1], 10);
    if (!Number.isNaN(num) && num > maxNum) maxNum = num;
  }
  return `${prefix}${String(maxNum + 1).padStart(pad, '0')}`;
}

async function ensureAdmin() {
  const adminEmail = String(process.env.ADMIN_EMAIL || 'admin@loanflow.com').trim().toLowerCase();
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (admin) return admin;

  const hash = await bcrypt.hash(String(process.env.ADMIN_PASSWORD || 'Admin@12345'), 10);
  admin = await prisma.user.create({
    data: {
      name: String(process.env.ADMIN_NAME || 'System Admin').trim(),
      email: adminEmail,
      password: hash,
      role: 'ADMIN',
      isActive: true,
    },
  });
  return admin;
}

async function getOrCreateStaff(name, email, phone, branchId) {
  const normalizedEmail = email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) return existing;

  const hash = await bcrypt.hash(DEMO_STAFF_PASSWORD, 10);
  return prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      phone,
      password: hash,
      role: 'STAFF',
      branchId,
      isActive: true,
    },
  });
}

async function getOrCreateMember(seed, staffId) {
  const existingByPhone = await prisma.member.findFirst({
    where: { phone: seed.phone, isActive: true },
  });
  if (existingByPhone) return existingByPhone;

  const memberId = await getNextCode('member', 'memberId', 'M', 3);
  return prisma.member.create({
    data: {
      memberId,
      name: seed.name,
      phone: seed.phone,
      aadhar: seed.aadhar,
      area: seed.area,
      branchId: seed.branchId,
      centreId: seed.centreId,
      staffId,
      status: 'ACTIVE',
      isActive: true,
    },
  });
}

async function createDemoLoan(member, staffId, config) {
  const existingLoan = await prisma.loan.findFirst({
    where: {
      memberId: member.id,
      notes: { contains: '[DEMO-SEED]' },
    },
    select: { id: true },
  });
  if (existingLoan) return;

  const loanId = await getNextCode('loan', 'loanId', 'LN', 3);
  const calced = calcLoan(config.principal, config.interestRate, config.durationWeeks, 2);

  const loan = await prisma.loan.create({
    data: {
      loanId,
      memberId: member.id,
      branchId: member.branchId,
      centreId: member.centreId,
      staffId,
      principal: config.principal,
      interestRate: config.interestRate,
      durationWeeks: config.durationWeeks,
      fixedFeeRate: 2,
      ...calced,
      loanDate: new Date(config.loanDate),
      emiStartDate: new Date(config.emiStartDate),
      status: config.status,
      notes: '[DEMO-SEED] Created for VPS testing',
    },
  });

  const emis = genEmis(loan.id, config.emiStartDate, config.durationWeeks, calced.weeklyEmi);
  await prisma.emiPayment.createMany({ data: emis });

  const loanEmis = await prisma.emiPayment.findMany({
    where: { loanId: loan.id },
    orderBy: { emiNumber: 'asc' },
  });

  const paidCount = Math.min(config.paidEmis || 0, loanEmis.length);
  for (let i = 0; i < paidCount; i += 1) {
    const paidDate = new Date(loanEmis[i].dueDate);
    await prisma.emiPayment.update({
      where: { id: loanEmis[i].id },
      data: {
        status: 'PAID',
        paidAmount: calced.weeklyEmi,
        paidDate,
        paymentMethod: i % 2 === 0 ? 'CASH' : 'UPI',
      },
    });
  }

  if (config.overdueFrom && config.overdueFrom <= loanEmis.length) {
    for (let i = config.overdueFrom - 1; i < Math.min(config.overdueFrom + 1, loanEmis.length); i += 1) {
      await prisma.emiPayment.update({
        where: { id: loanEmis[i].id },
        data: { status: 'OVERDUE' },
      });
    }
  }
}

async function main() {
  if (!DEMO_STAFF_PASSWORD || DEMO_STAFF_PASSWORD.length < 8) {
    throw new Error('DEMO_STAFF_PASSWORD is required and must be at least 8 characters.');
  }

  console.log('Seeding demo business data...');

  const admin = await ensureAdmin();

  const branch1Code = await getNextCode('branch', 'code', 'B', 2);
  const branch1 = await prisma.branch.create({
    data: { code: branch1Code, name: 'Demo Branch North', createdById: admin.id, isActive: true },
  });
  const branch2Code = await getNextCode('branch', 'code', 'B', 2);
  const branch2 = await prisma.branch.create({
    data: { code: branch2Code, name: 'Demo Branch South', createdById: admin.id, isActive: true },
  });

  const centre1Code = await getNextCode('centre', 'code', 'C', 2);
  const centre1 = await prisma.centre.create({
    data: { code: centre1Code, name: 'Demo Centre A', branchId: branch1.id, createdById: admin.id, isActive: true },
  });
  const centre2Code = await getNextCode('centre', 'code', 'C', 2);
  const centre2 = await prisma.centre.create({
    data: { code: centre2Code, name: 'Demo Centre B', branchId: branch2.id, createdById: admin.id, isActive: true },
  });

  const staff1 = await getOrCreateStaff('Demo Staff One', 'demo.staff1@loanflow.com', '9000000001', branch1.id);
  const staff2 = await getOrCreateStaff('Demo Staff Two', 'demo.staff2@loanflow.com', '9000000002', branch2.id);

  const members = [];
  members.push(await getOrCreateMember({
    name: 'Ravi Sharma',
    phone: '9000000011',
    aadhar: '1000-2000-3001',
    area: 'North Zone',
    branchId: branch1.id,
    centreId: centre1.id,
  }, staff1.id));
  members.push(await getOrCreateMember({
    name: 'Neha Verma',
    phone: '9000000012',
    aadhar: '1000-2000-3002',
    area: 'North Zone',
    branchId: branch1.id,
    centreId: centre1.id,
  }, staff1.id));
  members.push(await getOrCreateMember({
    name: 'Arjun Nair',
    phone: '9000000013',
    aadhar: '1000-2000-3003',
    area: 'South Zone',
    branchId: branch2.id,
    centreId: centre2.id,
  }, staff2.id));
  members.push(await getOrCreateMember({
    name: 'Kavya Iyer',
    phone: '9000000014',
    aadhar: '1000-2000-3004',
    area: 'South Zone',
    branchId: branch2.id,
    centreId: centre2.id,
  }, staff2.id));

  await prisma.qrCode.createMany({
    data: [
      { name: 'Demo QR North', upiId: 'demo.north@oksbi', isActive: true },
      { name: 'Demo QR South', upiId: 'demo.south@oksbi', isActive: true },
    ],
    skipDuplicates: true,
  });

  await createDemoLoan(members[0], staff1.id, {
    principal: 15000,
    interestRate: 12,
    durationWeeks: 24,
    loanDate: '2026-01-10',
    emiStartDate: '2026-01-17',
    status: 'ACTIVE',
    paidEmis: 5,
  });
  await createDemoLoan(members[1], staff1.id, {
    principal: 22000,
    interestRate: 14,
    durationWeeks: 30,
    loanDate: '2025-12-05',
    emiStartDate: '2025-12-12',
    status: 'OVERDUE',
    paidEmis: 4,
    overdueFrom: 8,
  });
  await createDemoLoan(members[2], staff2.id, {
    principal: 10000,
    interestRate: 10,
    durationWeeks: 20,
    loanDate: '2025-08-01',
    emiStartDate: '2025-08-08',
    status: 'COMPLETED',
    paidEmis: 20,
  });
  await createDemoLoan(members[3], staff2.id, {
    principal: 18000,
    interestRate: 13,
    durationWeeks: 26,
    loanDate: '2026-02-01',
    emiStartDate: '2026-02-08',
    status: 'ACTIVE',
    paidEmis: 2,
  });

  console.log('Demo seed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
