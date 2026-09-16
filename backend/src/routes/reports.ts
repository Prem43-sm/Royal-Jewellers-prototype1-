import { Router } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRole } from '../lib/auth';
import { AppError } from '../lib/errors';

const router = Router();

router.use(authMiddleware);

function parseDateRanges(req: AuthRequest) {
  const from = req.query.from as string;
  const to = req.query.to as string;
  const where: any = {};
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) {
      const d = new Date(to);
      d.setDate(d.getDate() + 1);
      where.createdAt.lt = d;
    }
  }
  return where;
}

router.get('/sales', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const where = parseDateRanges(req);
  if (req.query.customerId) where.customerId = parseInt(req.query.customerId as string);
  if (req.query.paymentMethod) where.paymentMethod = req.query.paymentMethod;
  where.status = { not: 'CANCELLED' };

  const [sales, totals] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        customer: { select: { name: true, phone: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.sale.aggregate({
      where,
      _sum: { grandTotal: true, discountTotal: true, taxTotal: true, profit: true },
      _count: true,
    }),
  ]);

  const byCategory = await prisma.saleItem.groupBy({
    by: ['metal'],
    where: { sale: where },
    _sum: { total: true },
  });

  res.json({
    sales,
    summary: {
      totalSales: totals._sum.grandTotal || 0,
      totalDiscount: totals._sum.discountTotal || 0,
      totalTax: totals._sum.taxTotal || 0,
      totalProfit: req.user!.role === 'STAFF' ? null : (totals._sum.profit || 0),
      count: totals._count,
    },
    byCategory,
  });
});

router.get('/purchases', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const where = parseDateRanges(req);
  if (req.query.supplierId) where.supplierId = parseInt(req.query.supplierId as string);
  where.status = { not: 'CANCELLED' };

  const [purchases, totals] = await Promise.all([
    prisma.purchase.findMany({
      where,
      include: { supplier: { select: { name: true } }, items: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.purchase.aggregate({ where, _sum: { totalCost: true, paidAmount: true, balanceAmount: true }, _count: true }),
  ]);

  res.json({
    purchases,
    summary: {
      totalPurchases: totals._sum.totalCost || 0,
      totalPaid: totals._sum.paidAmount || 0,
      totalBalance: totals._sum.balanceAmount || 0,
      count: totals._count,
    },
  });
});

router.get('/profit', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const where = parseDateRanges(req);
  where.status = { not: 'CANCELLED' };

  const [sales, expenses, purchases] = await Promise.all([
    prisma.sale.aggregate({ where, _sum: { grandTotal: true, profit: true } }),
    prisma.expense.aggregate({ where: { deletedAt: null, ...(where.createdAt ? { date: where.createdAt } : {}) }, _sum: { amount: true } }),
    prisma.purchase.aggregate({ where: { ...where, status: { not: 'CANCELLED' } }, _sum: { totalCost: true } }),
  ]);

  const grossProfit = sales._sum.profit || 0;
  const totalExpenses = expenses._sum.amount || 0;
  const netProfit = grossProfit - totalExpenses;

  res.json({
    grossSales: sales._sum.grandTotal || 0,
    grossProfit,
    totalExpenses,
    netProfit,
    totalPurchases: purchases._sum.totalCost || 0,
  });
});

router.get('/expenses', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const from = req.query.from as string;
  const to = req.query.to as string;
  const category = req.query.category as string;
  const where: any = { deletedAt: null };
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) {
      const d = new Date(to);
      d.setDate(d.getDate() + 1);
      where.date.lt = d;
    }
  }
  if (category) where.category = category;

  const [expenses, byCategory] = await Promise.all([
    prisma.expense.findMany({ where, include: { user: { select: { name: true } } }, orderBy: { date: 'desc' } }),
    prisma.expense.groupBy({ by: ['category'], where, _sum: { amount: true } }),
  ]);

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  res.json({ expenses, byCategory, total });
});

router.get('/customer-outstanding', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const customers = await prisma.customer.findMany({
    where: { deletedAt: null },
    include: { sales: { select: { grandTotal: true, balanceAmount: true } } },
  });

  const result = customers
    .map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      totalSales: c.sales.reduce((s, x) => s + x.grandTotal, 0),
      outstanding: c.sales.reduce((s, x) => s + x.balanceAmount, 0),
    }))
    .filter((c) => c.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding);

  res.json({ customers: result, totalOutstanding: result.reduce((s, c) => s + c.outstanding, 0) });
});

