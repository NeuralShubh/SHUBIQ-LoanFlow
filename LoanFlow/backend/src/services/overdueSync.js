async function syncOverdueStatuses(prisma) {
  const now = new Date();

  const updated = await prisma.emiPayment.updateMany({
    where: { status: 'PENDING', dueDate: { lt: now } },
    data: { status: 'OVERDUE' },
  });

  const overdueLoans = await prisma.emiPayment.findMany({
    where: { status: 'OVERDUE' },
    select: { loanId: true },
    distinct: ['loanId'],
  });

  if (overdueLoans.length > 0) {
    await prisma.loan.updateMany({
      where: {
        id: { in: overdueLoans.map((e) => e.loanId) },
        status: 'ACTIVE',
      },
      data: { status: 'OVERDUE' },
    });
  }

  return updated.count;
}

module.exports = { syncOverdueStatuses };

