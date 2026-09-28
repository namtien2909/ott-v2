# W12 Evidence — Production Readiness / Demo Gate

Nguồn contract: `docs/task-div.md`, `docs/06_FRONTEND_UI_SPEC.md`, `docs/W11_UI_SPEC_ACCEPTANCE_MATRIX.md`.

## Deployment/config evidence

| Check | Evidence | Status |
| :--- | :--- | :--- |
| Single Render service | `render.yaml` (`ott-v2`) builds API + web bundle | PASS |
| PostgreSQL migration on deploy | API `buildCommand` runs `@ottv2/server db:deploy` | PASS |
| SPA refresh fallback | Fastify serves `apps/web/dist` and falls back to `/index.html` | PASS |
| Production CORS allowlist | `CORS_ORIGINS` is explicit; server rejects `*` in production | PASS |
| Production frontend base URL | Same-origin fallback or `VITE_API_BASE_URL` on the single service | PASS |
| Realtime boundary | `REALTIME_ADAPTER` and PlayHTML values are explicit env values | PASS / credential-gated |

## Local production-equivalent smoke

| Target | Command / URL | Expected |
| :--- | :--- | :--- |
| Single service | `http://127.0.0.1:3001/` | 200 HTML |
| API health | `http://127.0.0.1:3001/health` | 200 JSON |
| Metrics | `http://127.0.0.1:3001/diagnostics/metrics` | 200 JSON |
| Canonical routes | `corepack pnpm smoke:production` | 18 routes, all 200 HTML |
| CORS | smoke `Origin: http://localhost:3000` | exact allowlist origin, never `*` |

## Route / responsive / accessibility sanity

| Area | Evidence | Status |
| :--- | :--- | :--- |
| Canonical route map | `apps/web/src/app/routes.ts`, `tests/unit/w12-route-smoke.unit.test.ts` | PASS |
| SPA refresh behavior | smoke runner checks `/login`, `/game/:roomId`, `/history/:matchId`, `/spectate/:roomId` | PASS |
| Viewport and language | `apps/web/index.html` (`lang="vi"`, viewport meta) | PASS |
| Responsive hooks | `apps/web/src/styles/globals.css` media rules; W11 matrix | PASS |
| Accessibility hooks | focus-visible, semantic/live regions and W11 matrix | PASS |
| Reduced motion | `prefers-reduced-motion` CSS guard and W11 matrix | PASS |

## Public deployment boundary

Public URL smoke uses one Render origin for both SPA and API. The runner accepts `W12_API_URL` or `W12_WEB_URL`; no second static service is required.
