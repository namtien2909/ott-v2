# 02_ARCHITECTURE.md

# System Architecture — OTTv2 Multiplayer v0.1

> **Status:** READY / FROZEN FOR v0.1 IMPLEMENTATION  
> **Architecture style:** Modular Monolith + realtime adapter + managed PostgreSQL  
> **Primary authority:** Application Backend / Game Server  
> **Parent requirements:** `01_PROJECT_SPEC.md`, `SRS.md`

---

# 0. ARCHITECTURE RULES

The architecture MUST preserve these invariants:

```text
Client ≠ Authority
Realtime Transport ≠ Game Rules
Session ≠ Room
Room ≠ Match
Game Engine ≠ WebSocket/PlayHTML
Canonical State ≠ Presentation State
Live Gameplay ≠ PostgreSQL dependency per move
Presence ≠ Durable Profile
```

Architecture changes after freeze require explicit impact analysis across SRS, Network Spec, Test Plan and Team Tasks.

---

# 1. DESIGN GOALS

1. Keep the system understandable for a 3-person student team.
2. Make networking behavior explicit and testable.
3. Preserve server authority for all game-critical decisions.
4. Use PlayHTML visibly for realtime multiplayer/presence/shared-state integration without storing private account data in PlayHTML identity.
5. Keep PostgreSQL out of the live move-processing path.
6. Support multiple rooms and spectators on one authoritative v0.1 server instance.
7. Make concurrency races deterministic.
8. Provide clear failure boundaries and benchmark hooks.

---

# 2. SYSTEM CONTEXT

```text
┌──────────────────────────────────────────────┐
│                 Web Client                   │
│ React/DOM UI • Local State • IndexedDB       │
│ PlayHTML Client • HTTP Client • Game View    │
└───────────────┬──────────────────────────────┘
                │
      HTTP/API  │  Realtime semantic channel
                │
┌───────────────▼──────────────────────────────┐
│     Application Backend / Game Authority     │
│              Modular Monolith                │
│                                              │
│ Auth • Session • Matchmaking • Room          │
│ Game Engine • Timer • Sync • Social          │
│ History • Rating • Persistence • Metrics     │
└───────────────┬──────────────────────────────┘
                │
                ▼
        ┌─────────────────┐
        │   PostgreSQL    │
        │ Prisma / Pool   │
        └─────────────────┘

Realtime integration:
Web Client ↔ PlayHTML-compatible realtime host/adapter ↔ application authority
```

The application backend remains authoritative even when PlayHTML is used to distribute presence/shared state or realtime events.

---

# 3. DEPLOYMENT TOPOLOGY

## 3.1 v0.1 baseline

- Frontend: static web deployment.
- Application backend: one authoritative Node.js/TypeScript service.
- Database: managed PostgreSQL, provider-agnostic.
- PlayHTML: configured for project room/realtime usage; custom compatible host is preferred when practical for control/teaching value.

## 3.2 Logical single-backend rule

There is one **application backend authority** in v0.1.

If the PlayHTML-compatible realtime host requires a distinct runtime because of library/platform constraints, it is treated as a transport/integration adapter, not a second business-logic service. It MUST NOT independently own:

- account truth;
- room authorization;
- game rules;
- Elo;
- match result;
- friend/block rules;
- durable private profile data.

## 3.3 No v0.1 distributed server cluster

No Redis, shared distributed lock service, multi-instance matchmaking or autoscaling contract is required for v0.1.

Future multi-instance scaling requires a new architecture decision.

---

# 4. CLIENT ARCHITECTURE

```text
Presentation / Routes
        ↓
Application Controllers
        ↓
Client Stores
        ↓
Network Adapter
   ├─ HTTP API
   └─ Realtime / PlayHTML Adapter
```

## 4.1 Presentation

Owns:

- Vietnamese UI;
- Login/Register/Home/Profile/History/Friends/Game Room;
- board rendering;
- local hover/selection;
- animations;
- loading/error states;
- theme;
- responsive behavior.

Presentation MUST NOT:

- calculate authoritative captures/winner;
- change clock authority;
- apply unconfirmed moves as final state;
- expose private session/recovery secrets.

## 4.2 Client application layer

Owns:

- route/use-case orchestration;
- local input validation for UX;
- join/create/search flow;
- matchmaking state;
- ready/countdown presentation;
- rematch request flow;
- local AI/Offline mode coordination.

