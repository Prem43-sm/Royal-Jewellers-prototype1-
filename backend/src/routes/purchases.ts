import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRole } from '../lib/auth';
import { AppError } from '../lib/errors';
import { logAudit } from '../lib/audit';
import { calculatePurityFineness, calculateNetWeight, calculateFineGoldWeight, round2 } from '../services/calculations';

const router = Router();

router.use(authMiddleware);

function generatePurchaseNumber() {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `PUR-${datePart}-${Math.floor(1000 + Math.random() * 9000)}`;
}

router.get('/', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const search = (req.query.search as string) || '';
  const from = req.query.from as string;
  const to = req.query.to as string;

  const where: any = {};
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }
  if (search) {
    where.OR = [
      { purchaseNumber: { contains: search } },
      { supplier: { name: { contains: search } } },
    ];
  }

  const [purchases, total] = await Promise.all([
    prisma.purchase.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, phone: true } },
        items: true,
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.purchase.count({ where }),
  ]);

  res.json({ purchases, total, page, pageSize });
});

router.get('/:id', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: { include: { product: { select: { itemCode: true, status: true } } } },
      payments: true,
      user: { select: { name: true } },
    },
  });
  if (!purchase) throw new AppError('Purchase not found', 404);
  res.json(purchase);
});

router.post(
  '/',
  requireRole(['OWNER', 'MANAGER']),
  body('supplierId').isInt().withMessage('Supplier is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { supplierId, items, paidAmount, paymentMethod, notes } = req.body;

    const purchaseNumber = generatePurchaseNumber();
    let createdPurchase: any;
    await prisma.$transaction(async (tx) => {
      let totalCost = 0;
      const purchaseItems: any[] = [];

      for (const item of items) {
        const grossWeight = parseFloat(item.grossWeight);
        const stoneWeight = parseFloat(item.stoneWeight || 0);
        const otherMaterialWeight = parseFloat(item.otherMaterialWeight || 0);
        const purity = parseFloat(item.purity || 22);
        const fineness = calculatePurityFineness(purity);
        const netWeight = round2(calculateNetWeight(grossWeight, stoneWeight, otherMaterialWeight));
        const rate = parseFloat(item.rate || 0);
        const cost = parseFloat(item.cost !== undefined ? item.cost : (rate * (grossWeight || 0)));
        const quantity = item.quantity || 1;

        totalCost += cost * quantity;

        let productId: number | null = null;

        if (item.productId) {
          productId = parseInt(item.productId);
        } else if (item.createItem) {
          const count = await tx.product.count();
          const itemCode = item.itemCode || `${(item.metal || 'GOLD').substring(0, 2).toUpperCase()}${String(count + 1).padStart(5, '0')}`;
          const product = await tx.product.create({
            data: {
              itemCode,
              barcode: item.barcode || null,
              name: item.name || 'Purchased item',
              metal: item.metal || 'GOLD',
              purity,
              fineness,
              grossWeight,
              stoneWeight,
              otherMaterialWeight,
              netWeight,
              fineGoldWeight: round2(calculateFineGoldWeight(netWeight, fineness)),
              purchaseCost: cost,
              makingCharge: parseFloat(item.makingCharge || 0),
              wastagePercent: parseFloat(item.wastagePercent || 0),
              supplierId: parseInt(supplierId),
              purchaseDate: new Date(),
              status: 'IN_STOCK',
              notes: item.notes || null,
            },
          });
          productId = product.id;
        }

        purchaseItems.push({
          productId,
          name: item.name || item.itemCode || 'Purchased item',
          metal: item.metal || 'GOLD',
          purity,
          grossWeight,
          netWeight,
          rate,
          cost,
          quantity,
        });
      }

      const paid = parseFloat(paidAmount || 0);
      const balance = Math.max(0, totalCost - paid);

      createdPurchase = await tx.purchase.create({
        data: {
          purchaseNumber,
          supplierId: parseInt(supplierId),
          totalCost: round2(totalCost),
          paidAmount: round2(paid),
          balanceAmount: round2(balance),
          paymentMethod: paymentMethod || 'CASH',
          notes: notes || null,
          createdBy: req.user!.id,
          items: { create: purchaseItems },
          payments: paid > 0
            ? {
                create: {
                  amount: round2(paid),
                  method: paymentMethod || 'CASH',
                  createdBy: req.user!.id,
                  supplierId: parseInt(supplierId),
                },
              }
            : undefined,
        },
        include: { items: true },
      });

      const latest = await tx.supplierTransaction.findFirst({
        where: { supplierId: parseInt(supplierId) },
        orderBy: { createdAt: 'desc' },
      });
      const currentBalance = latest?.balanceAfter || 0;
      const newBalance = currentBalance + totalCost - paid;

      await tx.supplierTransaction.create({
        data: {
          supplierId: parseInt(supplierId),
          type: 'PURCHASE',
          amount: totalCost,
          balanceAfter: round2(newBalance),
          description: `Purchase ${purchaseNumber}`,
          referenceId: createdPurchase.id,
        },
      });

      for (const pi of purchaseItems) {
        if (pi.productId) {
          await tx.stockMovement.create({
            data: {
              productId: pi.productId,
              metal: pi.metal,
              purity: pi.purity,
              weight: pi.netWeight * pi.quantity,
              movementType: 'PURCHASE',
              referenceType: 'PURCHASE',
              referenceId: createdPurchase.id,
              notes: `Purchased ${purchaseNumber}`,
            },
          });
        }
      }
      }, { maxWait: 30000, timeout: 90000 });

      await logAudit({
        userId: req.user!.id,
        action: 'PURCHASE_CREATE',
        entity: 'PURCHASE',
        recordId: createdPurchase.id,
        newValue: JSON.stringify({ purchaseNumber, totalCost: createdPurchase.totalCost, items: createdPurchase.items.length }),
      });

      res.status(201).json({ purchase: createdPurchase });
    }
);

