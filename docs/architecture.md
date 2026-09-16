# Architecture

This document describes the overall system architecture of the Private Indian Jewellery Shop Management System: the monorepo layout, backend and frontend directory structures, the HTTP request flow, the database design, and deployment notes.

## Monorepo Layout

The project is a monorepo with two independent Node.js applications:

```
D:\Projects\Project2.1\
|-- backend/          Express + TypeScript + Prisma API server
|-- frontend/         React 18 + Vite + Tailwind SPA
|-- docs/             Documentation (this folder)
```

The frontend and backend are decoupled: they communicate only over HTTP. In development the frontend dev server proxies `/api` requests to the backend on port 5000.

## Backend Structure

```
backend/
|-- prisma/
|   |-- schema.prisma        All data models + SQLite datasource
|   `-- dev.db               SQLite database file (created by db:push)
|-- src/
|   |-- index.ts             Express app bootstrap, route mounting
|   |-- seed.ts              Seed script for dev data
|   |-- routes/              One module per API resource (25+ modules)
|   |   |-- auth.ts          login, /me, passwords, user management
|   |   |-- dashboard.ts     aggregates for the dashboard
|   |   |-- products.ts      inventory CRUD
|   |   |-- sales.ts         sales, invoice data, payments, cancel
|   |   |-- purchases.ts     supplier purchases and payments
|   |   |-- oldGold.ts       old gold valuation/exchange
|   |   |-- orders.ts        custom order lifecycle
|   |   |-- jobWorks.ts      artisan issue/return
|   |   |-- repairs.ts       repair jobs
|   |   |-- dayClosing.ts    daily tally and close
|   |   |-- backup.ts        database backups and restore
|   |   `-- ...              categories, customers, suppliers, metal-rates,
|   |                        artisans, expenses, accounts, reports, documents,
|   |                        audit-logs, settings, search, gold-tests, notifications
|   |-- lib/
|   |   |-- prisma.ts        PrismaClient singleton
|   |   |-- auth.ts          JWT sign/verify, authMiddleware, requireRole
|   |   |-- errors.ts        AppError, notFound, errorHandler
|   |   |-- audit.ts         logAudit() helper writing to AuditLog
|   |   `-- asyncHandler.ts  Express 4 async error patch (monkey-patch)
|   |-- services/
|   |   `-- calculations.ts  Shared jewellery price + old gold math
|   `-- types/               TypeScript ambient declarations
|-- uploads/                 Multer upload destination (served statically)
|-- backups/                 Generated database backup files
|-- package.json             Scripts: dev, build, start, db:push, db:seed
```

### Route Mounting

All route modules are mounted on a single `/api` router in `src/index.ts`. Example prefix:

```typescript
apiRouter.use('/auth', authRoutes);
apiRouter.use('/sales', saleRoutes);
apiRouter.use('/metal-rates', metalRateRoutes);
```

Middleware order: `helmet` -> `cors` -> `express.json` -> static `/uploads` -> `/api` router -> `notFound` -> `errorHandler`.

## Frontend Structure

```
frontend/
|-- index.html
|-- vite.config.ts          Port 3000, /api proxy to :5000
|-- tailwind.config.js
|-- src/
|   |-- main.tsx            React bootstrap
|   |-- App.tsx             Client-side routes + role guards
|   |-- index.css           Tailwind directives
|   |-- pages/              One page component per feature (22+)
|   |   |-- Login.tsx       Dashboard.tsx  Sales.tsx  Invoices.tsx
|   |   |-- Inventory.tsx   ProductDetail.tsx  MetalStock.tsx
|   |   |-- OldGold.tsx     Purchases.tsx  Customers.tsx  CustomerDetail.tsx
|   |   |-- Suppliers.tsx   SupplierDetail.tsx  Orders.tsx  JobWork.tsx
|   |   |-- Repairs.tsx     Accounts.tsx  Reports.tsx  Documents.tsx
|   |   |-- Settings.tsx    AuditLogs.tsx  Backup.tsx
|   |-- components/
|   |   |-- Layout.tsx      Sidebar/nav shell with role filtering
|   |   |-- Toast.tsx       Notification toasts
|   |   `-- ui.tsx          Shared reusable UI primitives
|   |-- store/
|   |   |-- auth.ts         Zustand auth store (token + user)
|   |   `-- settings.ts     Zustand shop settings store
|   |-- lib/
|   |   |-- api.ts          Axios instance + auth header injection
|   |   `-- types.ts        Shared TypeScript interfaces + constants
|   `-- hooks/              Custom React hooks
```

### Client-Side Route Protection

`App.tsx` wraps protected pages in `<ProtectedRoute>` (requires a token) and sensitive OWNER-only pages (Audit Logs, Backup) in `<RequireRole roles={['OWNER']}>`. The API also enforces roles server-side; the client guards are a UX convenience only.

## Request Flow

A typical authenticated request:

```
Browser (React SPA)
   |
   |  fetch/axios GET /api/sales/list?page=1
   |  Authorization: Bearer <JWT>
   v
