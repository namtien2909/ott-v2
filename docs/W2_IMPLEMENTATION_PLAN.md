# W2_IMPLEMENTATION_PLAN.md

> Wave 2 implementation plan for the local v0.1 build. This document is derived from `docs/task-div.md` and the current SRS/network/architecture documents.

## 0. Status

- **Wave:** W2
- **Scope:** Auth + Profile flow
- **Status:** IMPLEMENTED / VERIFIED (2026-09-25)
- **Authoritative task list:** `docs/task-div.md` (read first before planning this wave)
- **Precondition:** W1 is implemented and verified 100%; W1 gate is green and the local web/server smoke URLs are available.
- **Target:** Complete W2 locally with PostgreSQL, Fastify, Prisma, React and automated tests.

## 1. Mandatory task-div mapping

Only the following Wave 2 tasks are in scope. IDs, owners and dependencies are preserved from `docs/task-div.md`.

| Person | ID | Task-div task | Depends on |
|---|---|---|---|
| A | A05 | Phase 2 Login/Register/Forgot Password UI | Auth contract |
| A | A06 | Phase 2 Recovery Code one-time UI, Profile, Settings | A05, backend auth |
| B | B06 | User/Profile/Stats/Session schema | B02 |
| B | B07 | Register/Login/Logout và password hashing | B06 |
| B | B08 | Recovery Code, revoke session, throttling | B07 |
| B | B09 | Profile/settings APIs | B06, B07 |
| C | C05 | Auth validation/session/recovery tests | B07/B08 |
| C | C06 | Public/private profile separation tests | B09 |

**Wave gate from `task-div.md`:** Auth/Profile flow complete.

## 2. Scope and non-scope

### In scope

- Durable account, profile, stats and authenticated session records in PostgreSQL.
- Registration validation and one-time Recovery Code reveal.
- Login/logout with an HttpOnly cookie-backed server session; multiple sessions per account remain allowed.
- Password hashing using Node's standard `crypto.scrypt` API; no plaintext passwords or recovery codes stored.
- Forgot-password recovery with progressive throttling and revocation of prior sessions.
- Authenticated password change: current session survives and other sessions are revoked.
- Self/private profile and public profile responses with no private auth fields in the public variant.
- Profile/settings UI for auth, one-time Recovery Code display, theme preference and profile basics.
- Unit/integration tests covering validation, sessions, recovery, throttling and public/private separation.

### Explicitly deferred

- Match/room/friend/history persistence and APIs (later task-div waves).
- Active-game lock/surrender semantics (later match/room waves).
- Realtime presence (W0 adapter remains disabled locally).
- Production deployment/managed PostgreSQL and visual redesign outside the W2 screens.

## 3. Contract decisions

### HTTP endpoints

- `POST /auth/register` — `fullName`, `displayName`, `username`, `password`; creates account, profile, stats and one session; returns self bootstrap and plaintext Recovery Code exactly on this response only.
- `POST /auth/login` — `username`, `password`, optional `remember`; creates a new session and sets the session cookie.
- `POST /auth/logout` — revokes the current session and clears the cookie; idempotent for an absent session.
- `POST /auth/recover` — `username`, `recoveryCode`, `newPassword`; resets password and revokes all existing sessions.
- `POST /auth/password` — authenticated `currentPassword`, `newPassword`; keeps current session and revokes every other session.
- `GET /auth/me` — authenticated self profile/bootstrap.
- `GET /profiles/:username` — public profile only; no password, recovery, session or private settings fields.
- `PATCH /profiles/me` — authenticated display name/full name/theme settings update; username remains immutable.

Responses use the existing public error envelope. Validation errors are deterministic and do not leak account existence or password/recovery verifier data.

### Validation

- Full name: Unicode-aware trimmed length 2–50.
- Display name: trimmed length 2–20.
- Username: 4–20 ASCII characters `[A-Za-z0-9_]`, normalized case-insensitively for uniqueness.
- Password: minimum 8 characters.
- Recovery Code: generated server-side, shown once after registration, stored only as a hash.

### Session/security rules

- Store only a SHA-256 hash of a random session token in the database.
- Cookie is `HttpOnly`, `SameSite=Lax`; `Secure` is enabled in production; local development uses HTTP.
- Session expiry is enforced server-side; `remember=false` uses a short session and `remember=true` uses a longer session.
- Password/recovery failures are progressively throttled per normalized username/IP key with bounded in-memory state for this local v0.1 wave.

## 4. Data model and module design

