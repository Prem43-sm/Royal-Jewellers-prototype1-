import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRole } from '../lib/auth';
import { AppError } from '../lib/errors';
import { logAudit } from '../lib/audit';

const router = Router();

router.use(authMiddleware);

router.get('/', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const search = (req.query.search as string) || '';

  const where: any = { deletedAt: null };
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { phone: { contains: search } },
      { email: { contains: search } },
    ];
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customer.count({ where }),
  ]);

  const withBalance = await Promise.all(
    customers.map(async (c) => {
      const tr = await prisma.customerTransaction.aggregate({
        where: { customerId: c.id },
        _sum: { amount: true, balanceAfter: true },
      });
      return { ...c, totalBalance: tr._sum.balanceAfter || 0 };
    })
  );

  res.json({ customers: withBalance, total, page, pageSize });
});

router.get('/:id', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      sales: { include: { items: true }, orderBy: { createdAt: 'desc' }, take: 50 },
      transactions: { orderBy: { createdAt: 'desc' }, take: 100 },
      payments: { orderBy: { createdAt: 'desc' }, take: 100 },
      oldGoldExchanges: { orderBy: { createdAt: 'desc' }, take: 50 },
      orders: { orderBy: { createdAt: 'desc' }, take: 50 },
      repairs: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  });
  if (!customer) throw new AppError('Customer not found', 404);

  const tr = await prisma.customerTransaction.aggregate({
    where: { customerId: id },
    _sum: { amount: true, balanceAfter: true },
  });

  res.json({ ...customer, totalBalance: tr._sum.balanceAfter || 0 });
});

router.post(
  '/',
  requireRole(['OWNER', 'MANAGER', 'STAFF']),
  body('name').notEmpty().withMessage('Customer name is required'),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, phone, email, address, gstNumber, notes } = req.body;
    if (!phone && !email && !address) {
      throw new AppError('At least one contact detail (phone, email, or address) is required', 400);
    }

    const customer = await prisma.customer.create({
      data: { name, phone, email, address, gstNumber, notes },
    });

    await logAudit({
      userId: req.user!.id,
      action: 'CREATE',
      entity: 'CUSTOMER',
      recordId: customer.id,
      newValue: JSON.stringify({ name, phone }),
    });

    res.status(201).json(customer);
  }
);

router.put('/:id', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) throw new AppError('Customer not found', 404);

  const { name, phone, email, address, gstNumber, notes } = req.body;
  const customer = await prisma.customer.update({
    where: { id },
    data: { name, phone, email, address, gstNumber, notes },
  });

  await logAudit({
    userId: req.user!.id,
    action: 'UPDATE',
    entity: 'CUSTOMER',
    recordId: id,
    oldValue: JSON.stringify({ name: existing.name, phone: existing.phone }),
    newValue: JSON.stringify({ name, phone }),
  });

  res.json(customer);
});

router.delete('/:id', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) throw new AppError('Customer not found', 404);

  const permanent = req.query.permanent === 'true';
  if (permanent) {
    if (req.user!.role !== 'OWNER') throw new AppError('Only the owner can permanently delete records', 403);
    await prisma.customer.delete({ where: { id } });
  } else {
    await prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  await logAudit({
    userId: req.user!.id,
    action: permanent ? 'PERMANENT_DELETE' : 'DELETE',
    entity: 'CUSTOMER',
    recordId: id,
    oldValue: JSON.stringify({ name: existing.name, balance: existing.name }),
  });

  res.json({ success: true });
});

router.post('/:id/restore', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const customer = await prisma.customer.update({ where: { id }, data: { deletedAt: null } });
  await logAudit({ userId: req.user!.id, action: 'RESTORE', entity: 'CUSTOMER', recordId: id });
  res.json(customer);
});

router.get('/:id/transactions', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const transactions = await prisma.customerTransaction.findMany({
    where: { customerId: id },
    orderBy: { createdAt: 'desc' },
  });
  res.json(transactions);
});

router.post(
  '/:id/payments',
  requireRole(['OWNER', 'MANAGER', 'STAFF']),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const id = parseInt(req.params.id);
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new AppError('Customer not found', 404);

    const { amount, method, notes } = req.body;
    const parsedAmount = parseFloat(amount);

    const latest = await prisma.customerTransaction.findFirst({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
    });

    const currentBalance = latest?.balanceAfter || 0;
    const newBalance = currentBalance - parsedAmount;

    const payment = await prisma.customerPayment.create({
      data: {
        customerId: id,
        amount: parsedAmount,
        method: method || 'CASH',
        notes,
        createdBy: req.user!.id,
      },
    });

    await prisma.customerTransaction.create({
      data: {
        customerId: id,
        type: 'CUSTOMER_PAYMENT',
        amount: -parsedAmount,
        balanceAfter: newBalance,
        description: `Payment received (${method || 'CASH'})${notes ? ': ' + notes : ''}`,
        referenceId: payment.id,
      },
    });

    await logAudit({
      userId: req.user!.id,
      action: 'CUSTOMER_PAYMENT',
      entity: 'CUSTOMER',
      recordId: id,
      newValue: JSON.stringify({ amount: parsedAmount, method, oldBalance: currentBalance, newBalance }),
    });

    res.status(201).json(payment);
  }
);

export default router;