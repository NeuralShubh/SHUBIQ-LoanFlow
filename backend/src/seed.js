require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DEFAULT_ADMIN_NAME = 'System Admin';
const DEFAULT_ADMIN_EMAIL = 'admin@loanflow.com';
const DEFAULT_ADMIN_PASSWORD = 'LoanFlow@2026#Admin';

async function main() {
  const adminName = String(process.env.ADMIN_NAME || DEFAULT_ADMIN_NAME).trim();
  const adminEmail = String(process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD);

  if (!adminEmail || !adminPassword) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be provided.');
  }
  if (adminPassword.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters.');
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: adminName,
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log(`Updated admin account: ${adminEmail}`);
  } else {
    await prisma.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log(`Created admin account: ${adminEmail}`);
  }

  console.log('Seed completed without demo/staff/sample records.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
