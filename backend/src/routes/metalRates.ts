import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRole } from '../lib/auth';
import { AppError } from '../lib/errors';
import { logAudit } from '../lib/audit';

const router = Router();

router.use(authMiddleware);

router.get('/', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const metal = (req.query.metal as string) || '';
  const purity = (req.query.purity as string) || '';
  const limit = parseInt(req.query.limit as string) || 50;

  const where: any = {};
  if (metal) where.metal = metal;
  if (purity) where.purity = parseFloat(purity);

  const rates = await prisma.metalRate.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  res.json(rates);
});

router.get('/today', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const rates = await prisma.metalRate.findMany({
    where: { createdAt: { gte: todayStart, lt: todayEnd } },
    orderBy: { createdAt: 'desc' },
  });

  const byKey: Record<string, any> = {};
  for (const r of rates) {
    const key = `${r.metal}-${r.purity}`;
    if (!byKey[key]) byKey[key] = r;
  }

  res.json(Object.values(byKey));
});

router.post(
  '/',
  requireRole(['OWNER', 'MANAGER']),
  body('metal').notEmpty().withMessage('Metal is required'),
  body('purity').isFloat({ min: 0, max: 24 }).withMessage('Purity must be between 0 and 24'),
  body('buyRate').isFloat({ min: 0 }).withMessage('Buy rate must be positive'),
  body('sellRate').isFloat({ min: 0 }).withMessage('Sell rate must be positive'),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { metal, purity, buyRate, sellRate, date } = req.body;
    const parsedPurity = parseFloat(purity);

    const rate = await prisma.metalRate.create({
      data: {
        metal: metal.toUpperCase(),
        purity: parsedPurity,
        buyRate: parseFloat(buyRate),
        sellRate: parseFloat(sellRate),
        date: date ? new Date(date) : new Date(),
      },
    });

    await logAudit({
      userId: req.user!.id,
      action: 'RATE_CREATE',
      entity: 'METAL_RATE',
      recordId: rate.id,
      newValue: JSON.stringify({ metal, purity: parsedPurity, buyRate, sellRate }),
    });

    res.status(201).json(rate);
  }
);

router.put('/:id', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const existing = await prisma.metalRate.findUnique({ where: { id } });
  if (!existing) throw new AppError('Rate record not found', 404);

  const { buyRate, sellRate } = req.body;
  const rate = await prisma.metalRate.update({
    where: { id },
    data: {
      buyRate: buyRate !== undefined ? parseFloat(buyRate) : existing.buyRate,
      sellRate: sellRate !== undefined ? parseFloat(sellRate) : existing.sellRate,
    },
  });

  await logAudit({
    userId: req.user!.id,
    action: 'RATE_UPDATE',
    entity: 'METAL_RATE',
    recordId: id,
    oldValue: JSON.stringify({ buyRate: existing.buyRate, sellRate: existing.sellRate }),
    newValue: JSON.stringify({ buyRate: rate.buyRate, sellRate: rate.sellRate }),
  });

  res.json(rate);
});

export default router;