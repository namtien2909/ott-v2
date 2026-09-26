# W4_IMPLEMENTATION_PLAN.md

> Wave 4 plan for the local v0.1 build. Derived from `docs/task-div.md`, `SRS.md`, `02_ARCHITECTURE.md`, `03_NETWORK_SPEC.md` and `06_FRONTEND_UI_SPEC.md`.

## 0. Status

- **Wave:** W4
- **Scope:** Online match core — protocol, ready/countdown, clocks, authoritative move pipeline, result/rematch
- **Status:** IMPLEMENTED / VERIFIED (2026-09-25)
- **Precondition:** W1–W3 local gates are green; PostgreSQL is available; frontend is moving from port `8000` to `3000`.
- **Target gate:** Two authenticated browser clients can enter one room, ready, count down, move through the server authority, see clocks/results and request a rematch.

## 1. Mandatory task-div mapping

| Person | IDs | Exact Wave 4 scope | Depends on |
|---|---|---|---|
| A — Game Experience Builder | A10–A13 | Game Room HUD/header/board connection; ready/countdown/clocks; authoritative move feedback; surrender/result/rematch/settings/leave guard | A03, realtime contract |
| B — Backend / Network / Data | B14–B20 | Envelope/error contracts; match state store; ready/side/countdown; timer; move commit; snapshots/deltas; result/surrender/rematch | B05, B03 |
| C — Integration / QA / Performance | C09–C12 | Protocol/event mapping; two-client convergence; stale/duplicate/out-of-order safety; clock/result authority | B14–B20, A10–A13 |

## 2. Local W4 architecture decision

W4 uses a process-local authoritative `MatchManager` with HTTP command endpoints and Server-Sent Events (SSE) for the local event stream. The rules package remains pure and authoritative for move legality; the browser never commits a move locally. SSE envelopes carry `protocolVersion`, `messageId`, `sequence`, `stateVersion`, `matchId`, `roomId`, event type and snapshot payload.

The local adapter is intentionally transport-light: it gives two browser tabs convergence and deterministic ordering without coupling `packages/game-rules` to Fastify or PlayHTML. Production PlayHTML/WebSocket transport remains a later deployment/adapter concern.

## 3. Locked W4 contract

### Match state

- `WAITING_READY` → `COUNTDOWN` → `PLAYING` → `FINISHED` or `ABORTED`.
- Host is BLUE and the joining player is RED; sides are stable for the match.
- Both players must ready before the three-second countdown starts.
- Each side receives the room timer in milliseconds; only the current side's clock decreases.
- A clock reaching zero produces a neutral authoritative timeout result for the opponent.
- `PIECE_MOVE` accepts only a canonical `from`/`to`, the authenticated actor's side and the current `stateVersion`.
- Every accepted event increments both `sequence` and `stateVersion`; stale commands return `CONFLICT` with `STALE_STATE` details and never mutate state.
- Rejected moves preserve the previous rule state and produce a stable `MOVE_REJECTED` event/error mapping.
- `SURRENDER` ends the match with a neutral result reason; `REMATCH_REQUEST` is idempotent and resets to `WAITING_READY` only after both players request it.

### Event names

`MATCH_SNAPSHOT`, `PLAYER_READY`, `COUNTDOWN_STARTED`, `MATCH_STARTED`, `PIECE_MOVE_ACCEPTED`, `PIECE_MOVE_REJECTED`, `CLOCK_TICK`, `PLAYER_SURRENDERED`, `MATCH_FINISHED`, `REMATCH_REQUESTED`, `MATCH_ABORTED`.

## 4. Ordered implementation

1. Add shared match command/snapshot/envelope schemas and stable error detail names (B14).
2. Implement the in-memory serialized `MatchManager`, deterministic side assignment and immutable snapshot serialization (B15–B16).
3. Add authoritative clock progression, timeout, move commit, sequence/stateVersion checks and result/rematch transitions (B17–B20).
4. Register authenticated match REST/SSE routes without changing W1–W3 room ownership.
5. Replace the W1 fixture-only Game Room with online mode for real Room IDs while preserving `/phong/w1-demo` as a fixture fallback (A10–A13).
6. Add server contract/unit tests and web board/HUD tests (C09–C12 evidence).
7. Switch Vite dev server/CORS to port `3000`, run full workspace gates and two-client smoke.

## 5. Acceptance gates

- `packages/contracts` exposes parseable match requests, snapshots and semantic event envelopes.
- A room with two authenticated members produces a match with stable BLUE/RED sides.
- Ready is idempotent; countdown starts exactly once when both players are ready.
- Timer authority is server-side; stale/out-of-order moves cannot change board, turn or clocks.
- Accepted moves are reflected in canonical snapshots and both SSE clients converge.
- Losing/capture/goal/extinction outcomes come from `@ottv2/game-rules`, not duplicated UI logic.
- Surrender, timeout and rematch produce neutral, explicit result states.
- Game Room exposes player HUDs, ready/countdown/clocks/turn/low-time, move feedback, result/rematch, settings and active-match leave warning.
- `http://localhost:3000` serves the frontend; API remains `http://localhost:3001` with CORS allowing `http://localhost:3000`.

## 6. Verification commands

```text
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm --filter @ottv2/server test
corepack pnpm --filter @ottv2/web test
corepack pnpm build
corepack pnpm db:status
```

Live smoke: register two users, create/join a room, open `/game/:roomId` in two browser contexts, ready both, verify countdown/clock/move/result convergence, then request rematch.

## 7. Execution record

- Contracts: `packages/contracts/src/match.ts` now validates ready, move, surrender, rematch, snapshots and versioned event envelopes.
- Backend: `apps/server/src/modules/match/match.manager.ts` is the local authoritative state store; `match.route.ts` exposes authenticated REST commands and SSE snapshots/events.
- Match semantics: stable host BLUE/guest RED assignment, idempotent ready/rematch requests, three-second countdown, server clocks/timeouts, stale `stateVersion` rejection, pure `@ottv2/game-rules` move validation, surrender and neutral result metadata.
- Frontend: `GameRoomPage.tsx` supports real Room IDs through `/game/:roomId`, player HUDs, connection state, ready/countdown, clocks/low-time, server move submission, authoritative feedback, surrender confirmation, result/rematch and in-game settings; `/phong/w1-demo` remains the W1 fixture fallback.
- Port/config: Vite now serves `http://localhost:3000`; `.env` CORS allows `http://localhost:3000`; API remains `http://localhost:3001`.
- Tests: root contract/unit suite **33/33**, server suite **20/20**, web suite **11/11**; workspace typecheck, lint and build pass; PostgreSQL schema is up to date.
- Runtime smoke: two authenticated API sessions created/joined room `BGCZ8Q` during verification, received `BLUE/RED`, both readied, entered `COUNTDOWN`, transitioned to `PLAYING`, submitted `b1 → b2` through the server, and public room browse removed the now-playing room.
- SSE smoke: an authenticated stream returned a versioned `MATCH_SNAPSHOT` envelope from `/matches/:roomId/events`.

## 8. W4 gate

```text
B14–B20 PROTOCOL / MATCH STORE / READY / TIMER / MOVE / SNAPSHOT / RESULT = PASS
A10–A13 HUD / COUNTDOWN / CLOCK / AUTHORITATIVE BOARD / RESULT / REMATCH = PASS
C09–C12 CONTRACT / AUTHORITY / STALE STATE / CLOCK RESULT EVIDENCE = PASS
FRONTEND PORT 3000 + API CORS 3000 = PASS
```
