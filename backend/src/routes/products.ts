import { Router } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRole } from '../lib/auth';
import { AppError } from '../lib/errors';
import { logAudit } from '../lib/audit';
import { calculatePurityFineness, calculateNetWeight, calculateFineGoldWeight, round2 } from '../services/calculations';

const router = Router();

router.use(authMiddleware);

router.get('/', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const search = (req.query.search as string) || '';
  const status = (req.query.status as string) || '';
  const metal = (req.query.metal as string) || '';
  const categoryId = (req.query.categoryId as string) || '';
  const purity = (req.query.purity as string) || '';
  const includeDeleted = req.query.includeDeleted === 'true';

  const where: any = {};
  if (!includeDeleted) where.deletedAt = null;
  if (status) where.status = status;
  if (metal) where.metal = metal;
  if (categoryId) where.categoryId = parseInt(categoryId);
  if (purity) where.purity = parseFloat(purity);

  if (search) {
    where.OR = [
      { itemCode: { contains: search } },
      { name: { contains: search } },
      { barcode: { contains: search } },
      { huid: { contains: search } },
    ];
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  res.json({ products, total, page, pageSize });
});

router.get('/:id', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      supplier: { select: { id: true, name: true } },
      stockMovements: { orderBy: { createdAt: 'desc' }, take: 50 },
      saleItems: { include: { sale: { select: { id: true, invoiceNumber: true, createdAt: true } } }, take: 10 },
    },
  });
  if (!product) throw new AppError('Product not found', 404);
  res.json(product);
});

router.post('/', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const body = req.body;

  if (!body.itemCode && body.metal) {
    const count = await prisma.product.count();
    body.itemCode = `${(body.metal || 'GOLD').substring(0, 2).toUpperCase()}${String(count + 1).padStart(5, '0')}`;
  }

  if (!body.itemCode) throw new AppError('Item code is required', 400);
  if (!body.name) throw new AppError('Item name is required', 400);
  if (body.grossWeight === undefined) throw new AppError('Gross weight is required', 400);

  const grossWeight = parseFloat(body.grossWeight);
  const stoneWeight = parseFloat(body.stoneWeight || 0);
  const otherMaterialWeight = parseFloat(body.otherMaterialWeight || 0);
  const purity = parseFloat(body.purity || 22);
  const fineness = body.fineness !== undefined ? parseFloat(body.fineness) : round2(calculatePurityFineness(purity));

  const netWeight = round2(calculateNetWeight(grossWeight, stoneWeight, otherMaterialWeight));
  const fineGoldWeight = round2(calculateFineGoldWeight(netWeight, fineness));

  const existingCode = await prisma.product.findUnique({ where: { itemCode: body.itemCode } });
  if (existingCode) throw new AppError('Item code already exists', 409);

  const product = await prisma.product.create({
    data: {
      itemCode: body.itemCode,
      barcode: body.barcode || null,
      name: body.name,
      categoryId: body.categoryId ? parseInt(body.categoryId) : null,
      metal: body.metal || 'GOLD',
      purity,
      fineness,
      grossWeight,
      stoneWeight,
      otherMaterialWeight,
      netWeight,
      fineGoldWeight,
      stoneType: body.stoneType || null,
      hallmark: body.hallmark || false,
      huid: body.huid || null,
      purchaseCost: body.purchaseCost !== undefined ? parseFloat(body.purchaseCost) : null,
      sellingPrice: body.sellingPrice !== undefined ? parseFloat(body.sellingPrice) : null,
      makingCharge: parseFloat(body.makingCharge || 0),
      wastage: parseFloat(body.wastage || 0),
      wastagePercent: parseFloat(body.wastagePercent || 0),
      stoneCharge: parseFloat(body.stoneCharge || 0),
      otherCharge: parseFloat(body.otherCharge || 0),
      discount: parseFloat(body.discount || 0),
      taxRate: parseFloat(body.taxRate || 0),
      supplierId: body.supplierId ? parseInt(body.supplierId) : null,
      purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
      status: body.status || 'IN_STOCK',
      image: body.image || null,
      notes: body.notes || null,
    },
  });

  if (product.supplierId) {
    const latest = await prisma.supplierTransaction.findFirst({
      where: { supplierId: product.supplierId },
      orderBy: { createdAt: 'desc' },
    });
    const balance = latest?.balanceAfter || 0;
    await prisma.supplierTransaction.create({
      data: {
        supplierId: product.supplierId,
        type: 'PURCHASE',
        amount: -(product.purchaseCost || 0),
        balanceAfter: balance + -(product.purchaseCost || 0),
        description: `Item added: ${product.itemCode}`,
        referenceId: product.id,
      },
    });
  }

  await prisma.stockMovement.create({
    data: {
      productId: product.id,
      metal: product.metal,
      purity: product.purity,
      weight: product.netWeight,
      movementType: 'PURCHASE',
      referenceType: 'PRODUCT',
      referenceId: product.id,
      notes: 'New item added',
    },
  });

  await logAudit({
    userId: req.user!.id,
    action: 'CREATE',
    entity: 'PRODUCT',
    recordId: product.id,
    newValue: JSON.stringify({ itemCode: product.itemCode, name: product.name, netWeight: product.netWeight }),
  });

  res.status(201).json(product);
});

