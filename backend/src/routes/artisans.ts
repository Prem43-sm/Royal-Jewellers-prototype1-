import { Router } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRole } from '../lib/auth';
import { AppError } from '../lib/errors';
import { logAudit } from '../lib/audit';

const router = Router();

router.use(authMiddleware);

router.get('/', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const artisans = await prisma.artisan.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(artisans);
});

router.post('/', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const { name, phone, address, specialty } = req.body;
  if (!name) throw new AppError('Artisan name is required', 400);
  const artisan = await prisma.artisan.create({ data: { name, phone, address, specialty } });
  await logAudit({ userId: req.user!.id, action: 'CREATE', entity: 'ARTISAN', recordId: artisan.id });
  res.status(201).json(artisan);
});

router.put('/:id', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const existing = await prisma.artisan.findUnique({ where: { id } });
  if (!existing) throw new AppError('Artisan not found', 404);
  const { name, phone, address, specialty, active } = req.body;
  const artisan = await prisma.artisan.update({
    where: { id },
    data: { name, phone, address, specialty, active },
  });
  res.json(artisan);
});

export default router;