import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { signToken, authMiddleware, AuthRequest, requireOwner } from '../lib/auth';
import { AppError } from '../lib/errors';
import { logAudit } from '../lib/audit';

const router = Router();

router.post(
  '/login',
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  }
);

router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, name: true, email: true, role: true, phone: true, createdAt: true },
  });
  res.json(user);
});

router.post('/logout', authMiddleware, async (req: AuthRequest, res) => {
  res.json({ success: true });
});

router.post(
  '/change-password',
  authMiddleware,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });

    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await logAudit({
      userId: user.id,
      action: 'PASSWORD_CHANGE',
      entity: 'USER',
      recordId: user.id,
    });

    res.json({ success: true });
  }
);

router.get('/', authMiddleware, requireOwner, async (req: AuthRequest, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      phone: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json(users);
});

router.post(
  '/',
  authMiddleware,
  requireOwner,
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['OWNER', 'MANAGER', 'STAFF']).withMessage('Invalid role'),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, role, phone } = req.body;

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existing) {
      throw new AppError('An account with this email already exists', 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        passwordHash,
        role,
        phone,
      },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    });

    await logAudit({
      userId: req.user!.id,
      action: 'CREATE',
      entity: 'USER',
      recordId: user.id,
      newValue: JSON.stringify({ name, email, role }),
    });

    res.status(201).json(user);
  }
);

router.put('/:id', authMiddleware, requireOwner, async (req: AuthRequest, res) => {
  const { name, role, status, phone, password } = req.body;
  const id = parseInt(req.params.id);

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new AppError('User not found', 404);

  const data: any = {};
  if (name !== undefined) data.name = name;
  if (role !== undefined) data.role = role;
  if (status !== undefined) data.status = status;
  if (phone !== undefined) data.phone = phone;
  if (password) data.passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, status: true, phone: true, createdAt: true },
  });

  await logAudit({
    userId: req.user!.id,
    action: 'UPDATE',
    entity: 'USER',
    recordId: id,
    oldValue: JSON.stringify({ name: existing.name, role: existing.role, status: existing.status }),
    newValue: JSON.stringify({ name, role, status }),
  });

  res.json(user);
});

router.delete('/:id', authMiddleware, requireOwner, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (id === req.user!.id) {
    throw new AppError('You cannot delete your own account', 400);
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new AppError('User not found', 404);

  await prisma.user.update({
    where: { id },
    data: { status: 'INACTIVE' },
  });

  await logAudit({
    userId: req.user!.id,
    action: 'DELETE',
    entity: 'USER',
    recordId: id,
    oldValue: JSON.stringify({ email: existing.email }),
  });

  res.json({ success: true });
});

export default router;