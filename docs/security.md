# Security

This document covers the security architecture: the role-based access control matrix, the authentication flow (JWT + bcrypt), the Express 4 async error patch, Prisma transaction safety, audit logging, backup notes, and input validation.

## Role Model

Three user roles exist. They are plain strings on `User.role` and are validated against an allow-list (`OWNER`, `MANAGER`, `STAFF`) at creation/update time.

| Role | Access |
| ---- | ------ |
| OWNER | Full access: operations, financials, user management, backups, audit logs |
| MANAGER | Operations + financials (reports, day closing view, accounts, profit); no user management, no backups, no audit log access |
| STAFF | Operations only; profit and purchase-cost figures are hidden |

## RBAC Matrix

| Feature / Module | OWNER | MANAGER | STAFF |
| ---------------- | :---: | :-----: | :---: |
| Login, change password, view self | X | X | X |
| Dashboard (non-financial) | X | X | X |
| Dashboard (profit, financial figures) | X | X | - |
| Products, categories, customers, suppliers CRUD | X | X | X |
| Sales (create, payments, invoices) | X | X | X |
| Cancel a sale | X | - | - |
| Purchases (create) | X | X | - |
| Metal rates (create/update) | X | X | - |
| Old gold exchange | X | X | X |
| Orders | X | X | X |
| Job works (create/issue/return) | X | X | - |
| Repairs (create/update) | X | X | X |
| Cancel a repair | X | X | - |
| Expenses | X | X | - |
| Accounts (view/transactions) | X | X | - |
| Reports (sales, purchases, profit, stock) | X | X | - |
| Day closing: view today / history | X | X | - |
| Day closing: close day | X | - | - |
| Documents | X | X | - |
| Settings | X | X | - |
| User management (create/edit/disable) | X | - | - |
| Backup (create/list/download/restore/delete) | X | - | - |
| Audit logs (read) | X | - | - |
| Gold tests | X | X | X |
| Notifications | X | X | X |
| Global search | X | X | X |

Notes:

- Role checks are implemented per-route via `requireRole(['OWNER'])`, `requireRole(['OWNER','MANAGER'])`, `requireRole(['OWNER','MANAGER','STAFF'])` in `backend/src/lib/auth.ts`. `requireOwner` and `requireOwnerManager` are convenience shortcuts.
- The frontend additionally hides OWNER-only navigations (Audit Logs, Backup, User Management) through `RequireRole` in `App.tsx` and the `Layout` component. Server-side checks are authoritative.
- STAFF cannot delete a sale; sale deletion requires `requireRole(['OWNER'])`.
- STAFF cannot see `profit`/`purchaseCost`; the dashboard aggregate sets these to `null` for non-OWNER/MANAGER users.

## Authentication Flow

### Password Hashing

- Passwords are hashed with `bcrypt.hash(password, 10)` using bcryptjs (pure JS). Raw passwords are never stored or logged.
- Default accounts are seeded with the same cost factor.
- `POST /api/auth/change-password` verifies the current password with `bcrypt.compare` before updating.

### Login and Token Issuance

1. Client sends `POST /api/auth/login` with `{ email, password }`.
2. Server validates shape with express-validator, then looks up the user by lowercased/trimmed email.
3. `bcrypt.compare(password, passwordHash)` guards the endpoint; a generic `401 Invalid email or password` is returned to avoid user enumeration.
4. A disabled account (`status !== 'ACTIVE'`) gets `403 Account is disabled`.
5. On success the server signs a JWT:

```typescript
jwt.sign({ id, name, email, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }) // default 24h
```

6. The client stores the token (frontend Zustand `auth` store) and sends it as `Authorization: Bearer <token>` on every request.

### Request-time verification

`authMiddleware` in `backend/src/lib/auth.ts`:

- Requires a `Bearer` token; missing/malformed header -> `401`.
- Verifies the JWT signature and expiry; failure -> `401 Invalid or expired token`.
- Re-queries the user from the database on every request and rejects missing or `INACTIVE` accounts, so disabling a user takes effect immediately (no reliance on token TTL alone).
- Attaches `req.user = { id, name, email, role }` for downstream role checks.

## Express 4 Async Error Patch

Express 4 does not forward rejected promises returned from async route handlers to the error middleware. Without intervention an `async (req, res) => { throw ... }` becomes an unhandled rejection which can crash the process without ever producing an HTTP response.

The application patches this globally in `backend/src/lib/asyncHandler.ts`, imported once at the top of `src/index.ts`:

```typescript
import Layer from 'express/lib/router/layer';

const original = Layer.prototype.handle_request;
Layer.prototype.handle_request = function (req, res, next) {
  const fn = this.handle;
  if (fn.length > 3) return next();          // error handlers: do not touch
  try {
    const result = fn.call(this, req, res, next);
    if (result && typeof result.then === 'function') {
      result.catch((err) => next(err));      // route rejections -> error pipeline
    }
  } catch (err) {
    next(err);
  }
};
```

Rationale and guarantees:

