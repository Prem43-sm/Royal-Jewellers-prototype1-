import { Router } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRole } from '../lib/auth';

const router = Router();

router.get('/', authMiddleware, requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    todaySales,
    todaySalesCount,
    todayPurchases,
    todayPurchasesWeight,
    todayExpenses,
    customerOutstanding,
    supplierOutstanding,
    goldStock,
    silverStock,
    todayRates,
    pendingOrders,
    pendingJobWork,
    pendingRepairs,
    recentSales,
    lowStock,
    customerDues,
    supplierDues,
  ] = await Promise.all([
    prisma.sale.aggregate({ where: { createdAt: { gte: todayStart, lt: todayEnd }, status: { not: 'CANCELLED' } }, _sum: { grandTotal: true } }),
    prisma.sale.count({ where: { createdAt: { gte: todayStart, lt: todayEnd }, status: { not: 'CANCELLED' } } }),
    prisma.purchase.aggregate({ where: { createdAt: { gte: todayStart, lt: todayEnd }, status: { not: 'CANCELLED' } }, _sum: { totalCost: true } }),
    prisma.purchaseItem.aggregate({ where: { purchase: { createdAt: { gte: todayStart, lt: todayEnd }, status: { not: 'CANCELLED' } } }, _sum: { netWeight: true } }),
    prisma.expense.aggregate({ where: { date: { gte: todayStart, lt: todayEnd }, deletedAt: null }, _sum: { amount: true } }),
    prisma.customerTransaction.aggregate({ _sum: { amount: true, balanceAfter: true } }),
    prisma.supplierTransaction.aggregate({ _sum: { amount: true, balanceAfter: true } }),
    prisma.product.aggregate({ where: { metal: 'GOLD', status: 'IN_STOCK', deletedAt: null }, _sum: { netWeight: true } }),
    prisma.product.aggregate({ where: { metal: 'SILVER', status: 'IN_STOCK', deletedAt: null }, _sum: { netWeight: true } }),
    prisma.metalRate.findMany({ orderBy: { createdAt: 'desc' }, take: 6 }),
    prisma.order.count({ where: { status: { in: ['QUOTATION', 'ADVANCE_RECEIVED', 'DESIGN_APPROVED', 'MANUFACTURING'] } } }),
    prisma.jobWork.count({ where: { status: { in: ['ISSUED', 'PARTIAL_RETURN'] } } }),
    prisma.repair.count({ where: { status: { in: ['RECEIVED', 'IN_PROGRESS'] } } }),
    prisma.sale.findMany({ include: { customer: { select: { name: true, phone: true } } }, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.product.findMany({ where: { status: 'IN_STOCK', deletedAt: null }, select: { id: true, name: true, itemCode: true, netWeight: true, category: { select: { name: true } } }, take: 10, orderBy: { createdAt: 'desc' } }),
    prisma.customer.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, phone: true },
      take: 10,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.supplier.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, phone: true },
      take: 10,
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const todayProfit = await prisma.sale.aggregate({
    where: { createdAt: { gte: todayStart, lt: todayEnd }, status: { not: 'CANCELLED' } },
    _sum: { profit: true },
  });

  const salesTrend = await prisma.sale.groupBy({
    by: ['createdAt'],
    where: { createdAt: { gte: monthAgo } },
    _sum: { grandTotal: true },
    _count: true,
    orderBy: { createdAt: 'asc' },
  });

  const categorySales = await prisma.saleItem.groupBy({
    by: ['metal'],
    _sum: { total: true },
    where: { sale: { createdAt: { gte: monthAgo }, status: { not: 'CANCELLED' } } },
  });

  const salesByDay: Record<string, { total: number; count: number }> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = d.toISOString().split('T')[0];
    salesByDay[key] = { total: 0, count: 0 };
  }
  for (const s of salesTrend) {
    const key = new Date(s.createdAt.getFullYear(), s.createdAt.getMonth(), s.createdAt.getDate())
      .toISOString()
      .split('T')[0];
    if (salesByDay[key]) {
      salesByDay[key].total += s._sum.grandTotal || 0;
      salesByDay[key].count += s._count;
    }
  }

  const customerDuesList = [];
  for (const c of customerDues) {
    const tr = await prisma.customerTransaction.aggregate({
      where: { customerId: c.id },
      _sum: { balanceAfter: true },
      orderBy: { createdAt: 'desc' },
    });
    if (tr._sum.balanceAfter) {
      customerDuesList.push({ ...c, balance: tr._sum.balanceAfter });
    }
  }

  const supplierDuesList = [];
  for (const s of supplierDues) {
    const tr = await prisma.supplierTransaction.aggregate({
      where: { supplierId: s.id },
      _sum: { balanceAfter: true },
    });
    if (tr._sum.balanceAfter) {
      supplierDuesList.push({ ...s, balance: tr._sum.balanceAfter });
    }
  }

  const canSeeFinancial = req.user!.role !== 'STAFF';

  res.json({
    todaySales: todaySales._sum.grandTotal || 0,
    todaySalesCount,
    todayPurchases: todayPurchases._sum.totalCost || 0,
    todayPurchasesWeight: todayPurchasesWeight._sum.netWeight || 0,
    todayExpenses: todayExpenses._sum.amount || 0,
    todayProfit: canSeeFinancial ? todayProfit._sum.profit || 0 : null,
    customerOutstanding: customerOutstanding._sum.
balanceAfter || 0,
    supplierOutstanding: supplierOutstanding._sum.balanceAfter || 0,
    goldStock: goldStock._sum.netWeight || 0,
    silverStock: silverStock._sum.netWeight || 0,
    todayRates,
    pendingOrders,
    pendingJobWork,
    pendingRepairs,
    recentSales,
    lowStock,
    customerDues: customerDuesList,
    supplierDues: supplierDuesList,
    salesTrend: Object.entries(salesByDay).map(([date, v]) => ({ date, ...v })),
    categorySales,
    canSeeFinancial,
  });
});

export default router;