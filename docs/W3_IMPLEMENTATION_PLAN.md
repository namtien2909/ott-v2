# W3_IMPLEMENTATION_PLAN.md

> Wave 3 plan for the local v0.1 build. The task mapping below is copied from `docs/task-div.md`, which is the authority for Wave planning.

## 0. Status

- **Wave:** W3
- **Scope:** Homepage + custom Room lifecycle
- **Status:** IMPLEMENTED / VERIFIED (2026-09-25)
- **Precondition:** W2 Auth/Profile gate is PASS; W2 local server and PostgreSQL are available.
- **Target gate:** Tạo/join/search room ổn định.

## 1. Mandatory task-div mapping

| Person | ID | Task-div task | Depends on |
|---|---|---|---|
| A | A07 | Homepage và 3 quick actions | A01 |
| A | A08 | Room grid 4×2, Room Card, Empty State | A07, room contract |
| A | A09 | Create Room modal, search/join flow | A08, backend room API |
| B | B10 | Room ID/name generation và Room Manager | B03 |
| B | B11 | Public/Private room, password verifier | B10 |
| B | B12 | Browse/search/join/idempotency | B10, B11 |
| B | B13 | Host migration và room cleanup | B10 |
| C | C07 | Room lifecycle và visibility tests | B10–B13 |
| C | C08 | Duplicate create/join và isolation tests | B12 |

## 2. Scope boundaries

### In scope

- In-memory authoritative Room Manager for the local single-process v0.1 server.
- Server-generated six-character Room IDs using uppercase characters without `O`, `0`, `I`, or `1`.
- Friendly generated names when the submitted room name is blank.
- Public/private visibility, private password hashing/verifier, timer and spectator configuration validation.
- Exact public WAITING browse list; private rooms are excluded from browse.
- Exact Room ID search, including private metadata without exposing its password verifier.
- Authenticated create/join/leave, active-player capacity of 2, idempotent duplicate create/join, host migration and empty-room cleanup.
- Homepage hero, three quick actions, 4×2 room grid with internal scroll, empty state, create modal, search and password join flow.
- Isolation and lifecycle tests for room visibility, membership, duplicate commands and cleanup.

### Deferred to later waves

- Match/realtime protocol, ready/countdown, clocks, move submission, surrender and playing state (W4).
- Reconnect and active-game locks (W5).
- Ranked matchmaking/Elo (W6), durable Match/History (W7), Social (W8), Guest/AI/Offline (W9), Spectator (W10).
- Cross-process room persistence/Redis or production deployment. The W3 manager is intentionally process-local and is not presented as durable storage.

## 3. Room contract

### Runtime model

- `Room`: `roomId`, `name`, `visibility`, hashed private password (never returned), `mode=UNRANKED`, `timerSeconds`, spectator policy/capacity, `status=WAITING`, host and active players.
- Active player capacity is exactly 2.
- Browse exposes only `visibility=PUBLIC && status=WAITING`.
- `leave` preserves a waiting room when P2 leaves; if the host leaves and P2 remains, P2 becomes host; if no active players remain, the room is removed and its ID is released.

### HTTP endpoints

- `GET /rooms` — browse public waiting rooms; optional `limit` is capped and optional `search` performs exact ID lookup.
- `GET /rooms/:roomId` — exact search/detail; private details are safe metadata and still require a password to join.
- `POST /rooms` — authenticated create; accepts `name?`, `visibility`, `password?`, `timerSeconds`, `spectatorsEnabled`, `spectatorCapacity`; honors `Idempotency-Key`.
- `POST /rooms/:roomId/join` — authenticated join with optional private `password`; honors `Idempotency-Key`.
- `POST /rooms/:roomId/leave` — authenticated leave and host migration/cleanup.

Validation follows SRS/network contracts:

- Name max 30 characters; blank name is generated.
- Public room cannot carry a password.
- Private password length 1–12.
- Timers: 30, 60, 300, 600, 1800 or 3600 seconds.
- Spectator capacity when enabled: 1, 2, 5, 10, 50 or 100.