### Prisma models

- `User`: id, fullName, displayName, normalized username, password hash, recovery-code hash, recovery-used marker, timestamps.
- `UserProfile`: one-to-one user settings (theme and public bio/avatar placeholders only where already supported).
- `UserStats`: one-to-one zeroed Ranked/Quick Match counters and Elo placeholder fields.
- `Session`: hashed token, user id, remember flag, expires/revoked timestamps, created/last-used timestamps.

Unique constraints are placed on normalized username and one-to-one foreign keys. Index session lookup by token hash and user id.

### Server modules

- `modules/auth`: schemas, crypto helpers, throttle, service and routes.
- `modules/profile`: self/public schemas, service and routes.
- `shared/http`: cookie and request-auth helpers if needed.
- `DatabasePort` is extended with the Prisma client capability without breaking the existing health adapter test double.

## 5. Ordered execution plan

1. Extend Prisma schema and create/apply a named W2 migration; regenerate Prisma client.
2. Add shared auth/profile request/response schemas and stable error codes.
3. Implement crypto/session/throttle primitives and auth service.
4. Register auth routes and profile routes in `buildApp`; preserve health/realtime lifecycle.
5. Add server tests for B07/B08/B09 behavior and C05/C06 acceptance cases.
6. Replace auth/profile/settings placeholders with functional A05/A06 screens using the existing HTTP client and cookie credentials.
7. Run formatting/lint/typecheck/build/unit/integration gates and live smoke against ports 3001/8000.
8. Update this plan with execution evidence and mark the W2 gate PASS only after all checks succeed.

## 6. Acceptance gates

### B06–B09 backend gate

- Migration deploys on the local PostgreSQL database.
- Register persists account/profile/stats and never persists plaintext password/recovery code.
- Login accepts valid credentials, rejects invalid credentials, sets a cookie, and permits a second session.
- Logout revokes only the current session.
- Recovery accepts a valid one-time code, rejects reuse, changes password and revokes old sessions.
- Password change keeps the current session and revokes other sessions.
- Profile self response contains private settings/stats needed by the UI; public response excludes auth/session/recovery data.

### A05–A06 UI gate

- Login/Register/Forgot Password forms are wired to the real API with pending, validation and error states.
- Registration shows Recovery Code exactly once with an explicit copy/acknowledge interaction.
- Profile and Settings render authenticated data and theme setting; username is visibly immutable.
- UI remains usable at desktop/mobile widths and keeps cookie credentials enabled.

### C05–C06 test gate

- Validation matrix covers username/name/password rules and duplicate username normalization.
- Session matrix covers cookie establishment, expiry/revocation, multiple sessions and logout.
- Recovery matrix covers valid/invalid/reused code, throttling and session revocation.
- Public/private profile tests prove no password/recovery/session leakage.

## 7. Verification commands

```text
corepack pnpm db:generate
corepack pnpm db:deploy
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
corepack pnpm test
corepack pnpm --filter @ottv2/server test
corepack pnpm --filter @ottv2/web test
```

Live smoke:

- `GET http://localhost:3001/health` → 200 with database `ok`.
- `GET http://localhost:8000/` → 200.
- Register → login → `/auth/me` → profile/settings → logout/re-login using the browser or `app.inject`.

## 8. Execution record

- Migration: `20260925160000_w2_auth_profile`; local PostgreSQL reports **Database schema is up to date**.
- Backend: Auth/Profile service, cookie sessions, scrypt password/recovery hashes, one-time recovery, session revocation and throttling implemented.
- Frontend: A05 Login/Register/Forgot Password forms; A06 one-time Recovery Code screen, Profile and Settings screens wired to the real API.
- C05/C06: `apps/server/test/integration/auth.integration.test.ts` — 5 W2 integration tests pass; server suite 17/17 pass.
- Frontend tests: 10/10 pass.
- Post-gate UI hardening: password fields support show/hide, registration and recovery validate confirmation passwords, the one-time Recovery Code requires an explicit saved acknowledgement before leaving, Profile supports own/public dossier routes, and Settings exposes account/experience/privacy tabs, sound/reduced-motion preferences and an unsaved-change guard.
- Full gates: root typecheck, lint and build pass; root unit/integration suite 31/31 pass.
- Live smoke: `GET /` on `:8000` → 200; `GET /health` on `:3001` → 200; register → `/auth/me` → 201/200 using local PostgreSQL.
- W2 gate: **PASS — Auth/Profile flow complete locally.**
