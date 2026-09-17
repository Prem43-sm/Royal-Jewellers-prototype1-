import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRole } from '../lib/auth';
import { AppError } from '../lib/errors';
import { logAudit } from '../lib/audit';

const router = Router();

router.use(authMiddleware);

const backupDir = path.join(__dirname, '../../backups');
try {
  fs.mkdirSync(backupDir, { recursive: true });
} catch {}

router.post('/create', requireRole(['OWNER']), async (req: AuthRequest, res) => {
  const dbPath = path.join(__dirname, '../../prisma/dev.db');
  if (!fs.existsSync(dbPath)) throw new AppError('Database file not found', 500);

  const now = new Date();
  const fileName = `backup-${now.toISOString().replace(/[:.]/g, '-')}.db`;
  const filePath = path.join(backupDir, fileName);

  fs.copyFileSync(dbPath, filePath);
  const fileSize = fs.statSync(filePath).size;

  const backup = await prisma.backup.create({
    data: {
      fileName,
      filePath,
      fileSize,
      notes: req.body.notes || null,
      createdBy: req.user!.id,
    },
  });

  await logAudit({
    userId: req.user!.id,
    action: 'BACKUP_CREATE',
    entity: 'BACKUP',
    recordId: backup.id,
  });

  res.status(201).json(backup);
});

router.get('/list', requireRole(['OWNER']), async (req: AuthRequest, res) => {
  const [backups, total] = await Promise.all([
    prisma.backup.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.backup.count(),
  ]);
  res.json({ backups, total });
});

router.get('/:id/download', requireRole(['OWNER']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const backup = await prisma.backup.findUnique({ where: { id } });
  if (!backup) throw new AppError('Backup not found', 404);
  if (!fs.existsSync(backup.filePath)) throw new AppError('Backup file missing from storage', 404);
  res.download(backup.filePath, backup.fileName);
});

router.post('/restore/:id', requireRole(['OWNER']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const backup = await prisma.backup.findUnique({ where: { id } });
  if (!backup) throw new AppError('Backup not found', 404);
  if (!fs.existsSync(backup.filePath)) throw new AppError('Backup file missing', 404);

  const dbPath = path.join(__dirname, '../../prisma/dev.db');
  fs.copyFileSync(backup.filePath, dbPath);

  await logAudit({
    userId: req.user!.id,
    action: 'BACKUP_RESTORE',
    entity: 'BACKUP',
    recordId: id,
  });

  res.json({ success: true, message: 'Restore complete. Server will use the restored database on next start.' });
});

router.delete('/:id', requireRole(['OWNER']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const backup = await prisma.backup.findUnique({ where: { id } });
  if (!backup) throw new AppError('Backup not found', 404);

  try {
    if (fs.existsSync(backup.filePath)) fs.unlinkSync(backup.filePath);
  } catch {}

  await prisma.backup.delete({ where: { id } });
  res.json({ success: true });
});

export default router;