import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

import './lib/asyncHandler';
import { notFound, errorHandler } from './lib/errors';
import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import productRoutes from './routes/products';
import customerRoutes from './routes/customers';
import supplierRoutes from './routes/suppliers';
import metalRateRoutes from './routes/metalRates';
import saleRoutes from './routes/sales';
import purchaseRoutes from './routes/purchases';
import oldGoldRoutes from './routes/oldGold';
import orderRoutes from './routes/orders';
import artisanRoutes from './routes/artisans';
import jobWorkRoutes from './routes/jobWorks';
import repairRoutes from './routes/repairs';
import expenseRoutes from './routes/expenses';
import accountRoutes from './routes/accounts';
import reportRoutes from './routes/reports';
import dayClosingRoutes from './routes/dayClosing';
import documentRoutes from './routes/documents';
import auditLogRoutes from './routes/auditLogs';
import backupRoutes from './routes/backup';
import settingsRoutes from './routes/settings';
import searchRoutes from './routes/search';
import categoryRoutes from './routes/categories';
import goldTestRoutes from './routes/goldTests';
import notificationRoutes from './routes/notifications';

const app = express();
const PORT = parseInt(process.env.PORT || '5000');

const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const uploadsPath = path.join(__dirname, '../uploads');
try {
  fs.mkdirSync(uploadsPath, { recursive: true });
} catch {}
app.use('/uploads', express.static(uploadsPath));

const apiRouter = express.Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/dashboard', dashboardRoutes);
apiRouter.use('/products', productRoutes);
apiRouter.use('/categories', categoryRoutes);
apiRouter.use('/customers', customerRoutes);
apiRouter.use('/suppliers', supplierRoutes);
apiRouter.use('/metal-rates', metalRateRoutes);
apiRouter.use('/sales', saleRoutes);
apiRouter.use('/purchases', purchaseRoutes);
apiRouter.use('/old-gold', oldGoldRoutes);
apiRouter.use('/gold-tests', goldTestRoutes);
apiRouter.use('/orders', orderRoutes);
apiRouter.use('/artisans', artisanRoutes);
apiRouter.use('/job-works', jobWorkRoutes);
apiRouter.use('/repairs', repairRoutes);
apiRouter.use('/expenses', expenseRoutes);
apiRouter.use('/accounts', accountRoutes);
apiRouter.use('/reports', reportRoutes);
apiRouter.use('/day-closing', dayClosingRoutes);
apiRouter.use('/documents', documentRoutes);
apiRouter.use('/audit-logs', auditLogRoutes);
apiRouter.use('/backup', backupRoutes);
apiRouter.use('/settings', settingsRoutes);
apiRouter.use('/search', searchRoutes);
apiRouter.use('/notifications', notificationRoutes);

app.use('/api', apiRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

export default app;