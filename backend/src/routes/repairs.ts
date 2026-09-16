import { Router } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRole } from '../lib/auth';
import { AppError } from '../lib/errors';
import { logAudit } from '../lib/audit';

const router = Router();

router.use(authMiddleware);

function generateRepairNumber() {
  return `RPR-${Date.now().toString().slice(-8)}`;
}

router.get('/', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const status = (req.query.status as string) || '';
  const search = (req.query.search as string) || '';
  const where: any = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { repairNumber: { contains: search } },
      { customer: { name: { contains: search } } },
      { product: { itemCode: { contains: search } } },
    ];
  }

  const [repairs, total] = await Promise.all([
    prisma.repair.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        product: { select: { id: true, itemCode: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.repair.count({ where }),
  ]);

  res.json({ repairs, total });
});

router.get('/:id', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const repair = await prisma.repair.findUnique({
    where: { id },
    include: { customer: true, product: true },
  });
  if (!repair) throw new AppError('Repair not found', 404);
  res.json(repair);
});

router.post('/', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const body = req.body;
  if (!body.problem) throw new AppError('Problem description is required', 400);

  const repairNumber = generateRepairNumber();
  const repair = await prisma.repair.create({
    data: {
      repairNumber,
      customerId: body.customerId ? parseInt(body.customerId) : null,
      productId: body.productId ? parseInt(body.productId) : null,
      problem: body.problem,
      estimatedCost: parseFloat(body.estimatedCost || 0),
      advancePaid: parseFloat(body.advancePaid || 0),
      artisanId: body.artisanId ? parseInt(body.artisanId) : null,
      expectedDelivery: body.expectedDelivery ? new Date(body.expectedDelivery) : null,
      notes: body.notes || null,
    },
  });

  if (body.productId) {
    await prisma.product.update({
      where: { id: parseInt(body.productId) },
      data: { status: 'REPAIR' },
    });
  }

  await logAudit({
    userId: req.user!.id,
    action: 'REPAIR_CREATE',
    entity: 'REPAIR',
    recordId: repair.id,
    newValue: JSON.stringify({ repairNumber, problem: body.problem }),
  });

  res.status(201).json(repair);
});

router.put('/:id', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const existing = await prisma.repair.findUnique({ where: { id } });
  if (!existing) throw new AppError('Repair not found', 404);

  const body = req.body;
  const data: any = {};
  for (const f of ['problem', 'status', 'notes']) {
    if (body[f] !== undefined) data[f] = body[f];
  }
  for (const f of ['estimatedCost', 'advancePaid']) {
    if (body[f] !== undefined) data[f] = parseFloat(body[f]);
  }
  for (const f of ['customerId', 'productId', 'artisanId']) {
    if (body[f] !== undefined) data[f] = body[f] ? parseInt(body[f]) : null;
  }
  if (body.expectedDelivery !== undefined) data.expectedDelivery = body.expectedDelivery ? new Date(body.expectedDelivery) : null;
  if (body.actualDelivery !== undefined) data.actualDelivery = body.actualDelivery ? new Date(body.actualDelivery) : null;

  if (body.status === 'DELIVERED' && existing.status !== 'DELIVERED') {
    data.actualDelivery = new Date();
    if (existing.productId) {
      await prisma.product.update({
        where: { id: existing.productId },
        data: { status: 'IN_STOCK' },
      });
    }
  }

  if (body.actualDelivery) data.actualDelivery = new Date(body.actualDelivery);

  const repair = await prisma.repair.update({ where: { id }, data });

  await logAudit({
    userId: req.user!.id,
    action: 'REPAIR_UPDATE',
    entity: 'REPAIR',
    recordId: id,
    oldValue: JSON.stringify({ status: existing.status }),
    newValue: JSON.stringify({ status: repair.status }),
  });

  res.json(repair);
});

router.delete('/:id', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const existing = await prisma.repair.findUnique({ where: { id } });
  if (!existing) throw new AppError('Repair not found', 404);
  await prisma.repair.update({ where: { id }, data: { status: 'CANCELLED' } });
  await logAudit({ userId: req.user!.id, action: 'DELETE', entity: 'REPAIR', recordId: id });
  res.json({ success: true });
});

export default router;