## 4.3 Client stores

Recommended logical stores:

- `authStore`;
- `profileStore`;
- `roomStore`;
- `matchStore`;
- `friendsStore`;
- `presenceStore`;
- `settingsStore`.

Server-derived state must preserve server sequence/stateVersion metadata.

## 4.4 Local storage

Local browser storage is permitted for:

- Guest identity;
- Guest History/Guest Score;
- Guest import marker;
- theme cache;
- browser tab/game lock metadata where required.

Authenticated session secret SHOULD be held by secure HttpOnly cookie, not exposed to normal JS storage.

---

# 5. BACKEND MODULE MAP

```text
HTTP Gateway
Realtime Gateway / Adapter
       │
       ▼
Auth / Session
       │
       ├── Profile / Settings
       ├── Friends / Blocks / Presence
       ├── Matchmaking
       └── Room Manager
                │
                ▼
          Match Coordinator
                │
        ┌───────┼────────┐
        ▼       ▼        ▼
    Game Engine Timer   Sync Engine
        │                 │
        ▼                 ▼
 Canonical State      Snapshots/Events
        │
        ▼
 Result / Rating
        │
        ▼
 Persistence Port → Repository → PostgreSQL
```

---

# 6. HTTP GATEWAY

HTTP/control plane handles request/response operations such as:

- Register/Login/Logout;
- Forgot Password/Recovery;
- Profile/Settings;
- History pagination;
- Friends search and request operations;
- Block/unblock if exposed;
- room create/search/join authorization where implemented as HTTP;
- matchmaking join/cancel control where implemented as HTTP;
- health checks.

HTTP layer MUST delegate business decisions to application services.

---

# 7. REALTIME / PLAYHTML ADAPTER

Responsibilities:

- room-scoped realtime connection;
- presence propagation;
- room list update subscription where appropriate;
- match event/state distribution;
- spectator state delivery;
- connection loss detection signals;
- mapping between PlayHTML/shared-state/event mechanisms and project semantic protocol.

The adapter MUST NOT define game rules.

PlayHTML `PlayerIdentity` is treated only as browser/public realtime identity metadata when used. Authenticated `userId` and private profile/session data remain application-owned.

---

# 8. AUTH SERVICE

Responsibilities:

- username normalization/uniqueness;
- password verification;
- password hashing through standard library;
- registration;
- Recovery Code verifier;
- login throttling;
- recovery throttling;
- password change;
- session issuance/revocation.

Auth Service MUST NOT own live game state.

---

# 9. SESSION MANAGER

Session Manager owns:

- authenticated session validity;
- Guest runtime identity context;
- session revoke state;
- connection mapping;
- reconnect association;
- current connection presence;
- active-game account lock integration.

Multiple authenticated sessions per account are permitted.

One account may hold only one active-game lock.

---

# 10. ACTIVE GAME LOCK SERVICE

## 10.1 Invariant

```text
userId → at most one activeMatchId
```

Acquisition is atomic in the authoritative server runtime.

## 10.2 Same-browser lock

Client uses browser-level exclusive locking + cross-tab notification as a UX/defense layer.

Server remains final authority.

## 10.3 Cross-browser/device

A best-effort device-session signal MAY supplement enforcement, but MUST NOT be treated as cryptographically reliable physical-device identity.

IP address is not a device ID.

## 10.4 Lifecycle

Acquire:

- matchmaking match commit; or
- successful player join/start path requiring gameplay reservation.

Hold through:

- PLAYING;
- disconnect grace;
- reconnect.

Release on:

- finalized result;
- surrender;
- timeout;
- disconnect-forfeit;
- aborted both-disconnect;
- server-interruption cleanup.

---

# 11. MATCHMAKING SERVICE

v0.1 matchmaking queue is in memory.

Queue entry contains conceptually:

- user/player identity;
- Ranked/Unranked mode;
- Elo where applicable;
- enqueue time;
- current acceptable rating range;
- session/connection reference.

Matching rule:

```text
base Elo range
+
range widens as wait time increases
```

No recent-form weighting in v0.1.

Atomic pair commit MUST prevent:

- one player paired twice;
- cancel after commit rolling back an already-created match incorrectly;
- account with existing active-game lock entering a second match.

