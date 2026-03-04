require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

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

  for (let i = 1; i <= weeks; i++) {
    const due = new Date(start);
    due.setDate(due.getDate() + (i - 1) * 7);
    emis.push({
      loanId,
      emiNumber: i,
      dueDate: due,
      amount: emi,
      status: 'PENDING',
    });
  }

  return emis;
}

async function main() {
  console.log('Resetting and seeding database...');

  await prisma.emiPayment.deleteMany({});
  await prisma.loan.deleteMany({});
  await prisma.member.deleteMany({});
  await prisma.centre.deleteMany({});
  await prisma.qrCode.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.branch.deleteMany({});

  const adminPass = await bcrypt.hash('admin1234', 10);
  await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@loanflow.com',
      password: adminPass,
      role: 'ADMIN',
      isActive: true,
    },
  });

  const b1 = await prisma.branch.create({ data: { code: 'B01', name: 'Pune Main' } });
  const b2 = await prisma.branch.create({ data: { code: 'B02', name: 'Pimpri' } });
  const b3 = await prisma.branch.create({ data: { code: 'B03', name: 'Kothrud' } });

  const c1 = await prisma.centre.create({ data: { code: 'C01', name: 'Kasba Peth Centre', branchId: b1.id } });
  const c2 = await prisma.centre.create({ data: { code: 'C02', name: 'Pimpri Centre', branchId: b2.id } });
  const c3 = await prisma.centre.create({ data: { code: 'C03', name: 'Kothrud Centre', branchId: b3.id } });
  const c4 = await prisma.centre.create({ data: { code: 'C04', name: 'Shivaji Nagar Centre', branchId: b1.id } });
  const c5 = await prisma.centre.create({ data: { code: 'C05', name: 'Aundh Centre', branchId: b3.id } });

  const staff1 = await prisma.user.create({
    data: {
      name: 'Ram Kumar',
      email: 'ram@loanflow.com',
      phone: '9876543001',
      password: await bcrypt.hash('ram1234', 10),
      role: 'STAFF',
      branchId: b1.id,
      isActive: true,
    },
  });

  const staff2 = await prisma.user.create({
    data: {
      name: 'Sham Patil',
      email: 'sham@loanflow.com',
      phone: '9876543002',
      password: await bcrypt.hash('sham1234', 10),
      role: 'STAFF',
      branchId: b2.id,
      isActive: true,
    },
  });

  const staff3 = await prisma.user.create({
    data: {
      name: 'Sita Deshmukh',
      email: 'sita@loanflow.com',
      phone: '9876543003',
      password: await bcrypt.hash('sita1234', 10),
      role: 'STAFF',
      branchId: b3.id,
      isActive: true,
    },
  });

  const staff4 = await prisma.user.create({
    data: {
      name: 'Gita Sharma',
      email: 'gita@loanflow.com',
      phone: '9876543004',
      password: await bcrypt.hash('gita1234', 10),
      role: 'STAFF',
      branchId: b1.id,
      isActive: true,
    },
  });

  const memberSeed = [
    { memberId: 'M001', name: 'Savita Patil', phone: '9876543210', aadhar: '1111-2222-3333', area: 'Kasba Peth', branchId: b1.id, centreId: c1.id, staffId: staff1.id },
    { memberId: 'M002', name: 'Anita More', phone: '9876543211', aadhar: '2222-3333-4444', area: 'Pimpri Camp', branchId: b2.id, centreId: c2.id, staffId: staff2.id },
    { memberId: 'M003', name: 'Prakash Jadhav', phone: '9876543212', aadhar: '3333-4444-5555', area: 'Kothrud', branchId: b3.id, centreId: c3.id, staffId: staff3.id },
    { memberId: 'M004', name: 'Sunita Wagh', phone: '9876543213', aadhar: '4444-5555-6666', area: 'Shivaji Nagar', branchId: b1.id, centreId: c4.id, staffId: staff4.id },
    { memberId: 'M005', name: 'Ramesh Shinde', phone: '9876543214', aadhar: '5555-6666-7777', area: 'Pimpri', branchId: b2.id, centreId: c2.id, staffId: staff2.id },
    { memberId: 'M006', name: 'Deepa Mane', phone: '9876543215', aadhar: '6666-7777-8888', area: 'Aundh', branchId: b3.id, centreId: c5.id, staffId: staff3.id },
    { memberId: 'M007', name: 'Ganesh Kale', phone: '9876543216', aadhar: '7777-8888-9999', area: 'Erandwane', branchId: b1.id, centreId: c4.id, staffId: staff4.id },
    { memberId: 'M008', name: 'Meena Joshi', phone: '9876543217', aadhar: '8888-9999-0000', area: 'Bhosari', branchId: b2.id, centreId: c2.id, staffId: staff2.id },
    { memberId: 'M009', name: 'Kiran Pawar', phone: '9876543218', aadhar: '9999-0000-1111', area: 'Karve Nagar', branchId: b3.id, centreId: c3.id, staffId: staff3.id },
    { memberId: 'M010', name: 'Pooja Salunke', phone: '9876543219', aadhar: '1212-3434-5656', area: 'Warje', branchId: b1.id, centreId: c1.id, staffId: staff4.id },
    { memberId: 'M011', name: 'Nilesh More', phone: '9876543220', aadhar: '2323-4545-6767', area: 'Akurdi', branchId: b2.id, centreId: c2.id, staffId: staff2.id },
    { memberId: 'M012', name: 'Vaishali Patankar', phone: '9876543221', aadhar: '3434-5656-7878', area: 'Baner', branchId: b3.id, centreId: c5.id, staffId: staff3.id },
  ];

  const members = [];
  for (const m of memberSeed) {
    members.push(await prisma.member.create({ data: m }));
  }

  await prisma.qrCode.createMany({
    data: [
      { name: 'B01 Main Counter', upiId: 'loanflow.b01@oksbi', isActive: true },
      { name: 'B02 Counter', upiId: 'loanflow.b02@oksbi', isActive: true },
      { name: 'B03 Counter', upiId: 'loanflow.b03@oksbi', isActive: true },
    ],
  });

  const loanConfigs = [
    { loanId: 'LN001', member: members[0], staffId: staff1.id, principal: 15000, interestRate: 12, durationWeeks: 24, loanDate: '2026-01-15', emiStartDate: '2026-01-22', status: 'ACTIVE', paidEmis: 8, overdueFrom: null },
    { loanId: 'LN002', member: members[1], staffId: staff2.id, principal: 22000, interestRate: 14, durationWeeks: 30, loanDate: '2025-12-10', emiStartDate: '2025-12-17', status: 'OVERDUE', paidEmis: 5, overdueFrom: 10 },
    { loanId: 'LN003', member: members[2], staffId: staff3.id, principal: 10000, interestRate: 10, durationWeeks: 20, loanDate: '2025-08-01', emiStartDate: '2025-08-08', status: 'COMPLETED', paidEmis: 20, overdueFrom: null },
    { loanId: 'LN004', member: members[3], staffId: staff4.id, principal: 18000, interestRate: 13, durationWeeks: 26, loanDate: '2026-02-01', emiStartDate: '2026-02-08', status: 'ACTIVE', paidEmis: 3, overdueFrom: null },
    { loanId: 'LN005', member: members[4], staffId: staff2.id, principal: 25000, interestRate: 15, durationWeeks: 36, loanDate: '2026-01-05', emiStartDate: '2026-01-12', status: 'ACTIVE', paidEmis: 6, overdueFrom: null },
    { loanId: 'LN006', member: members[5], staffId: staff3.id, principal: 12000, interestRate: 11, durationWeeks: 18, loanDate: '2025-11-20', emiStartDate: '2025-11-27', status: 'COMPLETED', paidEmis: 18, overdueFrom: null },
    { loanId: 'LN007', member: members[6], staffId: staff4.id, principal: 30000, interestRate: 16, durationWeeks: 40, loanDate: '2025-10-10', emiStartDate: '2025-10-17', status: 'OVERDUE', paidEmis: 9, overdueFrom: 14 },
    { loanId: 'LN008', member: members[7], staffId: staff2.id, principal: 14000, interestRate: 12.5, durationWeeks: 22, loanDate: '2026-02-12', emiStartDate: '2026-02-19', status: 'ACTIVE', paidEmis: 2, overdueFrom: null },
    { loanId: 'LN009', member: members[8], staffId: staff3.id, principal: 19500, interestRate: 13.5, durationWeeks: 28, loanDate: '2025-09-01', emiStartDate: '2025-09-08', status: 'CANCELLED', paidEmis: 0, overdueFrom: null },
    { loanId: 'LN010', member: members[9], staffId: staff4.id, principal: 11000, interestRate: 10.5, durationWeeks: 16, loanDate: '2026-01-28', emiStartDate: '2026-02-04', status: 'ACTIVE', paidEmis: 4, overdueFrom: null },
    { loanId: 'LN011', member: members[10], staffId: staff2.id, principal: 26000, interestRate: 15.5, durationWeeks: 32, loanDate: '2025-07-15', emiStartDate: '2025-07-22', status: 'COMPLETED', paidEmis: 32, overdueFrom: null },
    { loanId: 'LN012', member: members[11], staffId: staff3.id, principal: 17500, interestRate: 12.75, durationWeeks: 24, loanDate: '2025-12-20', emiStartDate: '2025-12-27', status: 'OVERDUE', paidEmis: 7, overdueFrom: 11 },
  ];

  for (const cfg of loanConfigs) {
    const calced = calcLoan(cfg.principal, cfg.interestRate, cfg.durationWeeks);

    const loan = await prisma.loan.create({
      data: {
        loanId: cfg.loanId,
        memberId: cfg.member.id,
        branchId: cfg.member.branchId,
        centreId: cfg.member.centreId,
        staffId: cfg.staffId,
        principal: cfg.principal,
        interestRate: cfg.interestRate,
        durationWeeks: cfg.durationWeeks,
        fixedFeeRate: 2,
        ...calced,
        loanDate: new Date(cfg.loanDate),
        emiStartDate: new Date(cfg.emiStartDate),
        status: cfg.status,
      },
    });

    const emis = genEmis(loan.id, cfg.emiStartDate, cfg.durationWeeks, calced.weeklyEmi);
    await prisma.emiPayment.createMany({ data: emis });

    const loanEmis = await prisma.emiPayment.findMany({
      where: { loanId: loan.id },
      orderBy: { emiNumber: 'asc' },
    });

    for (let i = 0; i < cfg.paidEmis && i < loanEmis.length; i++) {
      const paidAt = new Date(loanEmis[i].dueDate);
      paidAt.setDate(paidAt.getDate() + (i % 3)); // spread collections around due dates for realistic monthly recovery
      await prisma.emiPayment.update({
        where: { id: loanEmis[i].id },
        data: {
          status: 'PAID',
          paidAmount: calced.weeklyEmi,
          paidDate: paidAt,
          paymentMethod: i % 2 === 0 ? 'CASH' : 'UPI',
        },
      });
    }

    if (cfg.overdueFrom) {
      for (let i = cfg.overdueFrom - 1; i < Math.min(cfg.overdueFrom + 2, loanEmis.length); i++) {
        await prisma.emiPayment.update({
          where: { id: loanEmis[i].id },
          data: { status: 'OVERDUE' },
        });
      }
    }

    if (cfg.status === 'CANCELLED') {
      for (const emi of loanEmis) {
        await prisma.emiPayment.update({
          where: { id: emi.id },
          data: { status: 'PENDING' },
        });
      }
    }
  }

  console.log('Seed complete with fresh expanded test dataset.');
  console.log('Admin: admin@loanflow.com / admin1234');
  console.log('Staff 1: ram@loanflow.com / ram1234');
  console.log('Staff 2: sham@loanflow.com / sham1234');
  console.log('Staff 3: sita@loanflow.com / sita1234');
  console.log('Staff 4: gita@loanflow.com / gita1234');
  console.log('Members: 12, Loans: 12');
}

main().catch(console.error).finally(() => prisma.$disconnect());
