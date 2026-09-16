import { Router } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRole } from '../lib/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const notifications = await prisma.notification.findMany({
    where: req.user!.role !== 'OWNER' ? { userId: req.user!.id } : {},
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(notifications);
});

router.put('/:id/read', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const notification = await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });
  res.json(notification);
});

router.put('/read-all', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const result = await prisma.notification.updateMany({
    where: req.user!.role !== 'OWNER' ? { userId: req.user!.id, isRead: false } : { isRead: false },
    data: { isRead: true },
  });
  res.json({ updated: result.count });
});

export default router;