# Private Indian Jewellery Shop Management System

A full-stack management system for a private Indian jewellery shop that handles inventory, sales, purchases, old gold exchange, job work, repairs, orders, expenses, accounts, day closing, reports, documents, and backups. The system supports three user roles (OWNER, MANAGER, STAFF) with role-based access control enforced on both the REST API and the React frontend.

## Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Backend | Node.js, Express 4, TypeScript |
| ORM | Prisma 5 |
| Database | SQLite (zero-config, file based) |
| Frontend | React 18, Vite 5, TypeScript |
| Styling | Tailwind CSS 3 |
| State | Zustand |
| Charts | Recharts |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Validation | express-validator |
| Security Headers | helmet |
| File Upload | multer |
| Testing | PowerShell E2E suite (Invoke-RestMethod) |

## Quick Start

### Prerequisites

- Node.js 18 or newer
- npm (bundled with Node.js)

### Install

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Database Setup

```bash
cd backend
npm run db:push    # create SQLite schema from Prisma schema
npm run db:seed    # seed roles, users, products, rates, customers, suppliers
```

### Run in Development

```bash
# Terminal 1 - backend on port 5000
cd backend
npm run dev

# Terminal 2 - frontend on port 3000 (Vite proxies /api to :5000)
cd frontend
npm run dev
```

Open http://localhost:3000 in a browser.

### Build and Start (Production)

```bash
# Backend
cd backend
npm run build     # tsc -> dist/
npm run db:push
npm start         # node dist/index.js on port 5000

# Frontend
cd frontend
npm run build     # tsc && vite build -> dist/
# Serve frontend/dist statically, and point /api to the backend
```

## Default Credentials

| Role | Email | Password |
| ---- | ----- | -------- |
| OWNER | admin@jewellery.com | admin123 |
| MANAGER | manager@jewellery.com | manager123 |
| STAFF | staff@jewellery.com | staff123 |

## API Endpoint Summary

All routes are mounted under `/api` and require a `Authorization: Bearer <token>` header unless noted.

| Module | Base Path | Purpose |
| ------ | --------- | ------- |
| auth | `/api/auth` | Login, current user, change password, user CRUD (OWNER) |
| dashboard | `/api/dashboard` | Aggregated today's figures and chart data |
| products | `/api/products` | Product inventory CRUD, statuses, images |
| categories | `/api/categories` | Product category CRUD |
| customers | `/api/customers` | Customer CRUD, ledger, payments |
| suppliers | `/api/suppliers` | Supplier CRUD, ledger, payments |
| metal-rates | `/api/metal-rates` | Daily buy/sell rates per metal and purity |
| sales | `/api/sales` | Create sales, invoices, payments, cancellation |
| purchases | `/api/purchases` | Purchase orders from suppliers, payments |
| old-gold | `/api/old-gold` | Old gold valuation and exchange records |
| orders | `/api/orders` | Custom jewellery orders with advance/balance |
| artisans | `/api/artisans` | Goldsmith/artisan directory |
| job-works | `/api/job-works` | Issue and return of stock to artisans |
| repairs | `/api/repairs` | Customer repair jobs lifecycle |
| expenses | `/api/expenses` | Shop expense entries |
| accounts | `/api/accounts` | Cash/bank/UPI account balances and transactions |
| reports | `/api/reports` | Sales, purchase, stock, ledger, profit reports |
| day-closing | `/api/day-closing` | Today's tally, day close, closing history |
| documents | `/api/documents` | File uploads and document registry |
| audit-logs | `/api/audit-logs` | Read-only audit trail (OWNER) |
| backup | `/api/backup` | Create, list, download, restore, delete DB backups (OWNER) |
| settings | `/api/settings` | Shop details, tax rate, session defaults |
| search | `/api/search` | Global search across products, customers, suppliers |
| gold-tests | `/api/gold-tests` | Gold purity testing records |
| notifications | `/api/notifications` | In-app notification inbox |

## Documentation Index

- [architecture.md](architecture.md) - system layout, request flow, data model, deployment
- [business-logic.md](business-logic.md) - pricing formula, stock lifecycle, ledgers, day closing
- [security.md](security.md) - RBAC matrix, auth flow, async error patch, audit, validation
- [testing.md](testing.md) - E2E PowerShell test suite and how to run it