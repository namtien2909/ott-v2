# W12_IMPLEMENTATION_PLAN — Production Readiness / Public Demo Gate

Status: IMPLEMENTED / VERIFIED (local production-equivalent; public deploy credential-gated)

## Scope khóa từ `docs/task-div.md`

| Lane | Tasks | Deliverable |
| :--- | :--- | :--- |
| Person A | A26 | Production config, canonical-route/responsive sanity, public URL smoke và deploy preparation |
| Person B | B38 | Production DB/backend/realtime deployment + canonical frontend route, CORS và base-URL validation |
| Person C | C30–C31 | Public URL smoke, route/responsive/accessibility sanity, evidence tables/charts và demo rehearsal |

W12 là cổng cuối của v0.1. Các feature wave trước đã được khóa; W12 không mở thêm gameplay hoặc UI scope. Mục tiêu trước mắt là một cấu hình có thể deploy lên Render, một production build kiểm chứng được locally, và bằng chứng smoke có thể lặp lại. Public deploy thật chỉ thực hiện khi có `DATABASE_URL`, PlayHTML credentials (nếu bật realtime), và URL Render do owner cung cấp.

## Quyết định triển khai

1. Một Render Web Service chạy Node/Fastify phục vụ cả API và Vite SPA; PostgreSQL là database production, Prisma migration chạy bằng `db:deploy`.
2. Frontend bundle được build trong cùng service và Fastify phục vụ `apps/web/dist`, fallback mọi canonical route (`/login`, `/register`, `/home`, `/queue`, `/room/:roomId`, `/game/:roomId`, `/history`, `/history/:matchId`, `/profile/:username`, `/friends`, `/settings`) về `/index.html`.
3. CORS là allowlist explicit. Production không chấp nhận `*`; `CORS_ORIGINS` có thể là cùng public origin. `VITE_API_BASE_URL` trỏ cùng origin hoặc được bỏ trống để dùng relative API URL.
4. `REALTIME_ADAPTER=disabled` vẫn là cấu hình an toàn cho smoke/local; public online match chỉ được coi là ready sau khi đổi sang `playhtml` và điền đủ endpoint/project id.
5. Smoke script mặc định chạy local production-equivalent (`vite preview` + server local). Khi có public URLs, truyền `W12_WEB_URL`, `W12_API_URL`, `W12_WEB_ORIGIN` để chạy cùng một script ngoài internet.

## Thứ tự thực thi

1. Chuẩn hóa port/CORS và production env examples.
2. Thêm Render Blueprint cho một Web Service, gồm frontend build, migration/build/start, SPA fallback và secret placeholders.
3. Thêm canonical route/config tests và smoke runner có kiểm tra HTTP status, SPA fallback, health, metrics và CORS.
4. Chạy build production, preview production và smoke local; ghi evidence và rehearsal theo screen-state contract.
5. Chỉ khi owner cung cấp public URL/credentials mới chạy public smoke/deploy; không commit secrets.

## Gate W12

- `corepack pnpm build`, `typecheck`, `lint`, unit/contract/integration tests và `db:status` pass.
- `render.yaml` có đúng một Web Service, frontend build, migration command và secret env placeholders.
- Mọi canonical route trả HTML 200 qua preview (refresh-safe), backend `/health` và `/diagnostics/metrics` trả 200.
- CORS trả đúng origin allowlist và không phản hồi wildcard trong production.
- Evidence table ghi được local/public URL, responsive/accessibility sanity, screen-state coverage và demo rehearsal.

## Kết quả thực thi

- Chuẩn hóa frontend production port/URL: local dev `3000`, production preview `4173`; stale server CORS default `8000` đã được thay bằng `3000`.
- Added `render.yaml` với một Node Web Service, PostgreSQL `db:deploy`, `/health`, frontend build và secret env placeholders.
- Fastify now serves `apps/web/dist` with safe asset handling and SPA fallback, so `/` and all canonical frontend routes share the API origin.
- Production env fail-closed: wildcard/loopback CORS bị từ chối; PlayHTML adapter yêu cầu đủ endpoint/project id khi bật.
- Added `scripts/w12-production-smoke.mjs`: kiểm tra 18 canonical/alias route, HTML fallback, `/health`, `/diagnostics/metrics` và exact CORS origin. Local result: `PASS`; health HTTP `200` nhưng status `degraded` là expected khi realtime adapter local đang `disabled`.
- Added deployment, route and rehearsal evidence in `W12_EVIDENCE.md` and `W12_DEMO_REHEARSAL.md`.
- Verification: W12 unit tests `6/6`, server tests `42/42`, root tests `47/47`, `typecheck`, `lint`, `build` và `db:status` pass; local production smoke `18 routes + health + metrics + CORS` pass.

### Public deploy boundary

Render chưa được deploy từ workspace này vì chưa có public `DATABASE_URL`, PlayHTML credentials và owner-approved Render URLs. Khi có đủ values, chạy đúng smoke runner với `W12_WEB_URL`, `W12_API_URL`, `W12_WEB_ORIGIN`; không cần sửa code hay đổi test path.
