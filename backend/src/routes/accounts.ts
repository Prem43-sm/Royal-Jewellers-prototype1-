import { Router } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRole } from '../lib/auth';
import { AppError } from '../lib/errors';
import { logAudit } from '../lib/audit';

const router = Router();

router.use(authMiddleware);

router.get('/', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const accounts = await prisma.account.findMany({
    include: {
      _count: { select: { transactions: true } },
    },
    orderBy: { name: 'asc' },
  });
  res.json(accounts);
});

router.post('/', requireRole(['OWNER']), async (req: AuthRequest, res) => {
  const { name, type } = req.body;
  if (!name) throw new AppError('Account name is required', 400);
  const account = await prisma.account.create({
    data: { name, type: type || 'BANK' },
  });
  await logAudit({ userId: req.user!.id, action: 'ACCOUNT_CREATE', entity: 'ACCOUNT', recordId: account.id });
  res.status(201).json(account);
});

router.get('/:id/transactions', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const transactions = await prisma.accountTransaction.findMany({
    where: { accountId: id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(transactions);
});

export default router;