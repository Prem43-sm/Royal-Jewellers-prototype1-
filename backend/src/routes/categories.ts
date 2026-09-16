import { Router } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRole } from '../lib/auth';
import { AppError } from '../lib/errors';
import { logAudit } from '../lib/audit';

const router = Router();

router.use(authMiddleware);

router.get('/', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const categories = await prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(categories);
});

router.post('/', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const { name } = req.body;
  if (!name) throw new AppError('Category name is required', 400);
  const category = await prisma.category.create({ data: { name } });
  await logAudit({ userId: req.user!.id, action: 'CREATE', entity: 'CATEGORY', recordId: category.id });
  res.status(201).json(category);
});

export default router;