---

# 12. ROOM MANAGER

Room runtime state includes:

- roomId;
- name;
- visibility Public/Private;
- password verifier if Private;
- hostUserId/hostPlayerId;
- player slots;
- spectator policy/capacity;
- time control;
- Unranked mode for custom rooms;
- room state;
- ready state;
- invitation state references;
- match reference when playing.

## 12.1 Room lifecycle

```text
CREATED/WAITING
   ↓
READY_CHECK
   ↓
COUNTDOWN
   ↓
PLAYING
   ↓
ENDED/ABORTED
   ↓
WAITING on accepted rematch
```

## 12.2 Host migration

If Host leaves WAITING and the other player remains:

```text
remainingPlayer → new Host
```

Migration is server-authoritative and atomic.

## 12.3 Room list

Public WAITING rooms are published to browse list.

Transitions that remove/add browse visibility:

- create Public room → add;
- fill/start → remove;
- P2 leaves before start → re-add;
- room becomes empty/destroyed → remove.

---

# 13. INVITATION SERVICE

Targeted friend invitation contains server-side identity for:

- room;
- target user;
- expiry = 60 seconds;
- single-use state.

For Private room, invitation proves access without exposing room password.

Join MUST revalidate:

- token validity;
- target user;
- room exists;
- slot exists;
- block/friend eligibility if required;
- active-game lock.

---

# 14. GAME ENGINE

Game Engine is a pure/domain-oriented authoritative rules component.

Inputs:

- validated `PIECE_MOVE` application command;
- player identity/side;
- current canonical state;
- authoritative turn state.

Outputs:

- accepted/rejected result;
- next canonical state;
- capture information;
- win/result if any;
- domain events.

Game Engine MUST NOT directly call:

- WebSocket/PlayHTML;
- HTTP;
- Prisma;
- external storage.

---

# 15. CANONICAL MATCH STATE

Conceptual state:

```text
matchId
roomId?
mode: RANKED | UNRANKED | AI | OFFLINE
status
bluePlayer
redPlayer
board[81]
pieceCounts
currentTurn
blueClock
redClock
clockAnchorTimestamp
sequence
stateVersion
winner?
resultReason?
```

For Online server-authoritative matches, state is held in runtime memory.

---

# 16. TIMER SERVICE

Timer Service owns authoritative clock semantics.

It does not require a high-frequency game loop to mutate DB or broadcast every millisecond.

Recommended representation:

```text
remainingBlueMs
remainingRedMs
activeSide
activeSinceServerTime
pausedReason?
```

Clients render smooth countdown locally from server timestamp and periodically resynchronize.

On accepted move:

1. calculate elapsed server time for current player;
2. commit remaining time;
3. apply move;
4. evaluate result;
5. if continuing, switch active side and anchor timestamp;
6. broadcast authoritative transition.

Disconnect pauses both clocks.

---

# 17. CONCURRENCY / ORDERING

All game-critical commands pass:

```text
Decode
→ Session/Auth
→ Room/Match membership
→ Sequence/idempotency
→ Turn/command validation
→ serialized match operation
→ Game Engine
→ canonical commit
→ event/snapshot output
```

A match uses one logical serialized mutation lane/queue/mutex to avoid concurrent canonical mutation.

Concurrent moves cannot both commit for the same turn.

---

# 18. SYNC ENGINE

Responsibilities:

- initial full snapshot;
- state delta/event emission;
- sequence/stateVersion assignment;
- stale/gap detection support;
- replay when implementation retains sufficient event window;
- full snapshot fallback;
- state/hash verification where implemented;
- spectator synchronization.

Client local hover/selection is not part of synchronized state.

---

# 19. SNAPSHOT VS DELTA MODEL

Snapshot contains enough information to reconstruct canonical client replica.

Delta/Event contains only the accepted transition and necessary updated metadata.

Benchmark MUST compare:

- bytes transferred;
- messages;
- latency/processing impact;
- recovery cost.

No arbitrary hard byte threshold is treated as success before measurement.

---

# 20. RECONNECT SERVICE

Player disconnect flow:

```text
transport loss
  ↓
mark RECONNECTING
  ↓
pause both clocks
  ↓
start 30s grace
  ↓
reconnect session/match proof?
  ├─ yes → restore membership → resync → resume clock
  └─ no  → forfeit/ABORTED based on opponent state
```

