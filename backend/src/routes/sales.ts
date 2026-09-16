import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRole } from '../lib/auth';
import { AppError } from '../lib/errors';
import { logAudit } from '../lib/audit';
import { calculateJewelleryPrice, round2 } from '../services/calculations';

const router = Router();

router.use(authMiddleware);

function generateInvoiceNumber() {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `INV-${datePart}-${Math.floor(1000 + Math.random() * 9000)}`;
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
      { invoiceNumber: { contains: search } },
      { customer: { name: { contains: search } } },
      { customer: { phone: { contains: search } } },
    ];
  }

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        items: true,
        payments: true,
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.sale.count({ where }),
  ]);

  res.json({ sales, total, page, pageSize });
});

router.get('/:id', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { include: { product: { select: { itemCode: true, huid: true, barcode: true } } } },
      payments: true,
      user: { select: { name: true } },
    },
  });
  if (!sale) throw new AppError('Sale not found', 404);
  res.json(sale);
});

router.post(
  '/',
  requireRole(['OWNER', 'MANAGER', 'STAFF']),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { items, customerId, paymentMethod, paidAmount, notes } = req.body;
    if (!paymentMethod) throw new AppError('Payment method is required', 400);

    const invoiceNumber = generateInvoiceNumber();

    let createdSale: any;
    await prisma.$transaction(async (tx) => {
      let totalAmount = 0;
      let discountTotal = 0;
      let taxTotal = 0;
      let profit = 0;
      const saleItemData: any[] = [];

      for (const itemInput of items) {
        let productId = itemInput.productId;
        const quantity = itemInput.quantity || 1;

        if (productId) {
          const product = await tx.product.findUnique({ where: { id: productId } });
          if (!product) throw new AppError(`Product ${itemInput.productId} not found`, 404);
          if (product.status !== 'IN_STOCK' && product.status !== 'RESERVED') {
            throw new AppError(`Product ${product.itemCode} is not available for sale (${product.status})`, 400);
          }

          const rate = itemInput.rate ?? 0;
          if (!rate) throw new AppError(`Rate is required for ${product.itemCode}`, 400);

          const calc = calculateJewelleryPrice({
            metal: itemInput.metal || product.metal,
            purity: itemInput.purity ?? product.purity,
            fineness: itemInput.fineness ?? product.fineness,
            grossWeight: itemInput.grossWeight ?? product.grossWeight,
            stoneWeight: itemInput.stoneWeight ?? product.stoneWeight,
            otherMaterialWeight: itemInput.otherMaterialWeight ?? product.otherMaterialWeight,
            rate,
            makingCharge: itemInput.makingCharge ?? product.makingCharge,
            wastagePercent: itemInput.wastagePercent ?? product.wastagePercent,
            wastageAmount: itemInput.wastage ?? product.wastage,
            stoneCharge: itemInput.stoneCharge ?? product.stoneCharge,
            otherCharge: itemInput.otherCharge ?? product.otherCharge,
            discount: itemInput.discount ?? (product.discount || 0),
            taxRate: itemInput.taxRate ?? product.taxRate,
            quantity,
          });

          totalAmount += calc.finalValue;
          discountTotal += (itemInput.discount ?? (product.discount || 0));
          const itemTaxAmount = calc.taxableValue * (calc.taxRate / 100);
          taxTotal += itemTaxAmount;

          const cost = product.purchaseCost || 0;
          const itemProfit = (calc.finalValue / quantity - cost * (1 + (product.wastagePercent || 0) / 100)) * quantity;
          profit += itemProfit;

          saleItemData.push({
            productId: product.id,
            name: product.name,
            metal: product.metal,
            purity: product.purity,
            grossWeight: product.grossWeight,
            netWeight: product.netWeight,
            rate,
            metalValue: calc.metalValue,
            makingCharge: calc.makingCharge,
            wastage: calc.wastageAmount,
            stoneCharge: calc.stoneCharge,
            otherCharge: calc.otherCharge,
            discount: calc.discount,
            taxAmount: calc.taxAmount,
            taxRate: calc.taxRate,
            total: calc.finalValue,
            costPrice: cost,
            quantity,
          });

          await tx.product.update({
            where: { id: product.id },
            data: { status: 'SOLD', sellingPrice: calc.finalValue },
          });

          await tx.stockMovement.create({
            data: {
              productId: product.id,
              metal: product.metal,
              purity: product.purity,
              weight: -product.netWeight * quantity,
              movementType: 'SALE',
              referenceType: 'SALE',
              notes: `Sold in invoice ${invoiceNumber}`,
            },
          });
        } else {
          const rate = itemInput.rate || 0;
          const grossWeight = parseFloat(itemInput.grossWeight || 0);
          const stoneWeight = parseFloat(itemInput.stoneWeight || 0);
          const otherMaterialWeight = parseFloat(itemInput.otherMaterialWeight || 0);
          const purity = parseFloat(itemInput.purity || 22);
          const sellingPrice = parseFloat(itemInput.sellingPrice || itemInput.price || 0);

          if (!rate && !sellingPrice) throw new AppError('Rate or price is required for each item', 400);

          const calc = calculateJewelleryPrice({
            metal: itemInput.metal || 'GOLD',
            purity,
            fineness: itemInput.fineness || purity / 24,
            grossWeight,
            stoneWeight,
            otherMaterialWeight,
            rate: rate || sellingPrice / (grossWeight || 1),
            makingCharge: parseFloat(itemInput.makingCharge || 0),
            wastagePercent: parseFloat(itemInput.wastagePercent || 0),
            wastageAmount: parseFloat(itemInput.wastage || 0),
            stoneCharge: parseFloat(itemInput.stoneCharge || 0),
            otherCharge: parseFloat(itemInput.otherCharge || 0),
            discount: parseFloat(itemInput.discount || 0),
            taxRate: parseFloat(itemInput.taxRate || 0),
            quantity,
          });

          totalAmount += calc.finalValue;
          discountTotal += parseFloat(itemInput.discount || 0);
          saleItemData.push({
            productId: null,
            name: itemInput.name || 'Custom item',
            metal: itemInput.metal || 'GOLD',
            purity,
            grossWeight,
            netWeight: calc.netWeight,
            rate: calc.metalValue / (calc.netWeight || 1),
            metalValue: calc.metalValue,
            makingCharge: calc.makingCharge,
            wastage: calc.wastageAmount,
            stoneCharge: calc.stoneCharge,
            otherCharge: calc.otherCharge,
            discount: calc.discount,
            taxAmount: calc.taxAmount,
            taxRate: calc.taxRate,
            total: calc.finalValue,
            costPrice: 0,
            quantity,
          });
        }
      }

      const grandTotal = round2(totalAmount);
      const payable = round2(paidAmount !== undefined ? parseFloat(paidAmount) : grandTotal);
      const balance = round2(Math.max(0, grandTotal - payable));

createdSale = await tx.sale.create({
        data: {
          invoiceNumber,
          customerId: customerId ? parseInt(customerId) : null,
          totalAmount: grandTotal,
          discountTotal: round2(discountTotal),
          taxTotal: round2(taxTotal),
          grandTotal,
          paidAmount: payable,
          balanceAmount: balance,
          paymentMethod,
          status: balance > 0 ? 'PARTIAL' : 'COMPLETED',
          profit: round2(profit),
          notes: notes || null,
          createdBy: req.user!.id,
          items: { create: saleItemData },
          payments: {
            create: { amount: payable, method: paymentMethod, receivedBy: req.user!.id },
          },
        },
        include: { items: true, payments: true },
      });

      if (customerId) {
        const cid = parseInt(customerId);
        const latest = await tx.customerTransaction.findFirst({
          where: { customerId: cid },
          orderBy: { createdAt: 'desc' },
        });
        const currentBalance = latest?.balanceAfter || 0;
        const newBalance = currentBalance + balance;

        await tx.customerTransaction.create({
          data: {
            customerId: cid,
            type: 'SALE',
            amount: grandTotal,
            balanceAfter: newBalance,
            description: `Sale ${invoiceNumber}`,
            referenceId: createdSale.id,
          },
        });

        if (balance > 0) {
          await tx.customerTransaction.create({
            data: {
              customerId: cid,
              type: 'CUSTOMER_PAYMENT',
              amount: payable,
              balanceAfter: newBalance,
              description: `Payment for ${invoiceNumber}`,
              referenceId: createdSale.id,
            },
          });
        }
      }
    }, { maxWait: 30000, timeout: 90000 });

    await logAudit({
      userId: req.user!.id,
      action: 'SALE_CREATE',
      entity: 'SALE',
      recordId: createdSale.id,
      newValue: JSON.stringify({ invoiceNumber, grandTotal: createdSale.grandTotal, paymentMethod, items: createdSale.items.length }),
    });

    res.status(201).json({ sale: createdSale });
  }
);