router.post('/:id/payment', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { amount, method } = req.body;
  const parsedAmount = parseFloat(amount || 0);
  if (!parsedAmount || parsedAmount <= 0) throw new AppError('Valid amount is required', 400);

  const purchase = await prisma.purchase.findUnique({ where: { id } });
  if (!purchase) throw new AppError('Purchase not found', 404);

  let updatedPurchaseResult: any;
  let createdPaymentResult: any;
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        supplierId: purchase.supplierId,
        amount: parsedAmount,
        method: method || 'CASH',
        createdBy: req.user!.id,
        purchaseId: id,
      },
    });

    const newPaid = round2(purchase.paidAmount + parsedAmount);
    const newBalance = round2(Math.max(0, purchase.totalCost - newPaid));

    const updated = await tx.purchase.update({
      where: { id },
      data: { paidAmount: newPaid, balanceAmount: newBalance },
    });

    const latest = await tx.supplierTransaction.findFirst({
      where: { supplierId: purchase.supplierId },
      orderBy: { createdAt: 'desc' },
    });
    const currentBalance = latest?.balanceAfter || 0;

    await tx.supplierTransaction.create({
      data: {
        supplierId: purchase.supplierId,
        type: 'SUPPLIER_PAYMENT',
        amount: round2(-parsedAmount),
        balanceAfter: round2(currentBalance - parsedAmount),
        description: `Payment for ${purchase.purchaseNumber}`,
        referenceId: payment.id,
      },
    });

    createdPaymentResult = payment;
    updatedPurchaseResult = updated;
  }, { maxWait: 30000, timeout: 90000 });

  const newPaidAudit = updatedPurchaseResult.paidAmount;
  const newBalanceAudit = updatedPurchaseResult.balanceAmount;

  await logAudit({
    userId: req.user!.id,
    action: 'PURCHASE_PAYMENT',
    entity: 'PURCHASE',
    recordId: id,
    oldValue: JSON.stringify({ paidAmount: purchase.paidAmount, balanceAmount: purchase.balanceAmount }),
    newValue: JSON.stringify({ paidAmount: newPaidAudit, balanceAmount: newBalanceAudit }),
  });

  res.json({ purchase: updatedPurchaseResult, payment: createdPaymentResult });
});

export default router;