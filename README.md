# OTTv2 Multiplayer

Web-based multiplayer OTTv2 game for the INT3304 Network Programming course.

## W0 technology baseline

- pnpm workspace
- React, Vite and TypeScript web client
- Fastify and TypeScript application server
- PostgreSQL with Prisma
- Shared Zod contracts
- Vitest, Playwright and k6 testing foundations

## Prerequisites

- Node.js 24 or newer
- Corepack
- PostgreSQL 17+ for migration verification (the local setup uses the PostgreSQL-compatible Postgres Pro Standard 17.7 distribution)
- k6 only when running load tests

## Bootstrap

```powershell
corepack pnpm install
Copy-Item .env.example .env
corepack pnpm db:generate
corepack pnpm build
corepack pnpm typecheck
corepack pnpm test
```

Set `DATABASE_URL` in `.env` to a disposable development PostgreSQL database before running migrations:

```powershell
corepack pnpm db:deploy
corepack pnpm db:status
```

The Prisma commands load the root `.env` automatically. For the local database created during W0, use the `ottv2_dev` database and the `ottv2` development role on `127.0.0.1:5432` (keep the password local and never commit it).

Run web and server together:

```powershell
corepack pnpm dev
```

- Web: `http://localhost:3000`
- Server health: `http://localhost:3001/health`

Never commit `.env` or production secrets.

## Production-equivalent smoke

Build and serve the static bundle locally before a public deploy:

```powershell
corepack pnpm build
corepack pnpm --filter @ottv2/web preview --host 127.0.0.1 --port 4173
corepack pnpm smoke:production
```

The smoke runner checks the single-service health/metrics endpoints, CORS allowlist and SPA fallback for every canonical route. Set `W12_API_URL` (and optionally `W12_WEB_ORIGIN`) to run the same checks against a deployed URL. `render.yaml` is a deployment blueprint; fill its secret values in Render instead of committing them.

## Documentation

The frozen v0.1 specifications and implementation plans are in [`docs`](docs).