### Error semantics

- `VALIDATION_ERROR` (400) for invalid configuration.
- `NOT_FOUND` (404) for absent Room ID.
- `CONFLICT` (409) for full room, duplicate active membership or invalid idempotency reuse.
- `UNAUTHORIZED` (401) for missing auth/private password failure.

## 4. Ordered execution

1. Add shared room schemas/constants and public error contracts.
2. Implement pure ID/name generation and `RoomManager` state transitions.
3. Register room routes with W2 session authentication and safe serialization.
4. Add C07/C08 tests for visibility, lifecycle, host transfer, cleanup, duplicate commands and room isolation.
5. Replace the W1 homepage placeholder with A07/A08/A09 room experience and keep W1 demo route intact.
6. Run database status, server/web tests, full typecheck/lint/build and live create/search/join smoke.
7. Update this file with evidence and mark the W3 gate PASS only after all gates succeed.

## 5. Acceptance gates

### B10–B13 backend

- IDs are six uppercase non-ambiguous characters and unique among active rooms.
- Create is server-authoritative, custom rooms are Unranked, private password is hashed, and duplicate create is idempotent.
- Browse never returns private or non-waiting rooms; exact search can find a private waiting room without leaking its password.
- Join validates auth, room existence, private password and 2-player capacity; duplicate join is idempotent for the same player.
- Leave implements P2 retention, host migration and empty-room cleanup.

### A07–A09 UI

- Homepage has the three quick actions and a visible search/create path.
- Room grid has four columns × two visible rows with internal scrolling and an Empty State.
- Create modal disables submit while pending, validates options, displays the generated Room ID and supports public/private password configuration.
- Search/join shows not-found/full/password-required errors and navigates to the room on success.

### C07–C08 tests

- Room lifecycle and visibility transitions are covered.
- Duplicate create/join requests do not create duplicate state.
- Room A cannot read or mutate Room B membership/private data.
- Host migration and empty-room cleanup are deterministic.

## 6. Verification commands

```text
corepack pnpm db:status
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
corepack pnpm test
corepack pnpm --filter @ottv2/server test
corepack pnpm --filter @ottv2/web test
```

Live smoke:

- `GET http://localhost:8000/` → 200.
- `GET http://localhost:3001/health` → 200.
- Authenticated create → browse/search → private password join → leave/host migration.

## 7. Execution record

- Room manager/API: B10–B13 implemented in `apps/server/src/modules/room`; shared contract in `packages/contracts/src/rooms.ts`; process-local authoritative lifecycle with secure private-password verifier.
- Homepage/room UI: A07–A09 implemented in `apps/web/src/pages/HomePage.tsx` and `apps/web/src/components/rooms/RoomBrowser.tsx`; hero, three quick actions, 4×2 scroll grid, Empty State, create modal, exact search and join/password flow.
- Post-gate UI hardening: canonical route aliases were added alongside the existing Vietnamese routes; the global shell now shows network state and session actions; guest mode is explicit on Home; room cards support Room ID copy, private-password errors stay inline, and the public list refreshes automatically every 8 seconds while mapping snapshot diffs to `ROOM_CREATED`/`ROOM_UPDATED`/`ROOM_REMOVED` live status reactions.
- C07/C08 tests: `apps/server/test/unit/room.manager.unit.test.ts` — 5 W3 tests pass; server suite 17/17 pass.
- Full gates: root typecheck/lint pass; web typecheck/lint/build pass; root unit/integration suite 31/31 pass.
- Database: PostgreSQL migration status is up to date (W3 room state is intentionally process-local; no new migration required).
- Live smoke: `GET /` on `:8000` → 200; `GET /health` on `:3001` → 200; authenticated create → browse/search → join → host leave → guest leave → final search 404.
- W3 gate: **PASS — Tạo/join/search room ổn định locally.**
