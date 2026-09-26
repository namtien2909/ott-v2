# W5_IMPLEMENTATION_PLAN.md

> Wave 5 plan derived from `docs/task-div.md`, `03_NETWORK_SPEC.md`, `02_ARCHITECTURE.md` and `06_FRONTEND_UI_SPEC.md`.

## 0. Status

- **Wave:** W5
- **Scope:** Reconnect, refresh recovery, active-game lock, cross-tab authority and session/network failure states
- **Status:** IMPLEMENTED / VERIFIED
- **Precondition:** W4 local Online Match gate is green; frontend runs at `3000`, API at `3001`.
- **Target gate:** A disconnected client has a 30-second grace period, can resync safely, cannot create a second active match, and sees explicit session/network/unsafe-action UI.

## 1. Mandatory task-div mapping

| Person | IDs | Exact W5 scope | Depends on |
|---|---|---|---|
| A — Game Experience Builder | A14–A15 | Reconnect overlay/refresh recovery/stale-action UI; same-browser lock, cross-tab notification, session-expired modal, global network banner | A10, A00 |
| B — Backend / Network / Data | B21–B24 | Disconnect/reconnect events and 30s grace; membership/resync; active-game lock; stale-lock/session-expiry/server-interruption cleanup | B17, B19, Auth/Match |
| C — Integration / QA / Performance | C13–C15 | Reconnect under/over grace; lock races/cross-tab; restart/stale-lock/session-expiry tests | B21–B24, A14–A15 |

## 2. Locked W5 contract

- SSE disconnect marks only that player `connected=false`; the match remains authoritative for **30 seconds**.
- A reconnect from the same authenticated user and client lock emits `PLAYER_RECONNECTED` followed by `STATE_RESYNC` and the latest snapshot.
- Grace expiry emits `MATCH_ABORTED` with `SERVER_INTERRUPTION`, clears active locks and leaves no unsafe move path.
- A user may hold only one active-game lock. A different room or different browser client receives `ACTIVE_GAME_LOCK` until the original match finishes/aborts or the stale lock is explicitly cleaned.
- Every command checks `stateVersion`; after reconnect the client must use the resynced version before sending a move.
- Session `401` responses dispatch a global `SESSION_EXPIRED` UI signal; the app shows a modal and disables match actions.
- Network transitions are explicit: `CONNECTED`, `RECONNECTING`, `OFFLINE`, `DEGRADED`.

## 3. Implementation order

1. Extend match contracts with disconnect/reconnect/resync/abort event names and lock error detail names.
2. Add MatchManager presence tracking, 30-second grace timers, resync snapshots and active-game locks.
3. Wire SSE close/open lifecycle and client identity headers/query parameters.
4. Add HTTP client session-expired/network signals and the AppLayout modal/banner.
5. Add Game Room reconnect overlay, refresh recovery, lock conflict/read-only mode and unsafe-action guards.
6. Add C13–C15 deterministic manager tests plus contract tests and local smoke scenarios.
7. Run full gates and update the execution record only after under/over-grace, lock and expiry paths pass.

## 4. Acceptance gates

- Disconnect/reconnect events are versioned and observable through SSE.
- Refreshing a playing Game Room returns the current canonical snapshot, clocks and `stateVersion`.
- Disconnect under 30s keeps the match alive; reconnect restores legal actions.
- Disconnect over 30s ends with neutral `SERVER_INTERRUPTION` and no future moves.
- A second room cannot be opened by the same account while an active lock exists; same-browser second tab shows a cross-tab warning.
- Stale locks are released after finished/aborted match and server interruption cleanup.
- Expired session and API 401 show a modal; no unsafe match command is sent while expired/offline/reconnecting.
- Frontend remains on `http://localhost:3000`; API remains on `http://localhost:3001`.

## 5. Verification commands

```text
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm --filter @ottv2/server test
corepack pnpm --filter @ottv2/web test
corepack pnpm build
corepack pnpm db:status
```

## 6. Execution record

- **Backend:** `MatchManager` now tracks per-user/client SSE presence, clears/restarts grace timers, emits `PLAYER_DISCONNECTED`, `PLAYER_RECONNECTED`, `STATE_RESYNC`, and aborts after grace with `SERVER_INTERRUPTION`. `stop()` clears timers and in-memory locks on server shutdown.
- **Locking:** every match read/command/SSE request acquires an account active-game lock; a different client receives `409 ACTIVE_GAME_LOCK`. Waiting-room SSE close releases its lock; terminal and server-interruption paths release all room locks.
- **Frontend:** `getClientId()`/`getTabId()` identity, EventSource reconnect state, 5-second offline escalation, refresh-safe snapshot reload, same-browser `BroadcastChannel`/storage lock warning, unsafe-action guards, global network banner and non-dismissible session-expired modal are implemented. Frontend remains on `http://localhost:3000`; API remains on `http://localhost:3001`.
- **Automated verification:** root `34/34`, server `23/23`, web `14/14`; workspace typecheck, lint and build pass; Prisma reports schema up to date.
- **Runtime smoke:** authenticated two-account room on the rebuilt server returned `MATCH_SNAPSHOT` over SSE; same account `tab-a` versus `tab-b` returned `409 ACTIVE_GAME_LOCK`; closing the waiting-room SSE released the lock for the next tab.
- **W5 gate:** PASS for reconnect contract/events, under/over grace manager paths, active-game/cross-tab lock behavior, session/network UI wiring, stale-lock cleanup and local ports.
