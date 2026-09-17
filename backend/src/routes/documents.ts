import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRole } from '../lib/auth';
import { AppError } from '../lib/errors';
import { logAudit } from '../lib/audit';

const router = Router();

const uploadDir = path.join(__dirname, '../../uploads/documents');
try {
  fs.mkdirSync(uploadDir, { recursive: true });
} catch {}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'application/zip',
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('File type not allowed'));
  },
});

router.use(authMiddleware);

router.get('/', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const category = (req.query.category as string) || '';
  const search = (req.query.search as string) || '';
  const where: any = {};
  if (category) where.category = category;
  if (search) {
    where.OR = [{ name: { contains: search } }, { description: { contains: search } }, { fileName: { contains: search } }];
  }

  const documents = await prisma.document.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(documents);
});

router.post(
  '/upload',
  requireRole(['OWNER', 'MANAGER']),
  upload.array('files', 10),
  async (req: AuthRequest, res) => {
    if (!req.files || !(req.files as any[]).length) {
      throw new AppError('No files uploaded', 400);
    }

    const { category, description, relatedId } = req.body;
    const files = req.files as Express.Multer.File[];
    const docs = [];

    for (const file of files) {
      const doc = await prisma.document.create({
        data: {
          name: path.parse(file.originalname).base,
          fileName: file.filename,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
          category: category || 'OTHER',
          description: description || null,
          relatedId: relatedId ? parseInt(relatedId) : null,
        },
      });
      docs.push(doc);
    }

    await logAudit({
      userId: req.user!.id,
      action: 'UPLOAD',
      entity: 'DOCUMENT',
      recordId: docs[0].id,
      newValue: JSON.stringify({ count: docs.length, category }),
    });

    res.status(201).json({ documents: docs });
  }
);

router.get('/:id/download', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new AppError('Document not found', 404);
  if (!fs.existsSync(doc.filePath)) throw new AppError('File missing from storage', 404);

  res.download(doc.filePath, doc.fileName);
});

router.delete('/:id', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new AppError('Document not found', 404);

  try {
    if (fs.existsSync(doc.filePath)) fs.unlinkSync(doc.filePath);
  } catch (err) {}

  await prisma.document.delete({ where: { id } });
  await logAudit({ userId: req.user!.id, action: 'DELETE', entity: 'DOCUMENT', recordId: id });
  res.json({ success: true });
});

export default router;