# W6_IMPLEMENTATION_PLAN.md

> Wave 6 plan derived from `docs/task-div.md`, `02_ARCHITECTURE.md`, `03_NETWORK_SPEC.md` and `06_FRONTEND_UI_SPEC.md`.

## 0. Status

- **Wave:** W6
- **Scope:** Ranked Quick Match queue, atomic pairing/cancel race, Match Found UI, Elo calculation and durable idempotent result update
- **Status:** IMPLEMENTED / VERIFIED
- **Precondition:** W5 reconnect/lock/network gate is verified; frontend `3000`, API `3001`.
- **Target gate:** Two authenticated accounts can join Ranked Quick Match, pair exactly once inside an expanding Elo range, cancel safely before commit, see Match Found and receive an authoritative Elo result after a finalized ranked match.

## 1. Mandatory task-div mapping

| Person | IDs | Exact W6 scope | Depends on |
|---|---|---|---|
| A — Game Experience Builder | A16–A17 | Quick Match queue/cancel, expanding rating range, Match Found cinematic, ranked result/Elo display and guest/account semantics | W5, matchmaking contract |
| B — Backend / Network / Data | B25–B27 | Ranked queue, widening range, atomic pairing/cancel race, Elo calculation and idempotent PostgreSQL transaction | Auth, active lock, persistence |
| C — Integration / QA / Performance | C16–C17 | Queue/cancel/match-found race coverage, two-client pairing evidence and Elo eligibility/formula tests | B25–B27, A16–A17 |

## 2. Locked W6 contract

- Ranked Quick Match is authenticated-account only; Guest Quick Match remains Unranked and is not queued by W6.
- Queue state is process-local for v0.1. A queue entry has `queueId`, user, client, Elo, enqueue time and current range.
- Base range is ±100 Elo and widens by +50 every 10 seconds, capped at ±1000.
- Pairing is atomic: each queued user can be committed to at most one room; a cancel that loses the commit race returns `MATCH_ALREADY_COMMITTED` and never reports successful cancellation.
- Pairing creates a private `RANKED` room with both players and retains the active-game lock through the match lifecycle.
- Ranked Elo uses `initialElo=1000`, `K=32`, `minimumElo=0`, expected-score formula and rounds to the nearest integer.
- Elo is changed only for finalized Ranked results with a winner. Unranked, rematch, Guest, AI, Offline, ABORTED and SERVER_INTERRUPTION do not change Elo.
- Durable result writes are idempotent by `matchId`: one result row and one transaction update per ranked match.
- Queue events are `QUEUE_JOINED`, `QUEUE_RANGE_UPDATED`, `MATCH_FOUND`, `QUEUE_CANCELLED` and carry a versioned snapshot.

## 3. Implementation order

1. Add shared matchmaking/rating schemas and extend room/match metadata with `RANKED` mode.
2. Add `RoomManager.createRanked`, in-memory `MatchmakingManager`, queue SSE and HTTP join/status/cancel routes.
3. Add pure `RatingService` calculation plus Prisma ranked-result idempotent transaction and match-route finalization hook.
4. Add Queue page, range timer, cancel race copy, Match Found cinematic and ranked result Elo card.
5. Add C16/C17 tests and two-account runtime smoke.
6. Run full gates and update this execution record only after pairing, cancel, Elo and persistence gates pass.

## 4. Acceptance gates

- Two accounts in compatible range receive exactly one Match Found and one Ranked room.
- Range visibly widens while waiting; queue status remains authoritative.
- Cancel before pairing removes the queue; cancel after commit returns `MATCH_ALREADY_COMMITTED` and does not undo the room.
- Active-game lock prevents a queued/paired account from entering a second match.
- Elo formula and eligibility are deterministic; server never changes Elo for interruption/unranked outcomes.
- Repeating ranked finalization with the same `matchId` does not apply Elo twice.
- Match Found shows both names/Elo and navigates to the authoritative game room; ranked result shows Elo delta.
- Guest quick action shows the explicit Unranked limitation.
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

- **Contracts:** `RANKED` room/match mode, queue snapshots/events, Match Found payload and nullable ranked rating result are shared through `@ottv2/contracts`.
- **Queue:** `MatchmakingManager` implements in-memory v0.1 queue, ±100 base range, +50/10s widening capped at ±1000, atomic pair commit, queue SSE, duplicate/active-lock protection and cancel race semantics.
- **Ranked rooms:** paired users receive a private `RANKED` room with both memberships and active-game locks before the client enters the Game Room.
- **Elo:** `RatingService` applies `initialElo=1000`, `K=32`, minimum 0 and winner/loser expected-score calculation. `RankedMatchResult` migration stores one idempotent result per `matchId`; user stats update in one PostgreSQL transaction. Unranked/interrupted outcomes are excluded.
- **Frontend:** `/queue` renders rating, expanding search range, elapsed time, cancel action and 500–800ms Match Found cinematic. Home Quick Match routes authenticated users to Ranked and explicitly explains the Guest Unranked limitation. Ranked Game Room/result displays mode and Elo delta.
- **Automated verification:** root `35/35`, server `27/27`, web `14/14`; workspace typecheck, lint and build pass; Prisma reports 3 migrations up to date.
- **Runtime smoke:** two real PostgreSQL-backed accounts joined Ranked queue, received one `MATCHED` queue SSE and one private Ranked room, completed Ready → Countdown → Playing, surrendered, and received rating `-16/+16` with persisted stats. A third account cancelled before pairing successfully.
- **W6 gate:** PASS for Ranked pairing/range/cancel race, active-lock protection, Match Found UI wiring, Elo formula/eligibility and idempotent persistence path. Local ports remain frontend `3000`, API `3001`.