Active-game lock remains held during grace.

Spectators are removed immediately and rejoin as new spectators.

---

# 21. RATING SERVICE

Constants:

```text
initialElo = 1000
K = 32
minimumElo = 0
```

Rating Service accepts only finalized Ranked Quick Match outcomes that are eligible for Elo.

Not eligible:

- custom rooms;
- rematches;
- Guest;
- AI;
- Offline;
- ABORTED;
- SERVER_INTERRUPTION.

---

# 22. PROFILE / HISTORY SERVICE

Profile queries combine:

- durable `profiles`;
- durable `user_stats`;
- selected latest match summaries.

`user_stats` prevents scanning all historical matches for common profile counters.

History pagination = 20 records/request page baseline.

---

# 23. FRIEND / BLOCK SERVICE

## 23.1 Friendship storage

Use canonical pair ordering:

```text
user_low_id = min(A,B)
user_high_id = max(A,B)
UNIQUE(user_low_id, user_high_id)
```

This prevents duplicate A-B/B-A friendship rows.

## 23.2 Request race

Simultaneous reciprocal pending requests are resolved transactionally to one friendship.

## 23.3 Block

Block transaction removes friendship, cancels pending requests and prevents future invite/request operations.

---

# 24. PRESENCE SERVICE

Runtime states:

- `OFFLINE`;
- `ONLINE`;
- `IN_GAME`.

Presence is ephemeral realtime data.

PostgreSQL may record `lastSeenAt`, but live presence is not queried from DB on every update.

Presence fan-out targets relevant friends/room members.

---

# 25. PERSISTENCE ARCHITECTURE

```text
Domain/Application
      ↓
Persistence Port
      ↓
Repository
      ↓
Prisma
      ↓
PostgreSQL Connection Pool
```

Game Engine depends on persistence abstractions only at result/application boundary, never concrete Prisma in game rules.

---

# 26. DATA MODEL BASELINE

## 26.1 users

Conceptual fields:

- id;
- normalized username;
- display username form if needed;
- passwordHash;
- fullName;
- recoveryCodeHash;
- createdAt/updatedAt.

## 26.2 profiles

- userId PK/FK;
- displayName;
- avatarId;
- theme.

## 26.3 user_stats

- userId;
- elo;
- rankedMatches;
- rankedWins;
- rankedLosses.

## 26.4 sessions

- id;
- userId;
- tokenHash/session identifier;
- createdAt;
- expiresAt;
- lastSeenAt;
- revokedAt.

## 26.5 friendships

- userLowId;
- userHighId;
- createdAt;
- unique pair.

## 26.6 friend_requests

- id;
- senderId;
- receiverId;
- status;
- createdAt;
- rejected/cooldown metadata as needed.

## 26.7 user_blocks

- blockerId;
- blockedId;
- createdAt;
- unique directional pair.

## 26.8 matches

- id;
- mode;
- ranked;
- winnerUserId nullable;
- resultReason;
- timerSeconds;
- startedAt;
- endedAt;
- duration;
- persistence/idempotency metadata.

## 26.9 match_players

- matchId;
- userId nullable for imported/local contexts as designed;
- side;
- ratingBefore;
- ratingAfter;
- ratingDelta;
- result.

---

# 27. DATABASE TRANSACTIONS

Ranked Match End durable transaction SHOULD include:

```text
INSERT match (idempotent by matchId)
INSERT match_players
UPDATE P1 user_stats / Elo
UPDATE P2 user_stats / Elo
COMMIT
```

Any partial failure rolls back the durable transaction.

Retry of same `matchId` MUST NOT apply Elo twice.

---

# 28. RETRY QUEUE

v0.1 may use bounded in-memory retry queue for failed persistence events.

Properties:

- bounded capacity;
- retry count/backoff;
- idempotent payload;
- metrics/logging for pending/failure;
- documented limitation: process restart may lose unpersisted queued items.

No Redis/BullMQ required in v0.1.

---

# 29. DATABASE FAILURE BOUNDARY

If DB is unavailable:

- Login/Register/Profile/Friends/History can degrade/unavailable;
- already-running live matches continue;
- Match End result can finalize in memory/client even if persistence becomes pending;
- DB failure alone MUST NOT pause or terminate a healthy live match.

---

