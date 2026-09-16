import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRole } from '../lib/auth';
import { AppError } from '../lib/errors';
import { logAudit } from '../lib/audit';
import { calculateOldGoldValue } from '../services/calculations';

const router = Router();

router.use(authMiddleware);

router.get('/', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;

  const [exchanges, total] = await Promise.all([
    prisma.oldGoldExchange.findMany({
      include: { customer: { select: { id: true, name: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.oldGoldExchange.count(),
  ]);

  res.json({ exchanges, total, page, pageSize });
});

router.get('/:id', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const exchange = await prisma.oldGoldExchange.findUnique({
    where: { id },
    include: { customer: true },
  });
  if (!exchange) throw new AppError('Exchange record not found', 404);
  res.json(exchange);
});

router.post(
  '/',
  requireRole(['OWNER', 'MANAGER', 'STAFF']),
  body('grossWeight').isFloat({ min: 0.001 }).withMessage('Gross weight is required'),
  body('testedPurity').isFloat({ min: 0, max: 24 }).withMessage('Purity must be between 0 and 24'),
  body('rate').isFloat({ min: 0 }).withMessage('Rate is required'),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      customerId,
      metal,
      grossWeight,
      stoneWeight,
      otherMaterialWeight,
      testedPurity,
      testingMethod,
      testingNotes,
      rate,
      deduction,
      notes,
      productId,
    } = req.body;

    const valuation = calculateOldGoldValue({
      grossWeight: parseFloat(grossWeight),
      stoneWeight: parseFloat(stoneWeight || 0),
      otherMaterialWeight: parseFloat(otherMaterialWeight || 0),
      testedPurity: parseFloat(testedPurity),
      rate: parseFloat(rate),
      deduction: parseFloat(deduction || 0),
    });

    const exchange = await prisma.oldGoldExchange.create({
      data: {
        customerId: customerId ? parseInt(customerId) : null,
        metal: metal || 'GOLD',
        grossWeight: parseFloat(grossWeight),
        stoneWeight: parseFloat(stoneWeight || 0),
        otherMaterialWeight: parseFloat(otherMaterialWeight || 0),
        netWeight: valuation.netWeight,
        testedPurity: parseFloat(testedPurity),
        fineness: valuation.fineness,
        testingMethod: testingMethod || 'Touchstone',
        testingNotes: testingNotes || null,
        fineGoldWeight: valuation.fineGoldWeight,
        rate: parseFloat(rate),
        grossValue: valuation.grossValue,
        deductions: parseFloat(deduction || 0),
        finalValue: valuation.finalValue,
        notes: notes || null,
        createdBy: req.user!.id,
        productId: productId ? parseInt(productId) : null,
      },
    });

    await prisma.stockMovement.create({
      data: {
        productId: productId ? parseInt(productId) : null,
        metal: metal || 'GOLD',
        purity: parseFloat(testedPurity),
        weight: valuation.fineGoldWeight,
        movementType: 'OLD_GOLD',
        referenceType: 'OLD_GOLD_EXCHANGE',
        referenceId: exchange.id,
        notes: `Old gold exchange ${exchange.id}`,
      },
    });

    if (customerId) {
      const cid = parseInt(customerId);
      const latest = await prisma.customerTransaction.findFirst({
        where: { customerId: cid },
        orderBy: { createdAt: 'desc' },
      });
      const currentBalance = latest?.balanceAfter || 0;
      await prisma.customerTransaction.create({
        data: {
          customerId: cid,
          type: 'INCOME',
          amount: valuation.finalValue,
          balanceAfter: roundDisplayer(currentBalance - valuation.finalValue),
          description: `Old gold exchange credit`,
          referenceId: exchange.id,
        },
      });
    }

    await logAudit({
      userId: req.user!.id,
      action: 'OLD_GOLD_EXCHANGE',
      entity: 'OLD_GOLD_EXCHANGE',
      recordId: exchange.id,
      newValue: JSON.stringify({ grossWeight, testedPurity, rate, finalValue: valuation.finalValue }),
    });

    res.status(201).json(exchange);
  }
);

function roundDisplayer(n: number) {
  return Math.round(n * 100) / 100;
}

export default router;