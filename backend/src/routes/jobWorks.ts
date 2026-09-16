import { Router } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireRole } from '../lib/auth';
import { AppError } from '../lib/errors';
import { logAudit } from '../lib/audit';

const router = Router();

router.use(authMiddleware);

function generateJobNumber() {
  return `JOB-${Date.now().toString().slice(-8)}`;
}

router.get('/', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const status = (req.query.status as string) || '';
  const where: any = {};
  if (status) where.status = status;

  const [jobWorks, total] = await Promise.all([
    prisma.jobWork.findMany({
      where,
      include: {
        artisan: { select: { id: true, name: true, phone: true } },
        items: { include: { product: { select: { id: true, itemCode: true, name: true, huid: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.jobWork.count({ where }),
  ]);

  res.json({ jobWorks, total });
});

router.get('/:id', requireRole(['OWNER', 'MANAGER', 'STAFF']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const jobWork = await prisma.jobWork.findUnique({
    where: { id },
    include: { artisan: true, items: { include: { product: true } } },
  });
  if (!jobWork) throw new AppError('Job work not found', 404);
  res.json(jobWork);
});

router.post('/', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const body = req.body;
  if (!body.artisanId) throw new AppError('Artisan is required', 400);

  const jobNumber = generateJobNumber();

  const jobWork = await prisma.jobWork.create({
    data: {
      jobNumber,
      artisanId: parseInt(body.artisanId),
      expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
      labourCharge: parseFloat(body.labourCharge || 0),
      notes: body.notes || null,
      createdBy: req.user!.id,
      items: body.items?.length
        ? {
            create: body.items.map((i: any) => ({
              productId: i.productId ? parseInt(i.productId) : null,
              metal: i.metal || 'GOLD',
              purity: parseFloat(i.purity || 22),
              issuedWeight: parseFloat(i.issuedWeight || 0),
              returnedWeight: 0,
              finished: false,
            })),
          }
        : undefined,
    },
    include: { items: true },
  });

  for (const item of body.items || []) {
    if (item.productId) {
      await prisma.product.update({
        where: { id: parseInt(item.productId) },
        data: { status: 'JOB_WORK' },
      });
      await prisma.stockMovement.create({
        data: {
          productId: parseInt(item.productId),
          metal: item.metal || 'GOLD',
          purity: parseFloat(item.purity || 22),
          weight: -parseFloat(item.issuedWeight || 0),
          movementType: 'ARTISAN_ISSUE',
          referenceType: 'JOB_WORK',
          referenceId: jobWork.id,
          notes: `Issued to artisan for job ${jobNumber}`,
        },
      });
    }
  }

  await logAudit({
    userId: req.user!.id,
    action: 'JOB_WORK_CREATE',
    entity: 'JOB_WORK',
    recordId: jobWork.id,
    newValue: JSON.stringify({ jobNumber, artisanId: body.artisanId }),
  });

  res.status(201).json(jobWork);
});

router.put('/:id', requireRole(['OWNER', 'MANAGER']), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const existing = await prisma.jobWork.findUnique({ where: { id }, include: { items: true } });
  if (!existing) throw new AppError('Job work not found', 404);

  const body = req.body;
  const data: any = {};
  if (body.status !== undefined) data.status = body.status;
  if (body.labourCharge !== undefined) data.labourCharge = parseFloat(body.labourCharge);
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.expectedDate !== undefined) data.expectedDate = body.expectedDate ? new Date(body.expectedDate) : null;

  if (body.returns?.length) {
    for (const ret of body.returns) {
      const item = await prisma.jobWorkItem.findUnique({ where: { id: parseInt(ret.itemId) } });
      if (item) {
        const returnedWeight = parseFloat(ret.returnedWeight || 0);
        await prisma.jobWorkItem.update({
          where: { id: item.id },
          data: { returnedWeight, finished: ret.finished || returnedWeight >= item.issuedWeight },
        });

        if (item.productId) {
          await prisma.product.update({
            where: { id: item.productId },
            data: { status: 'IN_STOCK' },
          });
        }

        await prisma.stockMovement.create({
          data: {
            productId: item.productId,
            metal: item.metal,
            purity: item.purity,
            weight: returnedWeight,
            movementType: 'ARTISAN_RETURN',
            referenceType: 'JOB_WORK',
            referenceId: id,
            notes: `Returned from job ${existing.jobNumber}`,
          },
        });
      }
    }

    const allReturned = await prisma.jobWorkItem.findMany({ where: { jobWorkId: id } });
    if (allReturned.length && allReturned.every((i) => i.finished)) {
      data.status = 'COMPLETED';
    }
  }

  const jobWork = await prisma.jobWork.update({
    where: { id },
    data,
    include: { items: true },
  });

  await logAudit({
    userId: req.user!.id,
    action: 'JOB_WORK_UPDATE',
    entity: 'JOB_WORK',
    recordId: id,
    oldValue: JSON.stringify({ status: existing.status }),
    newValue: JSON.stringify({ status: jobWork.status }),
  });

  res.json(jobWork);
});

export default router;