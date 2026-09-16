import { Router } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRole } from '../lib/auth';
import { AppError } from '../lib/errors';
import { logAudit } from '../lib/audit';

const router = Router();

router.use(authMiddleware);

router.get('/', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const settings = await prisma.settings.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  res.json(map);
});

router.put('/', requireRole(['OWNER']), async (req: AuthRequest, res) => {
  const body = req.body;
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      await prisma.settings.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }
  }

  await logAudit({
    userId: req.user!.id,
    action: 'SETTINGS_UPDATE',
    entity: 'SETTINGS',
    newValue: JSON.stringify(Object.keys(body)),
  });

  const settings = await prisma.settings.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  res.json(map);
});

export default router;