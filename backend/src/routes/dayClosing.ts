import { Router } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRole } from '../lib/auth';
import { AppError } from '../lib/errors';
import { logAudit } from '../lib/audit';

const router = Router();

router.use(authMiddleware);

router.get('/today', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const [sales, purchases, expenses, salePayments, paidSuppliers, goldSold, goldPurchased, silverSold, silverPurchased, existingClose] =
    await Promise.all([
      prisma.sale.aggregate({ where: { createdAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } }, _sum: { grandTotal: true }, _count: true }),
      prisma.purchase.aggregate({ where: { createdAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } }, _sum: { totalCost: true }, _count: true }),
      prisma.expense.aggregate({ where: { date: { gte: start, lt: end }, deletedAt: null }, _sum: { amount: true } }),
      prisma.salePayment.aggregate({ where: { createdAt: { gte: start, lt: end } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { createdAt: { gte: start, lt: end } }, _sum: { amount: true } }),
      prisma.saleItem.aggregate({ where: { sale: { createdAt: { gte: start, lt: end } }, metal: 'GOLD' }, _sum: { netWeight: true } }),
      prisma.purchaseItem.aggregate({ where: { purchase: { createdAt: { gte: start, lt: end } }, metal: 'GOLD' }, _sum: { netWeight: true } }),
      prisma.saleItem.aggregate({ where: { sale: { createdAt: { gte: start, lt: end } }, metal: 'SILVER' }, _sum: { netWeight: true } }),
      prisma.purchaseItem.aggregate({ where: { purchase: { createdAt: { gte: start, lt: end } }, metal: 'SILVER' }, _sum: { netWeight: true } }),
      prisma.dayClosing.findUnique({ where: { closeDate: start } }),
    ]);

  const methodBreakdown = await prisma.salePayment.groupBy({
    by: ['method'],
    where: { createdAt: { gte: start, lt: end } },
    _sum: { amount: true },
  });

  const byMethod: Record<string, number> = {};
  for (const m of methodBreakdown) byMethod[m.method] = m._sum.amount || 0;

  res.json({
    date: start,
    isClosed: !!existingClose,
    existingClose,
    totalSales: sales._sum.grandTotal || 0,
    saleCount: sales._count,
    totalPurchases: purchases._sum.totalCost || 0,
    purchaseCount: purchases._count,
    totalExpenses: expenses._sum.amount || 0,
    salePayments: salePayments._sum.amount || 0,
    supplierPayments: paidSuppliers._sum.amount || 0,
    byMethod,
    goldSoldWeight: goldSold._sum.netWeight || 0,
    goldPurchasedWeight: goldPurchased._sum.netWeight || 0,
    silverSoldWeight: silverSold._sum.netWeight || 0,
    silverPurchasedWeight: silverPurchased._sum.netWeight || 0,
    expectedCash: (byMethod['CASH'] || 0) + (salePayments._sum.amount || 0) - (paidSuppliers._sum.amount || 0) - (expenses._sum.amount || 0),
  });
});

router.post('/close', requireRole(['OWNER']), async (req: AuthRequest, res) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const { actualCash, notes } = req.body;

  const existing = await prisma.dayClosing.findUnique({ where: { closeDate: start } });
  if (existing) throw new AppError('Day already closed', 400);

  const [sales, purchases, expenses, salePayments, paidSuppliers, goldSold, goldPurchased, silverSold, silverPurchased] =
    await Promise.all([
      prisma.sale.aggregate({ where: { createdAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } }, _sum: { grandTotal: true } }),
      prisma.purchase.aggregate({ where: { createdAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } }, _sum: { totalCost: true } }),
      prisma.expense.aggregate({ where: { date: { gte: start, lt: end }, deletedAt: null }, _sum: { amount: true } }),
      prisma.salePayment.aggregate({ where: { createdAt: { gte: start, lt: end } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { createdAt: { gte: start, lt: end } }, _sum: { amount: true } }),
      prisma.saleItem.aggregate({ where: { sale: { createdAt: { gte: start, lt: end } }, metal: 'GOLD' }, _sum: { netWeight: true } }),
      prisma.purchaseItem.aggregate({ where: { purchase: { createdAt: { gte: start, lt: end } }, metal: 'GOLD' }, _sum: { netWeight: true } }),
      prisma.saleItem.aggregate({ where: { sale: { createdAt: { gte: start, lt: end } }, metal: 'SILVER' }, _sum: { netWeight: true } }),
      prisma.purchaseItem.aggregate({ where: { purchase: { createdAt: { gte: start, lt: end } }, metal: 'SILVER' }, _sum: { netWeight: true } }),
    ]);

  const methodBreakdown = await prisma.salePayment.groupBy({
    by: ['method'],
    where: { createdAt: { gte: start, lt: end } },
    _sum: { amount: true },
  });
  const byMethod: Record<string, number> = {};
  for (const m of methodBreakdown) byMethod[m.method] = m._sum.amount || 0;

  const expectedCash = (byMethod['CASH'] || 0) + (salePayments._sum.amount || 0) - (paidSuppliers._sum.amount || 0) - (expenses._sum.amount || 0);
  const diff = Math.round((expectedCash - parseFloat(actualCash || 0)) * 100) / 100;

  const dayClose = await prisma.dayClosing.create({
    data: {
      closeDate: start,
      totalSales: sales._sum.grandTotal || 0,
      totalPurchases: purchases._sum.totalCost || 0,
      totalExpenses: expenses._sum.amount || 0,
      cashSales: byMethod['CASH'] || 0,
      upiSales: byMethod['UPI'] || 0,
      cardSales: byMethod['CARD'] || 0,
      creditSales: byMethod['CREDIT'] || 0,
      bankSales: byMethod['BANK'] || 0,
      otherSales: byMethod['OTHER'] || 0,
      customerPayments: salePayments._sum.amount || 0,
      supplierPayments: paidSuppliers._sum.amount || 0,
      goldSoldWeight: goldSold._sum.netWeight || 0,
      goldPurchasedWeight: goldPurchased._sum.netWeight || 0,
      silverSoldWeight: silverSold._sum.netWeight || 0,
      silverPurchasedWeight: silverPurchased._sum.netWeight || 0,
      expectedCash,
      actualCash: parseFloat(actualCash || 0),
      difference: diff,
      notes: notes || null,
      closedBy: req.user!.id,
    },
  });

  await logAudit({
    userId: req.user!.id,
    action: 'DAY_CLOSE',
    entity: 'DAY_CLOSING',
    recordId: dayClose.id,
    newValue: JSON.stringify({ date: start.toISOString(), expectedCash, actualCash: parseFloat(actualCash || 0), difference: diff }),
  });

  res.status(201).json(dayClose);
});

router.get('/history', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const closings = await prisma.dayClosing.findMany({
    include: { user: { select: { name: true } } },
    orderBy: { closeDate: 'desc' },
    take: 100,
  });
  res.json(closings);
});

export default router;