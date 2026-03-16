const prisma = require('../lib/prisma');

const ACTIONS = {
  BRANCH_DELETE: 'BRANCH_DELETE',
  CENTRE_DELETE: 'CENTRE_DELETE',
  MEMBER_DELETE: 'MEMBER_DELETE',
  STAFF_DELETE: 'STAFF_DELETE',
  QR_DELETE: 'QR_DELETE',
};

async function getPendingApproval(actionType, targetId) {
  return prisma.approvalRequest.findFirst({
    where: { actionType, targetId, status: 'PENDING' },
  });
}

async function createApprovalRequest({ actionType, targetType, targetId, requestedById, payload }) {
  return prisma.approvalRequest.create({
    data: { actionType, targetType, targetId, requestedById, payload },
  });
}

async function executeApprovalAction(approval) {
  const { actionType, targetId } = approval;

  if (actionType === ACTIONS.BRANCH_DELETE) {
    const branch = await prisma.branch.findUnique({
      where: { id: targetId },
      include: { _count: { select: { centres: { where: { isActive: true } } } } },
    });
    if (!branch || !branch.isActive) throw new Error('Branch not found');
    if ((branch._count.centres || 0) > 0) throw new Error('Branch must have no active centres before delete');
    await prisma.branch.update({ where: { id: targetId }, data: { isActive: false } });
    return;
  }

  if (actionType === ACTIONS.CENTRE_DELETE) {
    const centre = await prisma.centre.findUnique({
      where: { id: targetId },
      include: { _count: { select: { members: { where: { isActive: true } } } } },
    });
    if (!centre || !centre.isActive) throw new Error('Centre not found');
    if ((centre._count.members || 0) > 0) throw new Error('Centre must have no members before delete');
    await prisma.centre.update({ where: { id: targetId }, data: { isActive: false } });
    return;
  }

  if (actionType === ACTIONS.MEMBER_DELETE) {
    const member = await prisma.member.findUnique({ where: { id: targetId } });
    if (!member) throw new Error('Member not found');
    await prisma.$transaction(async (tx) => {
      await tx.emiPayment.deleteMany({ where: { loan: { memberId: member.id } } });
      await tx.loan.deleteMany({ where: { memberId: member.id } });
      await tx.member.delete({ where: { id: member.id } });
    });
    return;
  }

  if (actionType === ACTIONS.STAFF_DELETE) {
    const staff = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, role: true } });
    if (!staff || staff.role !== 'STAFF') throw new Error('Staff not found');
    await prisma.$transaction(async (tx) => {
      await tx.emiPayment.deleteMany({ where: { loan: { staffId: staff.id } } });
      await tx.loan.deleteMany({ where: { staffId: staff.id } });
      await tx.member.deleteMany({ where: { staffId: staff.id } });
      await tx.user.update({ where: { id: staff.id }, data: { isActive: false, branchId: null } });
    });
    return;
  }

  if (actionType === ACTIONS.QR_DELETE) {
    const qr = await prisma.qrCode.findUnique({ where: { id: targetId } });
    if (!qr) throw new Error('QR code not found');
    await prisma.qrCode.update({ where: { id: targetId }, data: { isActive: false } });
    return;
  }

  throw new Error('Unsupported approval action');
}

module.exports = { ACTIONS, getPendingApproval, createApprovalRequest, executeApprovalAction };