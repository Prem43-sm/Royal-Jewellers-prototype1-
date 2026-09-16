import { Router } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRole } from '../lib/auth';
import { AppError } from '../lib/errors';
import { logAudit } from '../lib/audit';
import { calculateOldGoldValue } from '../services/calculations';

const router = Router();

router.use(authMiddleware);

router.get('/', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const tests = await prisma.goldTest.findMany({
    include: { product: { select: { itemCode: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(tests);
});

router.post('/', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const body = req.body;
  if (!body.grossWeight || !body.testingMethod) {
    throw new AppError('Gross weight and testing method are required', 400);
  }

  const purity = parseFloat(body.purity || 22);
  const grossWeight = parseFloat(body.grossWeight);
  const acceptedWeight = parseFloat(body.acceptedWeight || grossWeight);
  const rate = parseFloat(body.rate || 0);
  const deduction = parseFloat(body.deduction || 0);

  const fineness = purity / 24;
  const fineGoldWeight = acceptedWeight * fineness;
  const rawValue = fineGoldWeight * rate;
  const finalValue = Math.max(0, rawValue - deduction);

  const test = await prisma.goldTest.create({
    data: {
      productId: body.productId ? parseInt(body.productId) : null,
      grossWeight,
      purity,
      testingMethod: body.testingMethod,
      acceptedWeight,
      fineGoldWeight: Math.round(fineGoldWeight * 100) / 100,
      rate,
      value: Math.round(rawValue * 100) / 100,
      deduction,
      finalValue,
      notes: body.notes || null,
    },
  });

  await logAudit({
    userId: req.user!.id,
    action: 'GOLD_TEST',
    entity: 'GOLD_TEST',
    recordId: test.id,
    newValue: JSON.stringify({ grossWeight, purity, testingMethod: body.testingMethod, finalValue }),
  });

  res.status(201).json(test);
});

export default router;