- Every async route rejection is forwarded to `next(err)` and lands in `errorHandler` instead of becoming an unhandled error.
- Error-type middleware (`fn.length > 3`) is left untouched.
- The import must happen before any route handler is registered (it does: it is the first import in `src/index.ts`).
- With this patch, route modules do not need per-handler `try/catch` wrappers; domain validation errors are still thrown explicitly via `AppError`.

## Central Error Handler

`errorHandler` in `lib/errors.ts` maps errors to responses:

| Source | Response |
| ------ | -------- |
| `AppError` | status from the error (default 400), message in `{ error }` |
| Prisma P2002 (unique constraint) | 409 "A record with the same unique value already exists" |
| Prisma P2003 (FK violation) | 409 "Related record does not exist" |
| Prisma P2025 (record missing) | 404 "Record not found" |
| Prisma validation error | 400 "Invalid data provided" |
| JSON body parse failure | 400 "Invalid JSON in request body" |
| Anything else | 500 "An unexpected server error occurred" |

Generic 500 responses intentionally omit internal details to avoid leaking stack traces or schema information to clients.

## Prisma Transaction Safety

Multi-step writes run inside `prisma.$transaction(async (tx) => {...})`:

- Sale creation (`sales.ts`): validates stock, builds line items, updates product statuses to SOLD, writes `StockMovement` rows, creates the sale + payments, and updates the customer ledger - all or nothing.
- Sale payment and cancellation: payment + sale balance update + ledger rows are atomic.
- Cancellation only flips status to `CANCELLED` and returns items to stock; the original invoice number and amounts remain in history.

Transactions use `{ maxWait: 30000, timeout: 90000 }`. SQLite serializes writes, so concurrent modifications cannot partially apply.

## Audit Logging

`logAudit()` in `backend/src/lib/audit.ts` writes into the `AuditLog` table. Recorded events include, at minimum:

- `CREATE` / `UPDATE` / `DELETE` on users, products, customers, suppliers, sales, purchases
- `SALE_CREATE`, `SALE_PAYMENT`, cancellation
- `OLD_GOLD_EXCHANGE`, `GOLD_TEST`
- `JOB_WORK_CREATE`, `JOB_WORK_UPDATE`, `REPAIR_CREATE`, `REPAIR_UPDATE`
- `DAY_CLOSE`, `PASSWORD_CHANGE`
- `BACKUP_CREATE`, `BACKUP_RESTORE`

Each row stores `userId`, `action`, `entity`, `recordId`, and JSON snapshots in `oldValue`/`newValue` (for change comparisons). Writes are best-effort: if the audit insert fails, the underlying operation still succeeds and the failure is logged to the console, so auditing cannot block business flow. Audit rows are only readable via `GET /api/audit-logs` which is OWNER-only.

## Backup Security Notes

- Backup endpoints require the OWNER role (`BACKUP_CREATE`, `BACKUP_RESTORE` are also audited).
- Backups copy the SQLite file into the `backups/` directory with a timestamped filename; the file is downloadable only via the OWNER-protected download route.
- The database file is encrypted only at the OS/drive level (there is no application-level encryption) and transport is HTTP unless the deployment adds TLS at the reverse proxy. For a shop deployment this should be combined with file-system permissions so only the service account can read `backups/` and `prisma/dev.db`.
- Restore replaces `prisma/dev.db` in place; the API warns that the process should be restarted so the running PrismaClient picks up the restored file.

## Input Validation

- `express-validator` runs in the auth and sales/old-gold routes; failures return `400 { errors: [...] }`.
- Domain rules enforced in route logic:
  - Login: valid email + non-empty password.
  - Password change: current password required, new password >= 6 chars.
  - User create: name, email, password >= 6, role must be one of OWNER/MANAGER/STAFF.
  - Sales: at least one item; valid payment method; a product must exist, be `IN_STOCK`/`RESERVED`, and have a rate.
  - Old gold: grossWeight >= 0.001, testedPurity 0-24, rate >= 0.
  - Day close: can only close a day that is not already closed.
- Zone-based sanitization (raw `req.body` reads) is handled per-field by explicit `parseFloat`/`parseInt` coercion and boolean/string allow-lists where needed.
- JSON body limit is `10mb`; multer handles file uploads under `uploads/`. Helmet adds security headers (CSP disabled to keep the Vite dev experience simple; production should enable a strict CSP via reverse proxy).
- CORS is currently permissive (`origin: '*'`, credentials: true). Tighten to the frontend origin in production.

## Production Hardening Checklist

- Set a strong `JWT_SECRET` and a sane `JWT_EXPIRES_IN` in production `.env`.
- Restrict CORS to the actual frontend origin.
- Terminate TLS at the reverse proxy (nginx/IIS) in front of ports 3000/5000.
- Enable a Content-Security-Policy at the proxy layer.
- Protect `backups/`, `prisma/dev.db`, and `uploads/` with file-system ACLs.
- Change/suppress the seeded default credentials immediately after onboarding.
- Use the OWNER-only backup route to take a database snapshot before upgrades or restores.