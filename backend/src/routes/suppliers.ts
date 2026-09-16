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
      { contactPerson: { contains: search } },
      { phone: { contains: search } },
      { email: { contains: search } },
    ];
  }

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.supplier.count({ where }),
  ]);

  const withBalance = await Promise.all(
    suppliers.map(async (s) => {
      const tr = await prisma.supplierTransaction.aggregate({
        where: { supplierId: s.id },
        _sum: { amount: true, balanceAfter: true },
      });
      return { ...s, totalBalance: tr._sum.balanceAfter || 0 };
    })
  );

  res.json({ suppliers: withBalance, total, page, pageSize });
});

router.get('/:id', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      purchases: { include: { items: true }, orderBy: { createdAt: 'desc' }, take: 50 },
      transactions: { orderBy: { createdAt: 'desc' }, take: 100 },
      payments: { orderBy: { createdAt: 'desc' }, take: 100 },
      products: { where: { deletedAt: null }, take: 50, select: { id: true, itemCode: true, name: true, netWeight: true, purity: true, status: true } },
    },
  });
  if (!supplier) throw new AppError('Supplier not found', 404);

  const tr = await prisma.supplierTransaction.aggregate({
    where: { supplierId: id },
    _sum: { amount: true, balanceAfter: true },
  });

  res.json({ ...supplier, totalBalance: tr._sum.balanceAfter || 0 });
});

router.post(
  '/',
  requireRole(['OWNER', 'MANAGER', 'STAFF']),
  body('name').notEmpty().withMessage('Supplier name is required'),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, contactPerson, phone, email, address, gstNumber, bankName, bankAccount, ifsc, notes } = req.body;

    const supplier = await prisma.supplier.create({
      data: { name, contactPerson, phone, email, address, gstNumber, bankName, bankAccount, ifsc, notes },
    });

    await logAudit({
      userId: req.user!.id,
      action: 'CREATE',
      entity: 'SUPPLIER',
      recordId: supplier.id,
      newValue: JSON.stringify({ name, phone }),
    });

    res.status(201).json(supplier);
  }
);

router.put('/:id', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) throw new AppError('Supplier not found', 404);

  const { name, contactPerson, phone, email, address, gstNumber, bankName, bankAccount, ifsc, notes } = req.body;
  const supplier = await prisma.supplier.update({
    where: { id },
    data: { name, contactPerson, phone, email, address, gstNumber, bankName, bankAccount, ifsc, notes },
  });

  await logAudit({
    userId: req.user!.id,
    action: 'UPDATE',
    entity: 'SUPPLIER',
    recordId: id,
    newValue: JSON.stringify({ name, phone }),
  });

  res.json(supplier);
});

router.delete('/:id', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) throw new AppError('Supplier not found', 404);

  const permanent = req.query.permanent === 'true';
  if (permanent) {
    if (req.user!.role !== 'OWNER') throw new AppError('Only the owner can permanently delete records', 403);
    await prisma.supplier.delete({ where: { id } });
  } else {
    await prisma.supplier.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  await logAudit({
    userId: req.user!.id,
    action: permanent ? 'PERMANENT_DELETE' : 'DELETE',
    entity: 'SUPPLIER',
    recordId: id,
    oldValue: JSON.stringify({ name: existing.name }),
  });

  res.json({ success: true });
});

router.post('/:id/restore', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const supplier = await prisma.supplier.update({ where: { id }, data: { deletedAt: null } });
  await logAudit({ userId: req.user!.id, action: 'RESTORE', entity: 'SUPPLIER', recordId: id });
  res.json(supplier);
});

router.get('/:id/transactions', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const transactions = await prisma.supplierTransaction.findMany({
    where: { supplierId: id },
    orderBy: { createdAt: 'desc' },
  });
  res.json(transactions);
});

router.post(
  '/:id/payments',
  requireRole(['OWNER', 'MANAGER']),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const id = parseInt(req.params.id);
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new AppError('Supplier not found', 404);

    const { amount, method, notes } = req.body;
    const parsedAmount = parseFloat(amount);

    const latest = await prisma.supplierTransaction.findFirst({
      where: { supplierId: id },
      orderBy: { createdAt: 'desc' },
    });
    const currentBalance = latest?.balanceAfter || 0;
    const newBalance = currentBalance - parsedAmount;

    const payment = await prisma.payment.create({
      data: {
        supplierId: id,
        amount: parsedAmount,
        method: method || 'CASH',
        notes,
        createdBy: req.user!.id,
      },
    });

    await prisma.supplierTransaction.create({
      data: {
        supplierId: id,
        type: 'SUPPLIER_PAYMENT',
        amount: -parsedAmount,
        balanceAfter: newBalance,
        description: `Payment made (${method || 'CASH'})${notes ? ': ' + notes : ''}`,
        referenceId: payment.id,
      },
    });

    await logAudit({
      userId: req.user!.id,
      action: 'SUPPLIER_PAYMENT',
      entity: 'SUPPLIER',
      recordId: id,
      newValue: JSON.stringify({ amount: parsedAmount, method, oldBalance: currentBalance, newBalance }),
    });

    res.status(201).json(payment);
  }
);

export default router;