router.post('/:id/payment', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { amount, method } = req.body;
  const parsedAmount = parseFloat(amount || 0);
  if (!parsedAmount || parsedAmount <= 0) throw new AppError('Valid amount is required', 400);

  const sale = await prisma.sale.findUnique({ where: { id } });
  if (!sale) throw new AppError('Sale not found', 404);
  if (sale.balanceAmount <= 0) throw new AppError('Sale already fully paid', 400);

let paymentResult: any;
  let updatedSaleResult: any;
  await prisma.$transaction(async (tx) => {
    const payment = await tx.salePayment.create({
      data: {
        saleId: id,
        amount: parsedAmount,
        method: method || 'CASH',
        receivedBy: req.user!.id,
      },
    });

    const newPaid = round2(sale.paidAmount + parsedAmount);
    const newBalance = round2(Math.max(0, sale.grandTotal - newPaid));

    const updated = await tx.sale.update({
      where: { id },
      data: {
        paidAmount: newPaid,
        balanceAmount: newBalance,
        status: newBalance <= 0 ? 'COMPLETED' : 'PARTIAL',
      },
    });

    if (sale.customerId) {
      const latest = await tx.customerTransaction.findFirst({
        where: { customerId: sale.customerId },
        orderBy: { createdAt: 'desc' },
      });
      const currentBalance = latest?.balanceAfter || 0;
      await tx.customerTransaction.create({
        data: {
          customerId: sale.customerId,
          type: 'CUSTOMER_PAYMENT',
          amount: parsedAmount,
          balanceAfter: round2(currentBalance - parsedAmount),
          description: `Payment for ${sale.invoiceNumber}`,
          referenceId: payment.id,
        },
      });
    }

    paymentResult = payment;
    updatedSaleResult = updated;
  }, { maxWait: 30000, timeout: 90000 });

  const newPaidAfter = round2(updatedSaleResult.paidAmount);
  const newBalanceAfter = updatedSaleResult.balanceAmount;

  await logAudit({
    userId: req.user!.id,
    action: 'SALE_PAYMENT',
    entity: 'SALE',
    recordId: id,
    oldValue: JSON.stringify({ paidAmount: sale.paidAmount, balanceAmount: sale.balanceAmount }),
    newValue: JSON.stringify({ paidAmount: newPaidAfter, balanceAmount: newBalanceAfter }),
  });

  res.json({ sale: updatedSaleResult, payment: paymentResult });
});

