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
- `backend/src/index.ts` - guard so `app.listen` is skipped when
  `process.env.VERCEL` is set; CORS switched from wildcard `*` to an
  environment-driven origin allow-list (`CORS_ORIGIN`, defaults to localhost
  dev origins); uploads dir creation wrapped in a non-fatal guard.
- `backend/src/routes/documents.ts`, `backend/src/routes/backup.ts` - module
  load-time `fs.mkdirSync` calls are guarded so a read-only serverless
  filesystem cannot crash the function on boot.
- `.env.example` - lists the names of the environment variables used by the
  project (no secrets).

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
- `DATABASE_URL` comes from `vercel.json`. Set `JWT_SECRET`,
  `JWT_EXPIRES_IN`, and `CORS_ORIGIN` as env vars in the Vercel project
  settings (the backend has safe in-code fallbacks so the app boots without
  them, but you should set a real `JWT_SECRET` for production).

### Option B - Import from GitHub at vercel.com

1. Push this repository to a GitHub repo.
2. On vercel.com: *Add New -> Project -> Import* the repo.
3. Framework Preset: **Other** (or leave auto). `vercel.json` supplies the rest.
4. Add the environment variables (see below) under *Project -> Settings -> Environment Variables*.
5. Deploy.

## Environment variables

See `.env.example`. Names actually used by the project:

| Variable | Required on Vercel | Purpose |
| -------- | ------------------ | ------- |
| `DATABASE_URL` | Yes (set by `vercel.json`) | SQLite connection string for the bundled demo DB |
| `JWT_SECRET` | Recommended | JWT signing secret (safe fallback exists in code) |
| `JWT_EXPIRES_IN` | No | JWT expiry (default `24h`) |
| `CORS_ORIGIN` | No | Comma-separated allow-list of origins (defaults to `http://localhost:3000,http://localhost:5000`); not needed for same-origin use |
| `PORT` | No | Local develop-machine only (Vercel ignores it) |
| `VITE_API_URL` | No | Unused - the frontend calls same-origin `/api` |

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