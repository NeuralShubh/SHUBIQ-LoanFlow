const { PrismaClient } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.__loanflowPrisma) {
    global.__loanflowPrisma = new PrismaClient();
  }
  prisma = global.__loanflowPrisma;
}

module.exports = prisma;