# 30. SERVER RESTART BOUNDARY

v0.1 does not persist complete live match state for restart recovery.

On restart:

- in-memory live matches are lost;
- clients observe/recover as `SERVER_INTERRUPTION`;
- no Elo is awarded/removed for interruption;
- stale active-game locks are reset/expired;
- persisted account/history already committed remains.

---

# 31. HEALTH AND DRAINING

`/health` or equivalent SHOULD report separately:

- application process alive;
- DB reachable/degraded;
- realtime subsystem ready/degraded.

DB degraded must not be represented as “all live games must terminate.”

Graceful shutdown SHOULD:

1. stop accepting new matchmaking/new matches;
2. mark service draining;
3. finish/flush safe work where possible;
4. close connections/resources;
5. if process termination interrupts matches, emit/record interruption semantics where feasible.

---

# 32. OBSERVABILITY

Collect at minimum:

- active connections;
- active rooms;
- active matches;
- spectators;
- matchmaking queue depth/time;
- move processing latency;
- reconnect success/failure;
- resync count;
- duplicate/stale command count;
- HTTP latency;
- realtime latency/RTT where measurable;
- CPU/RAM;
- DB pool usage/latency/errors;
- persistence retry queue depth;
- error rate.

Do not build an unnecessary external monitoring platform for v0.1.

---

# 33. PERFORMANCE ARCHITECTURE

Connection pool size is NOT hard-coded in requirements. It is tuned to actual deployment via benchmark.

Load harness must support:

- login/profile workload;
- matchmaking workload;
- many rooms;
- spectator fan-out;
- match-end DB write burst;
- network degradation;
- snapshot vs delta comparison.

---

# 34. SECURITY BOUNDARIES

Trusted:

- server-side authenticated session;
- server runtime canonical state;
- server-generated room/invite/match identifiers;
- server-computed Elo/result.

Untrusted:

- client playerId/userId claims;
- client side/turn claims;
- client remaining clock;
- client capture/winner claims;
- client room membership claim;
- client device fingerprint claim.

Use standard password/hash/token libraries.

---

# 35. AI / OFFLINE ARCHITECTURE

AI and Offline reuse a local-compatible rule engine module when practical.

They are separate from Online server-authoritative match runtime:

```text
Shared Rules Package
   ├─ Server Game Engine adapter (authoritative Online)
   └─ Client Local adapter (AI / Offline)
```

The client-side rule engine MUST NOT be trusted as authority for Online matches.

---

# 36. TEAM-BOUNDARY ARCHITECTURE

- Person A: Client/UI/game presentation/local AI/Offline.
- Person B: Backend/network/auth/data/game authority.
- Person C: Integration/contracts/tests/load/benchmark.

Shared ownership:

- semantic protocol;
- SRS traceability;
- game-rule test vectors;
- deployment/demo readiness.

---

# 37. ARCHITECTURE DECISIONS

| ID | Decision | Status |
|---|---|---|
| ADR-001 | Modular Monolith application backend | LOCKED |
| ADR-002 | PostgreSQL durable data, not per-move live state | LOCKED |
| ADR-003 | Prisma ORM + migrations | LOCKED |
| ADR-004 | One authoritative application backend instance v0.1 | LOCKED |
| ADR-005 | No Redis/message broker v0.1 | LOCKED |
| ADR-006 | PlayHTML realtime integration, app backend remains authority | LOCKED |
| ADR-007 | Turn-based only game mode | LOCKED |
| ADR-008 | In-memory matchmaking and active match state | LOCKED |
| ADR-009 | 30s player reconnect grace, pause both clocks | LOCKED |
| ADR-010 | In-memory bounded persistence retry queue | LOCKED |
| ADR-011 | Server restart may abort live matches, no Elo change | LOCKED |
| ADR-012 | Strict account/same-browser gameplay lock; cross-browser best-effort | LOCKED |

---

# 38. FINAL ARCHITECTURE STATUS

```text
CRITICAL ARCHITECTURE TBD       = 0
LIVE STATE AUTHORITY            = SERVER RUNTIME
DURABLE DATA                    = POSTGRESQL
REALTIME INTEGRATION            = PLAYHTML ADAPTER
MULTI-INSTANCE                  = OUT OF v0.1
DOCUMENT STATUS                 = READY / FROZEN v0.1
```
