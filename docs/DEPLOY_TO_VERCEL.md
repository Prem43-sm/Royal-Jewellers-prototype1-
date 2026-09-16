# Deploying to Vercel (Demo Mode)

This project is configured to deploy to Vercel as a serverless app. The setup
uses the existing code untouched, wrapped by a small serverless entry, and the
single existing source file changed is a guard in `backend/src/index.ts` that
skips `app.listen` when the `VERCEL` environment variable is set (no effect
when running locally).

## READ THIS FIRST - Data persistence

Vercel serverless functions run on an **ephemeral filesystem**. The application
uses a local SQLite file (`backend/prisma/dev.db`) and a local `uploads/`
folder. On Vercel:

| Data | What happens on Vercel |
| ---- | ---------------------- |
| SQLite `dev.db` | Comes from the committed file in the repo. **Writes are lost** on the next cold start and are NOT shared across function instances. |
| `uploads/` (documents, backup files) | Located on the throwaway filesystem. Document/backup **file writes fail or vanish** after the request. |
| Audit logs, day closings, sales | All written to SQLite -> **not persisted** between requests on Vercel. |

So a Vercel deployment is a **demo** of the UI and API flow. It boots with the
seeded sample data and works within a single warm request, but nothing durable
saves. For real persistence you must move to a hosted PostgreSQL (Vercel
Postgres / Neon / Supabase) plus an object store for uploads; that requires
schema and code changes and is out of scope for the demo-only setup.

## Files added for Vercel

- `vercel.json` - build/install/output config, serverless function config
  (`includeFiles` ships `backend/prisma/dev.db`), rewrites (`/api/*` -> API,
  everything else -> SPA), and app env vars.
- `package.json` (repo root) - root install/build scripts and the runtime
  dependencies needed by the serverless bundle (`serverless-http` added).
- `api/index.ts` - serverless handler that wraps the existing Express `app`
  with `serverless-http`.
- `.vercelignore` - keeps `node_modules`, `dist`, and `uploads` out of the
  deployment upload.
- `backend/src/index.ts` - one-line guard so `app.listen` is skipped when
  `process.env.VERCEL` is set.

## Deploy steps

### Option A - Vercel CLI

```bash
npm i -g vercel
vercel login
cd D:\Projects\Project2.1
vercel --prod
```

- The project is detected as "Other", installs root + `frontend` dependencies,
  runs `prisma generate` (Linux engine, correct for the lambda), builds the
  frontend to `frontend/dist`, and bundles the `api/index.ts` function.
- `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN` come from `vercel.json`.

### Option B - Import from GitHub at vercel.com

1. Push this repository to a GitHub repo.
2. On vercel.com: *Add New -> Project -> Import* the repo.
3. Framework Preset: **Other** (or leave auto). `vercel.json` supplies the rest.
4. Deploy.

## Local preview of the serverless setup

```bash
npm install                 # installs root deps + runs prisma generate
npx vercel dev
```

`vercel dev` runs the `api/index.ts` function and serves the frontend locally.

## Keeping demo data fresh

The demo database is the committed `backend/prisma/dev.db`. To refresh it with
a clean seed (then commit the new file so Vercel uses it):

```bash
npm --prefix backend run db:reset   # or delete backend/prisma/dev.db
npm --prefix backend run db:seed
```

## Known runtime limitations on Vercel (demo mode)

- SQLite writes are ephemeral (see table above).
- `uploads/` and `uploads/backups/` are writable per request but vanish
  afterwards; document uploads and backup creation will not persist files.
- The SQLite query engine is generated for Linux during the Vercel build, which
  is the correct platform for the lambda (a local Windows `prisma generate`
  only affects the machine it runs on).
- Concurrency between coinciding invocations may produce SQLite lock errors
  (single-file DB, serverless) - expected in demo mode.