router.get('/:id/invoice', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { include: { product: { select: { itemCode: true, huid: true, barcode: true } } } },
      payments: true,
      user: { select: { name: true } },
    },
  });
  if (!sale) throw new AppError('Sale not found', 404);

  const settings = await prisma.settings.findMany();
  const settingsMap: Record<string, string> = {};
  for (const s of settings) settingsMap[s.key] = s.value;

  res.json({ sale, settings: settingsMap });
});

router.delete('/:id', requireRole(['OWNER']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const existing = await prisma.sale.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!existing) throw new AppError('Sale not found', 404);

  await prisma.$transaction(async (tx) => {
    await tx.sale.update({ where: { id }, data: { status: 'CANCELLED' } });

    for (const item of existing.items) {
      if (item.productId) {
        await tx.product.update({
          where: { id: item.productId },
          data: { status: 'IN_STOCK' },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            metal: item.metal,
            purity: item.purity,
            weight: item.netWeight * item.quantity,
            movementType: 'RETURN',
            referenceType: 'SALE',
            referenceId: id,
            notes: `Sale cancelled ${existing.invoiceNumber}`,
          },
        });
      }
    }

    if (existing.customerId) {
      const latest = await tx.customerTransaction.findFirst({
        where: { customerId: existing.customerId },
        orderBy: { createdAt: 'desc' },
      });
      const currentBalance = latest?.balanceAfter || 0;
      await tx.customerTransaction.create({
        data: {
          customerId: existing.customerId,
          type: 'ADJUSTMENT',
          amount: -existing.grandTotal,
          balanceAfter: round2(currentBalance - existing.balanceAmount),
          description: `Sale ${existing.invoiceNumber} cancelled`,
          referenceId: id,
        },
      });
    }
  }, { maxWait: 30000, timeout: 90000 });

  await logAudit({
    userId: req.user!.id,
    action: 'DELETE',
    entity: 'SALE',
    recordId: id,
    oldValue: JSON.stringify({ invoiceNumber: existing.invoiceNumber }),
  });

  res.json({ success: true });
});

export default router;