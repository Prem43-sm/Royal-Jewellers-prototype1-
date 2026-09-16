import { Router } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRole } from '../lib/auth';
import { AppError } from '../lib/errors';
import { logAudit } from '../lib/audit';

const router = Router();

router.use(authMiddleware);

router.get('/', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const category = (req.query.category as string) || '';
  const from = (req.query.from as string) || '';
  const to = (req.query.to as string) || '';

  const where: any = { deletedAt: null };
  if (category) where.category = category;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }

  const [expenses, total, totalAmount] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: { date: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.expense.count({ where }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
  ]);

  res.json({ expenses, total, page, pageSize, totalAmount: totalAmount._sum.amount || 0 });
});

router.get('/categories', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  res.json(['RENT', 'ELECTRICITY', 'SALARY', 'TRANSPORT', 'PACKAGING', 'MAINTENANCE', 'REPAIR', 'ADVERTISEMENT', 'OFFICE', 'MISCELLANEOUS']);
});

router.post('/', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const { description, amount, category, paymentMethod, date, notes } = req.body;
  if (!description) throw new AppError('Description is required', 400);
  const parsedAmount = parseFloat(amount || 0);
  if (!parsedAmount || parsedAmount <= 0) throw new AppError('Valid amount is required', 400);

  const expense = await prisma.expense.create({
    data: {
      description,
      amount: parsedAmount,
      category: category || 'MISCELLANEOUS',
      paymentMethod: paymentMethod || 'CASH',
      date: date ? new Date(date) : new Date(),
      notes: notes || null,
      createdBy: req.user!.id,
    },
  });

  await logAudit({
    userId: req.user!.id,
    action: 'EXPENSE_CREATE',
    entity: 'EXPENSE',
    recordId: expense.id,
    newValue: JSON.stringify({ description, amount: parsedAmount, category }),
  });

  res.status(201).json(expense);
});

router.put('/:id', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) throw new AppError('Expense not found', 404);

  const { description, amount, category, paymentMethod, date, notes } = req.body;
  const expense = await prisma.expense.update({
    where: { id },
    data: {
      description: description || existing.description,
      amount: amount !== undefined ? parseFloat(amount) : existing.amount,
      category: category || existing.category,
      paymentMethod: paymentMethod || existing.paymentMethod,
      date: date ? new Date(date) : existing.date,
      notes: notes !== undefined ? notes : existing.notes,
    },
  });

  await logAudit({
    userId: req.user!.id,
    action: 'EXPENSE_UPDATE',
    entity: 'EXPENSE',
    recordId: id,
    oldValue: JSON.stringify({ amount: existing.amount, description: existing.description }),
    newValue: JSON.stringify({ amount: expense.amount, description: expense.description }),
  });

  res.json(expense);
});

router.delete('/:id', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) throw new AppError('Expense not found', 404);

  const permanent = req.query.permanent === 'true';
  if (permanent) {
    if (req.user!.role !== 'OWNER') throw new AppError('Only the owner can permanently delete records', 403);
    await prisma.expense.delete({ where: { id } });
  } else {
    await prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  await logAudit({
    userId: req.user!.id,
    action: permanent ? 'PERMANENT_DELETE' : 'DELETE',
    entity: 'EXPENSE',
    recordId: id,
    oldValue: JSON.stringify({ amount: existing.amount }),
  });

  res.json({ success: true });
});

router.post('/:id/restore', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const expense = await prisma.expense.update({ where: { id }, data: { deletedAt: null } });
  res.json(expense);
});

export default router;