router.put('/:id', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new AppError('Product not found', 404);

  const body = req.body;
  const data: any = {};

  for (const field of ['name', 'barcode', 'stoneType', 'huid', 'status', 'image', 'notes', 'metal']) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  for (const field of ['categoryId', 'supplierId', 'stoneWeight', 'otherMaterialWeight', 'grossWeight', 'purchaseCost', 'sellingPrice', 'makingCharge', 'wastage', 'wastagePercent', 'stoneCharge', 'otherCharge', 'discount', 'taxRate']) {
    if (body[field] !== undefined) data[field] = typeof body[field] === 'string' ? parseFloat(body[field]) : body[field];
  }
  if (body.purity !== undefined) {
    data.purity = parseFloat(body.purity);
    data.fineness = body.fineness !== undefined ? parseFloat(body.fineness) : round2(calculatePurityFineness(data.purity));
  }
  if (body.hallmark !== undefined) data.hallmark = body.hallmark;

  if (body.grossWeight !== undefined || body.stoneWeight !== undefined || body.otherMaterialWeight !== undefined) {
    const gw = body.grossWeight !== undefined ? parseFloat(body.grossWeight) : existing.grossWeight;
    const sw = body.stoneWeight !== undefined ? parseFloat(body.stoneWeight) : existing.stoneWeight;
    const ow = body.otherMaterialWeight !== undefined ? parseFloat(body.otherMaterialWeight) : existing.otherMaterialWeight;
    data.netWeight = round2(calculateNetWeight(gw, sw, ow));
    const fin = data.fineness || existing.fineness;
    data.fineGoldWeight = round2(calculateFineGoldWeight(data.netWeight, fin));
  }

  const product = await prisma.product.update({ where: { id }, data });

  if (existing.status !== product.status) {
    await prisma.stockMovement.create({
      data: {
        productId: id,
        metal: product.metal,
        purity: product.purity,
        weight: body.status === 'IN_STOCK' ? product.netWeight : -product.netWeight,
        movementType: 'ADJUSTMENT',
        referenceType: 'PRODUCT',
        referenceId: id,
        notes: `Status changed: ${existing.status} -> ${product.status}`,
      },
    });
  }

  await logAudit({
    userId: req.user!.id,
    action: 'UPDATE',
    entity: 'PRODUCT',
    recordId: id,
    oldValue: JSON.stringify({ status: existing.status, name: existing.name }),
    newValue: JSON.stringify({ status: product.status, name: product.name }),
  });

  res.json(product);
});

router.delete('/:id', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new AppError('Product not found', 404);

  const permanent = req.query.permanent === 'true';
  if (permanent) {
    if (req.user!.role !== 'OWNER') throw new AppError('Only the owner can permanently delete records', 403);
    await prisma.product.delete({ where: { id } });
  } else {
    await prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  await logAudit({
    userId: req.user!.id,
    action: permanent ? 'PERMANENT_DELETE' : 'DELETE',
    entity: 'PRODUCT',
    recordId: id,
    oldValue: JSON.stringify({ itemCode: existing.itemCode, name: existing.name }),
  });

  res.json({ success: true });
});

router.post('/:id/restore', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const product = await prisma.product.update({
    where: { id },
    data: { deletedAt: null },
  });
  await logAudit({
    userId: req.user!.id,
    action: 'RESTORE',
    entity: 'PRODUCT',
    recordId: id,
  });
  res.json(product);
});

router.post('/:id/status', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body;
  if (!status) throw new AppError('Status is required', 400);

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new AppError('Product not found', 404);

  const product = await prisma.product.update({
    where: { id },
    data: { status },
  });

  await prisma.stockMovement.create({
    data: {
      productId: id,
      metal: product.metal,
      purity: product.purity,
      weight: 0,
      movementType: 'ADJUSTMENT',
      referenceType: 'PRODUCT',
      referenceId: id,
      notes: `Status changed: ${existing.status} -> ${status}`,
    },
  });

  await logAudit({
    userId: req.user!.id,
    action: 'STATUS_CHANGE',
    entity: 'PRODUCT',
    recordId: id,
    oldValue: existing.status,
    newValue: status,
  });

  res.json(product);
});

router.get('/:id/movements', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const movements = await prisma.stockMovement.findMany({
    where: { productId: id },
    orderBy: { createdAt: 'desc' },
  });
  res.json(movements);
});

export default router;