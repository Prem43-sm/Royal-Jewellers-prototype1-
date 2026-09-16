# Testing

This document describes the end-to-end (E2E) testing approach for the jewellery shop system, how the tests are run, expected results, and the known limitations of the current testing setup.

## Overview

The project uses an E2E test suite written in PowerShell that exercises the live REST API with `Invoke-RestMethod`. The suite treats the deployed backend on `http://localhost:5000/api` as a black box:

- sends real HTTP requests with JSON bodies and Bearer tokens
- asserts on HTTP status codes and response bodies
- validates that role-based access control blocks unauthorized actions (403)
- exercises every major API module including reports, day closing, backup, and audit logs

The suite exists as PowerShell scripts/prompt material in the repo root (`Codex_Master_Execution_Prompt_Jewellery_Shop.txt`). It is not a CI pipeline - it is a manual/scheduled smoke-and-regression run.

## What the Suite Covers

### 1. Authentication

- `POST /api/auth/login` with each seeded user returns `200` plus a `token`.
- Wrong password returns `401`.
- Missing or malformed `Authorization` header returns `401`.
- `GET /api/auth/me` with a valid token returns the profile.

### 2. Dashboard

- `GET /api/dashboard` returns `200` with today's aggregates (sales, purchases, expenses, weights, rates, recent sales).
- For a STAFF token, financial fields such as profit are sanitized (absent or `null`).

### 3. CRUD Regression for All Modules

The suite creates, lists, reads, updates, and (where allowed) deletes records across:

- categories, products, customers, suppliers, metal-rates
- sales (create invoice, list, add payment, cancel), purchases
- orders, artisans, job-works, repairs
- old-gold, gold-tests, expenses, accounts
- documents, notifications, search, settings

For each module it asserts the happy path (`200`/`201`) and a bad-input path (`400`).

### 4. Reports and Analytics

- `GET /api/reports/*` (sales summary, purchase summary, stock valuation, customer/supplier ledgers, profit and loss) returns `200` and non-empty result sets when seed data exists.

### 5. Day Closing

- `GET /api/day-closing/today` returns current-day aggregates and `isClosed: false`.
- `POST /api/day-closing/close` with an `actualCash` value creates a closing record (requires OWNER).
- Closing the same day twice returns `400` "Day already closed".
- `GET /api/day-closing/history` lists previous closings.
- A MANAGER can view but cannot close the day (403).

### 6. Backup

- `POST /api/backup/create` (OWNER) returns a backup record; the file appears under `backend/backups/`.
- `GET /api/backup/list` returns the created backup.
- `GET /api/backup/:id/download` downloads bytes.
- Non-OWNER roles receive `403`.

### 7. Audit Logs

- Performing audited actions (create sale, day close, backup) writes `AuditLog` rows.
- `GET /api/audit-logs` (OWNER) lists them; MANAGER and STAFF receive `403`.

### 8. RBAC Negative Tests (STAFF and MANAGER)

The most valuable part of the suite. It asserts that out-of-role actions fail with `403`:

| Action | STAFF | MANAGER |
| ------ | :---: | :-----: |
| Create/update/delete a user | 403 | 403 |
| Create a backup | 403 | 403 |
| Read audit logs | 403 | 403 |
| Close the day | 403 | 403 |
| Delete a sale | 403 | 403 |
| View profit figures on dashboard | sanitized | allowed |
| Create purchase / job work | 403 | allowed |
| View reports and financials | 403 (financial) | allowed |

## How to Run

### Prerequisites

PowerShell 5.1 or later (the shell already in use for this project).

### Steps

1. Start the backend on port 5000:

```powershell
cd backend
npm run db:push
npm run db:seed
npm run dev        # or: npm run build; npm start
```

2. Run the E2E scripts from the project root. For example:

```powershell
# In PowerShell, from D:\Projects\Project2.1
.\tools\e2e.ps1            # if a script file exists in the repo
# or paste the recorded Invoke-RestMethod sequence from the master prompt document
```

3. Observe output: each test prints a line such as:

```
[PASS] login owner -> 200 token received
[PASS] staff forbidden from /api/backup/create -> 403
[FAIL] expected 200, got 500 on GET /api/reports/sales
```

4. Any `[FAIL]` line should be treated as a regression: check the corresponding route module in `backend/src/routes/` and the seed data.

## Expected Results

With a freshly seeded database (`npm run db:seed`):

- All login tests pass; all three accounts authenticate.
- All CRUD happy paths return `200`/`201`.
- All bad-input tests return `400`.
- All RBAC negative tests return `403` for out-of-role tokens.
- Day close, backup, and audit tests succeed in the order described, because backup/audit/day-close test data carry over within a single run.
- The total pass rate should be 100% on a clean seed; a failure is evidence of a code or seed-data regression.

## Limitations

| Limitation | Impact | Workaround |
| ---------- | ------ | ---------- |
| No unit tests | Business rules (`calculateJewelleryPrice`, old-gold math, day-close math) are only covered indirectly via API responses | Add a unit test framework (Vitest/Jest) over `backend/src/services/calculations.ts` for exact formula assertions |
| No integration test runner | The suite depends on a running server; it cannot be run in a plain CI job without booting the app | Wrap `npm run dev` + the PowerShell suite in a single CI script |
| SQLite in-memory not used | Every run uses the same file DB, so repeated runs accumulate records; invoice/order numbers are partially random but can collide | Run `db:reset` (or delete `prisma/dev.db` and re-seed) before each full run |
| No database rollback between tests | Tests that assert "exactly one backup" or "day closes once" can fail on a second run of the same day | Make day-close/backup checks tolerant, or reseed per run |
| Fixed seed data | Only the seeded fixtures are exercised; edge cases (zero stock, fully-paid combos, tax-0 items) are untested | Extend seed.ts or add ad-hoc test records |
| PowerShell only | The E2E layer is not portable to Linux CI without porting to a REST testing tool | Consider replacing with a Node-based E2E (e.g., `tsx` + fetch) sharing the backend repo |
| No frontend tests | UI rendering, role menus, and form validation are verified manually only | Add Vitest + Testing Library against `frontend/src` |

## Recommendations for the Next Iteration

1. Add a Node unit test file for `calculations.ts` covering the worked example in `business-logic.md`.
2. Automate setup in a `scripts/test-e2e.ps1` that kills old servers, runs `db:reset`, starts the API, runs the assertions, and prints a summary.
3. Add a JWT expiry test (issue a token with `expiresIn: 1s`, wait, assert 401).
4. Add tests for sale cancellation restoring product stock and for duplicate day-close prevention.