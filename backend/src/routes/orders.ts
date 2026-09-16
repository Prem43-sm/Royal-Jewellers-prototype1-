import { Router } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRole } from '../lib/auth';
import { AppError } from '../lib/errors';
import { logAudit } from '../lib/audit';

const router = Router();

router.use(authMiddleware);

router.get('/', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        items: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
    prisma.order.count(),
  ]);
  res.json({ orders, total });
});

router.get('/:id', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const order = await prisma.order.findUnique({
    where: { id },
    include: { customer: true, items: true },
  });
  if (!order) throw new AppError('Order not found', 404);
  res.json(order);
});

function generateOrderNumber() {
  return `ORD-${Date.now().toString().slice(-8)}`;
}

router.post('/', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const body = req.body;
  const orderNumber = generateOrderNumber();

  const totalPrice = body.totalPrice !== undefined
    ? parseFloat(body.totalPrice)
    : (parseFloat(body.estimatedPrice || 0) + parseFloat(body.makingCharge || 0) + parseFloat(body.stoneCharge || 0) + parseFloat(body.otherCharge || 0));

  const advance = parseFloat(body.advance || 0);
  const balance = Math.max(0, totalPrice - advance);

  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerId: body.customerId ? parseInt(body.customerId) : null,
      jewelleryType: body.jewelleryType || null,
      metal: body.metal || 'GOLD',
      purity: parseFloat(body.purity || 22),
      estimatedWeight: parseFloat(body.estimatedWeight || 0),
      estimatedPrice: parseFloat(body.estimatedPrice || 0),
      makingCharge: parseFloat(body.makingCharge || 0),
      stoneCharge: parseFloat(body.stoneCharge || 0),
      otherCharge: parseFloat(body.otherCharge || 0),
      totalPrice: Math.round(totalPrice * 100) / 100,
      advance,
      balance: Math.round(balance * 100) / 100,
      designRef: body.designRef || null,
      notes: body.notes || null,
      status: body.status || (advance > 0 ? 'ADVANCE_RECEIVED' : 'QUOTATION'),
      expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
      deliveredDate: null,
      items: body.items?.length
        ? { create: body.items.map((i: any) => ({ name: i.name, weight: parseFloat(i.weight || 0), price: parseFloat(i.price || 0), productId: i.productId ? parseInt(i.productId) : null })) }
        : undefined,
    },
    include: { items: true },
  });

  if (body.customerId && advance > 0) {
    const cid = parseInt(body.customerId);
    const latest = await prisma.customerTransaction.findFirst({
      where: { customerId: cid },
      orderBy: { createdAt: 'desc' },
    });
    const currentBalance = latest?.balanceAfter || 0;
    await prisma.customerTransaction.create({
      data: {
        customerId: cid,
        type: 'CUSTOMER_PAYMENT',
        amount: advance,
        balanceAfter: Math.round((currentBalance + advance) * 100) / 100,
        description: `Order ${orderNumber} advance`,
        referenceId: order.id,
      },
    });
  }

  await logAudit({
    userId: req.user!.id,
    action: 'ORDER_CREATE',
    entity: 'ORDER',
    recordId: order.id,
    newValue: JSON.stringify({ orderNumber, totalPrice, advance }),
  });

  res.status(201).json(order);
});

router.put('/:id', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) throw new AppError('Order not found', 404);

  const body = req.body;
  const data: any = {};

  for (const f of ['jewelleryType', 'metal', 'designRef', 'notes', 'status']) {
    if (body[f] !== undefined) data[f] = body[f];
  }
  for (const f of ['purity', 'estimatedWeight', 'estimatedPrice', 'makingCharge', 'stoneCharge', 'otherCharge', 'totalPrice', 'advance', 'balance']) {
    if (body[f] !== undefined) data[f] = parseFloat(body[f]);
  }
  if (body.expectedDate) data.expectedDate = new Date(body.expectedDate);
  if (body.deliveredDate) data.deliveredDate = new Date(body.deliveredDate);

  if (body.status === 'DELIVERED' && existing.status !== 'DELIVERED') {
    data.deliveredDate = new Date();
  }

  const order = await prisma.order.update({ where: { id }, data });

  await logAudit({
    userId: req.user!.id,
    action: 'ORDER_UPDATE',
    entity: 'ORDER',
    recordId: id,
    oldValue: JSON.stringify({ status: existing.status }),
    newValue: JSON.stringify({ status: order.status }),
  });

  res.json(order);
});

router.delete('/:id', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) throw new AppError('Order not found', 404);
  await prisma.order.update({ where: { id }, data: { status: 'CANCELLED' } });
  await logAudit({ userId: req.user!.id, action: 'DELETE', entity: 'ORDER', recordId: id });
  res.json({ success: true });
});

export default router;