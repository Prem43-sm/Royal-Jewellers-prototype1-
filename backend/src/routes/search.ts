import { Router } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRole } from '../lib/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const q = (req.query.q as string) || '';
  if (!q || q.trim().length < 2) return res.json({ query: q, results: [] });

  const search = q.trim();

  const [products, customers, suppliers, sales, orders, repairs, jobWorks] = await Promise.all([
    prisma.product.findMany({
      where: {
        deletedAt: null,
        OR: [
          { itemCode: { contains: search } },
          { name: { contains: search } },
          { barcode: { contains: search } },
          { huid: { contains: search } },
        ],
      },
      select: { id: true, itemCode: true, name: true, status: true, purity: true, netWeight: true, metal: true },
      take: 10,
    }),
    prisma.customer.findMany({
      where: {
        deletedAt: null,
        OR: [{ name: { contains: search } }, { phone: { contains: search } }, { email: { contains: search } }],
      },
      select: { id: true, name: true, phone: true, email: true },
      take: 10,
    }),
    prisma.supplier.findMany({
      where: {
        deletedAt: null,
        OR: [{ name: { contains: search } }, { phone: { contains: search } }],
      },
      select: { id: true, name: true, phone: true },
      take: 10,
    }),
    prisma.sale.findMany({
      where: { OR: [{ invoiceNumber: { contains: search } }, { customer: { name: { contains: search } } }] },
      select: { id: true, invoiceNumber: true, grandTotal: true, createdAt: true, status: true },
      take: 10,
    }),
    prisma.order.findMany({
      where: { OR: [{ orderNumber: { contains: search } }, { customer: { name: { contains: search } } }] },
      select: { id: true, orderNumber: true, status: true, totalPrice: true, customer: { select: { name: true } } },
      take: 10,
    }),
    prisma.repair.findMany({
      where: { OR: [{ repairNumber: { contains: search } }, { problem: { contains: search } }] },
      select: { id: true, repairNumber: true, status: true, problem: true },
      take: 10,
    }),
    prisma.jobWork.findMany({
      where: { OR: [{ jobNumber: { contains: search } }, { artisan: { name: { contains: search } } }] },
      select: { id: true, jobNumber: true, status: true, artisan: { select: { name: true } } },
      take: 10,
    }),
  ]);

  res.json({
    query: search,
    results: {
      products,
      customers,
      suppliers,
      sales,
      orders,
      repairs,
      jobWorks,
    },
  });
});

export default router;