[Vite dev proxy :3000]  ->  [Express app :5000]
   |                            |
   |                            v
   |              helmet / cors / express.json
   |                            |
   |                            v
   |              /api router -> sales routes
   |                            |
   |                            v
   |              authMiddleware (JWT verify + active user check)
   |                            |
   |                            v
   |              requireRole(['OWNER','MANAGER','STAFF'])
   |                            |
   |                            v
   |              route handler (Prisma, prisma.$transaction)
   |                            |
   |                            v
   |              logAudit() -> AuditLog row
   |                            |
   |                            v
   |              JSON response
   v
Browser renders with Zustand state + Recharts charts
```

Errors follow the chain: async handler -> `next(error)` (via async error patch) -> `errorHandler` which maps `AppError`, Prisma errors, and JSON parse errors to HTTP status codes.

## Database Design

SQLite file database defined in `backend/prisma/schema.prisma`. Key models:

| Model | Purpose | Notable fields / relations |
| ----- | ------- | -------------------------- |
| User | Login accounts | role, status, passwordHash; relates to sales/purchases/expenses |
| Category | Product categories | unique name |
| Product | Jewellery items | metal, purity, fineness, weights, charges, status, supplierId |
| StockMovement | Metal ledger | productId, weight (signed), movementType, referenceType/Id |
| MetalRate | Daily rates | metal, purity, buyRate, sellRate, unique per day |
| Customer / CustomerTransaction | Customer ledger | balanceAfter on every ledger row |
| Supplier / SupplierTransaction | Supplier ledger | balanceAfter on every ledger row |
| Sale / SaleItem / SalePayment | Sales + payments | invoiceNumber, grandTotal, profit, PARTIAL/COMPLETED status |
| Purchase / PurchaseItem | Supplier purchases | purchaseNumber, balanceAmount, payments |
| OldGoldExchange | Old gold buy-back | testedPurity, fineGoldWeight, finalValue |
| GoldTest | Purity testing records | acceptedWeight, finalValue |
| Order / OrderItem | Custom orders | status flow QUOTATION..DELIVERED, advance/balance |
| Artisan / JobWork / JobWorkItem | Job work | artisanId, issuedWeight, returnedWeight, finished |
| Repair | Repairs | status RECEIVED..DELIVERED, advancePaid |
| Expense | Shop expenses | category, amount, paymentMethod |
| Account / AccountTransaction | Cash/bank/UPI balances | type, balance |
| Document | File registry | multer filePath, mimeType, category |
| AuditLog | Immutable audit trail | action, entity, recordId, oldValue, newValue |
| DayClosing | End-of-day snapshot | totals by payment method, expected/actual cash, difference |
| Notification | In-app messages | title, message, isRead |
| Settings | Key/value config | shopName, taxRate, currency, sessionTimeout |
| Backup | Backup file records | fileName, filePath, fileSize |

Important practices:

- Financial values are stored as `Float` and rounded to 2 decimal places at computation time via the `round2()` helper in `services/calculations.ts`.
- Historical rates and weights are snapshotted onto `SaleItem`/`PurchaseItem` rows so past invoices are never affected by later rate changes.
- Multi-step operations (sale creation, payment application, cancellation) run inside `prisma.$transaction` for atomicity.

## Deployment Notes

Deployment is a single server: the backend is a Node process on port 5000, the frontend is a static bundle served beside it.

### Production Backend

```bash
cd backend && npm ci && npm run db:push && npm run build && npm start
```

Env vars (`.env`): `DATABASE_URL=file:./prisma/dev.db`, `JWT_SECRET=<random>`, `JWT_EXPIRES_IN=24h`, `PORT=5000`. The `uploads/` and `backups/` directories are created at runtime and must be persisted on the file system.

### Production Frontend

```bash
cd frontend && npm ci && npm run build
```

Serve `frontend/dist/` with any static server (nginx, IIS, CDN). Reverse-proxy `/api/*` (and `/uploads/*`) to the backend on port 5000. Because everything lives in a single SQLite file owned by one Node process, no separate database host or message broker is required.