router.get('/supplier-outstanding', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const suppliers = await prisma.supplier.findMany({
    where: { deletedAt: null },
    include: { purchases: { select: { totalCost: true, balanceAmount: true } } },
  });

  const result = suppliers
    .map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      totalPurchases: s.purchases.reduce((sum, x) => sum + x.totalCost, 0),
      outstanding: s.purchases.reduce((sum, x) => sum + x.balanceAmount, 0),
    }))
    .filter((s) => s.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding);

  res.json({ suppliers: result, totalOutstanding: result.reduce((s, x) => s + x.outstanding, 0) });
});

router.get('/stock', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const metal = (req.query.metal as string) || '';
  const where: any = { status: 'IN_STOCK', deletedAt: null };
  if (metal) where.metal = metal;

  const [products, byMetal, byPurity, byCategory] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.groupBy({ by: ['metal'], where, _sum: { netWeight: true } }),
    prisma.product.groupBy({ by: ['metal', 'purity'], where, _sum: { netWeight: true } }),
    prisma.product.groupBy({ by: ['categoryId'], where, _sum: { netWeight: true } }),
  ]);

  res.json({ products, byMetal, byPurity, byCategory });
});

router.get('/metal-ledger', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const metal = (req.query.metal as string) || 'GOLD';
  const purity = req.query.purity ? parseFloat(req.query.purity as string) : undefined;

  const where: any = { metal };
  if (purity) where.purity = purity;

  const movements = await prisma.stockMovement.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });

  let balance = 0;
  const ledger = movements.map((m) => {
    balance += m.weight;
    return { ...m, runningBalance: Math.round(balance * 100) / 100 };
  });

  const byType = await prisma.stockMovement.groupBy({
    by: ['movementType'],
    where,
    _sum: { weight: true },
  });

  res.json({ movements: ledger, byType, closingBalance: Math.round(balance * 100) / 100 });
});

router.get('/sales-summary', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [today, month, allTime] = await Promise.all([
    prisma.sale.aggregate({ where: { createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) }, status: { not: 'CANCELLED' } }, _sum: { grandTotal: true }, _count: true }),
    prisma.sale.aggregate({ where: { createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } }, _sum: { grandTotal: true }, _count: true }),
    prisma.sale.aggregate({ where: { status: { not: 'CANCELLED' } }, _sum: { grandTotal: true }, _count: true }),
  ]);

  res.json({
    today: { total: today._sum.grandTotal || 0, count: today._count },
    month: { total: month._sum.grandTotal || 0, count: month._count },
    allTime: { total: allTime._sum.grandTotal || 0, count: allTime._count },
  });
});

router.get('/old-gold', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const from = req.query.from as string;
  const to = req.query.to as string;
  const where: any = {};
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) {
      const d = new Date(to);
      d.setDate(d.getDate() + 1);
      where.createdAt.lt = d;
    }
  }

  const [exchanges, totals] = await Promise.all([
    prisma.oldGoldExchange.findMany({
      where,
      include: { customer: { select: { name: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.oldGoldExchange.aggregate({ where, _sum: { grossWeight: true, fineGoldWeight: true, finalValue: true } }),
  ]);

  res.json({
    exchanges,
    summary: {
      totalGrossWeight: totals._sum.grossWeight || 0,
      totalFineWeight: totals._sum.fineGoldWeight || 0,
      totalValue: totals._sum.finalValue || 0,
    },
  });
});

router.get('/payments', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const from = req.query.from as string;
  const to = req.query.to as string;
  const method = req.query.method as string;

  const where: any = {};
  if (method) where.method = method;

  const dateFilter: any = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) {
    const d = new Date(to);
    d.setDate(d.getDate() + 1);
    dateFilter.lt = d;
  }

  const [salePayments, customerPayments, supplierPayments] = await Promise.all([
    prisma.salePayment.findMany({
      where: { ...where, ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}) },
      include: { sale: { select: { invoiceNumber: true } }, user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.customerPayment.findMany({
      where: { ...where, ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}) },
      include: { customer: { select: { name: true } }, user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.payment.findMany({
      where: { ...where, ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}) },
      include: { supplier: { select: { name: true } }, user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  res.json({ salePayments, customerPayments, supplierPayments });
});

export default router;