# 05_TEAM_TASKS.md

# Team Work Breakdown & Execution Plan — OTTv2 Multiplayer v0.1

> **Status:** READY / FROZEN TEAM BASELINE v0.1  
> **Team size for Bài 2:** 3 students  
> **Authority:** Who owns what, integration order, Definition of Done and handoff rules  
> **Parents:** `01_PROJECT_SPEC.md` → `SRS.md` → `02_ARCHITECTURE.md` → `03_NETWORK_SPEC.md` → `04_TEST_PLAN.md`

---

# 0. TEAM PRINCIPLES

1. No member independently changes a locked shared contract.
2. Shared protocol/game-rule changes require cross-file update.
3. Network correctness has priority over optional UI polish.
4. Each task is complete only with test/evidence appropriate to its layer.
5. The team integrates continuously; no “three isolated projects merged on final day.”
6. Person ownership is primary responsibility, not exclusive knowledge.

---

# 1. ROLE MAP

## Person A — Client / Game Presentation / UX

Primary ownership:

- frontend shell/routes;
- Login/Register/Home UI;
- Game Room rendering;
- 9×9 board controls;
- BLUE/RED orientation;
- local selection/highlights;
- countdown/clock presentation;
- Result UI;
- Profile/History/Friends UI;
- theme/responsive behavior;
- client same-browser game lock UX;
- Guest IndexedDB;
- Vs AI;
- Offline mode.

Must consume shared protocol/types; must not implement separate authoritative Online rules.

## Person B — Backend / Network / Data

Primary ownership:

- HTTP API;
- Auth/session/recovery;
- PostgreSQL/Prisma/migrations;
- Profile/history services;
- Friends/block/invite services;
- matchmaking;
- Room Manager;
- active-game lock;
- authoritative Game Engine;
- Timer Service;
- realtime/PlayHTML integration adapter;
- sync/reconnect;
- Elo/result persistence;
- health/failure handling.

## Person C — Integration / QA / Performance

Primary ownership:

- shared schemas/types validation;
- automated test harness;
- contract tests;
- E2E multi-client tests;
- concurrency/race tests;
- network degradation;
- load generator;
- spectator fan-out test;
- DB failure/restart tests;
- snapshot vs delta benchmark;
- metrics/charts/report evidence;
- deployment verification;
- cross-document traceability/demo support.

---

# 2. SHARED OWNERSHIP

All three must jointly review:

- canonical game setup/rules;
- semantic message names/fields;
- Room/Match lifecycle;
- Match Result reasons;
- reconnect behavior;
- SRS acceptance changes;
- final demo flow.

Protocol changes require Person A + Person B + Person C acknowledgment because they affect client, server and tests simultaneously.

---

# 3. REPOSITORY BASELINE

Recommended top-level structure:

```text
/apps
  /web
  /server
/packages
  /contracts
  /game-rules
  /test-utils
/prisma
/tests
  /contract
  /integration
  /e2e
  /load
/docs
```

Equivalent structure is allowed if module boundaries remain explicit.

Shared packages SHOULD contain:

- protocol schemas/types;
- game enums/result reasons;
- deterministic rule helpers safe to share;
- test fixtures.

Online client MUST not become authoritative merely because rule types are shared.

---

# 4. PHASE 0 — PROJECT BOOTSTRAP

## Person A

- frontend framework/app shell;
- Vietnamese routing placeholders;
- theme tokens BLUE/RED/AI-data visual style;
- shared UI loading/toast/modal primitives.

## Person B

- Node.js/TypeScript server shell;
- config/env validation;
- Prisma initialization;
- PostgreSQL connection;
- migration workflow;
- HTTP/realtime adapter skeleton.

## Person C

- test runner structure;
- CI test command baseline;
- multi-client test harness skeleton;
- load-test tool selection and reproducibility structure.

### Phase 0 DoD

- repo starts locally;
- frontend ↔ backend health request works;
- database migration from empty works;
- shared contracts package imported by client/server/test;
- CI can run at least one unit + one integration test.

---

# 5. PHASE 1 — GAME RULE ENGINE

## Person B lead

Implement server-authoritative pure Game Engine:

- board coordinates;
- canonical setup;
- movement;
- capture matrix;
- extinction;
- BLUE→i9 / RED→a1 goal;
- turn switching;
- result reasons.

## Person A

Implement board renderer against fixture state only:

- 9×9;
- coordinate labels;
- BLUE view;
- RED 180° visual orientation;
- local selection/legal destination rendering.

## Person C

Create exhaustive rule tests:

- setup counts;
- boundaries;
- captures;
- goals;
- rejected moves;
- turn progression.

### Phase 1 DoD

Critical game-rule tests pass before realtime networking is attached.

---

# 6. PHASE 2 — AUTH / SESSION / PROFILE DATA

## Person B

Implement:

- users/profiles/user_stats/sessions schema;
- case-insensitive username uniqueness;
- registration;
- password hashing;
- one-time Recovery Code;
- login/logout;
- remember session;
- recovery/password change;
- session revoke;
- profile read/update;
- theme persistence.

## Person A

Implement:

- Login;
- Register;
- Recovery Code one-time screen;
- Forgot Password;
- Profile basic UI;
- Account Settings;
- loading/error states.

## Person C

Test:

- validation boundaries;
- duplicate usernames;
- session revocation;
- recovery throttling;
- private/public profile separation.

### Phase 2 DoD

Registered user can register, save Recovery Code, login, update profile, logout and recover password through defined flow.

---

# 7. PHASE 3 — ROOM / HOMEPAGE

## Person B

Implement:

- Room ID generator;
- friendly default room names;
- Public/Private room config;
- password verifier;
- spectator config;
- Room Manager;
- room browse publication;
- exact ID search;
- Host migration;
- room cleanup;
- join authorization/idempotency.

## Person A

Implement Homepage:

- title/search layout;
- 3 quick buttons;
- 4×2 room grid + internal scroll;
- Create Room modal;
- room card;
- search result card;
- 4s toast;
- Empty State;
- Profile/Friends entry.

## Person C

Test:

- browse visibility;
- Private exclusion;
- host leave migration;
- P2 leave;
- duplicate Create/Join;
- room list realtime changes;
- room isolation.

---

# 8. PHASE 4 — REALTIME MATCH CORE

## Person B

Implement:

- semantic protocol envelope;
- realtime room/match adapter;
- side assignment;
- Ready state;
- 3s countdown;
- fast-ready;
- match state store;
- serialized PIECE_MOVE pipeline;
- Timer Service;
- accepted move events;
- snapshots/deltas;
- Match End.

## Person A

Connect Game Room to realtime state:

- players panels;
- clock display;
- own ping indicator;
- board interactions;
- accepted move animations;
- Ready/countdown/Space;
- surrender;
- result view.

## Person C

Test:

- two clients converge;
- BLUE first;
- move race;
- duplicate move;
- stale version;
- no opponent selection leakage;
- clock authority;
- all result reasons.

### Phase 4 DoD

Two remote browser clients can complete one correct Unranked Online match end-to-end.

---

# 9. PHASE 5 — RECONNECT / RESYNC / DEVICE LOCK

## Person B

Implement:

- disconnect detection;
- 30s grace;
- pause both clocks;
- reconnect membership restoration;
- replay/snapshot resync;
- account active-game lock;
- stale lock cleanup;
- server interruption semantics.

## Person A

Implement:

- reconnect overlay/countdown;
- browser refresh recovery UX;
- same-browser exclusive game lock;
- cross-tab notification;
- Browser Back warning;
- second-tab rejection popup.

## Person C

Test:

- <30s reconnect;
- >30s forfeit;
- both disconnect;
- refresh/crash;
- same-account second session race;
- same-browser different-account attempt;
- server restart cleanup.

---

# 10. PHASE 6 — MATCHMAKING / RATING

## Person B

Implement:

- Ranked queue;
- Guest Unranked queue;
- Elo-range widening;
- queue cancel;
- atomic match commit;
- active-game lock integration;
- Elo K=32/initial1000/min0;
- Ranked result transaction.

## Person A

Implement:

- Quick Match waiting UI;
- cancel;
- Guest Unranked notice;
- Ranked result Elo before/after/delta.

## Person C

Test:

- duplicate queue;
- cancel/commit race;
- one player never paired twice;
- rating formula;
- no Elo for custom/rematch/abort.

---

# 11. PHASE 7 — PERSISTENCE / HISTORY

## Person B

Implement:

- matches/match_players;
- Match End transaction;
- unique matchId idempotency;
- user_stats update;
- immediate persist attempt;
- bounded in-memory retry queue;
- history pagination/filter/detail.

## Person A

Implement History UI:

- summary stats;
- filters;
- Match Cards;
- Load More/page;
- detail modal/page;
- result reasons.

## Person C

Test:

- partial transaction rollback;
- duplicate persistence;
- DB outage during match;
- retry success;
- burst match endings;
- 20-item pagination.

---

# 12. PHASE 8 — FRIENDS / PRESENCE / BLOCK / INVITE

## Person B

Implement:

- friendships canonical pair;
- requests;
- reciprocal race resolution;
- limits/cooldown/rate limiting;
- block;
- presence friend fan-out;
- 60s targeted room invite token;
- Private invite access.

## Person A

Implement:

- Friends page;
- Incoming/Sent;
- search results;
- friend/remove/block actions;
- presence badges;
- Homepage friends preview;
- room invite popup.

## Person C

Test:

- 200/50/50 limits;
- reciprocal request race;
- block effects;
- presence privacy;
- invite target/expiry/single-use;
- stale full room invite.

---

# 13. PHASE 9 — GUEST / AI / OFFLINE

## Person A lead

Implement:

- Guest display identity;
- IndexedDB Guest History/Guest Score;
- one-time import prompt;
- Normal AI;
- Offline 2-human local mode.

## Person B

Implement:

- Guest import API validation/idempotency;
- account-side imported history representation;
- ensure imported Guest Score does not affect Elo.

## Person C

Test:

- import duplicate;
- decline one-time behavior;
- Guest only Unranked Online;
- AI no Elo;
- Offline no server account stats.

---

# 14. PHASE 10 — SPECTATOR

## Person B

- spectator authorization;
- capacity;
- read-only membership;
- snapshot/event fan-out;
- Private password/invite access;
- immediate removal on disconnect.

## Person A

- `Xem trận` flow;
- canonical spectator orientation;
- clock display;
- spectator count;
- read-only Game Room controls.

## Person C

- capacity boundary tests;
- spectator mutation abuse;
- 1/10/50/100 fan-out benchmark.

---

# 15. PHASE 11 — PERFORMANCE / FAILURE

## Person C lead

Execute and document:

- Auth/API load;
- matchmaking load;
- many rooms;
- spectator fan-out;
- Match End DB burst;
- latency 100/300/500ms;
- packet/message loss 5/10%;
- disconnect/reconnect;
- DB outage during match;
- server restart;
- Snapshot vs Delta;
- stress to saturation + recovery.

## Person B

Provide metrics hooks and tune bottlenecks without violating architecture.

## Person A

Support client-side measurement/visual verification and fix rendering issues discovered under load.

---

# 16. PHASE 12 — DEPLOYMENT / DEMO

## Person B

- production env config;
- managed PostgreSQL;
- migrations;
- backend deployment;
- health endpoint;
- realtime host/adapter configuration.

## Person A

- static frontend deployment;
- production API/realtime config;
- responsive sanity checks.

## Person C

- smoke test public URL;
- run selected benchmark on deployment-like environment;
- verify README deploy link;
- prepare evidence tables/charts;
- rehearse demo failure/reconnect scenario.

---

# 17. SHARED CONTRACT FILES — CHANGE CONTROL

Files/types considered shared contracts:

- protocol message schemas;
- game enums/piece types;
- board coordinates/setup constants;
- result reason enum;
- room state enum;
- presence enum;
- Elo constants;
- time-control enum.

Change process:

```text
Propose
→ identify SRS requirement
→ update contract
→ update server
→ update client
→ update tests
→ run affected suite
→ merge
```

No “temporary mismatch” may be merged to main without explicit feature flag/compatibility plan.

---

# 18. GIT WORKFLOW

Recommended:

- short-lived feature branches;
- PR/review for shared contracts and critical logic;
- main must stay buildable/testable;
- migrations committed with schema change;
- benchmark scripts/config committed;
- secrets never committed.

Commit/PR should reference task/requirement IDs when practical.

---

# 19. DEFINITION OF DONE — FEATURE

A feature is Done when applicable items are satisfied:

- requirement implemented;
- UI/server behavior matches SRS;
- shared contract updated;
- unit/integration tests added;
- error/loading states handled;
- no known cross-room/private-data leak;
- documentation changed if behavior changed;
- Person C can reproduce acceptance.

---

# 20. DEFINITION OF DONE — NETWORK FEATURE

Additionally requires:

- duplicate behavior defined;
- ordering/stale behavior defined;
- reconnect impact defined;
- authorization defined;
- rate-limit/abuse path considered;
- multi-client integration test;
- evidence/logs sufficient to debug.

---

# 21. DEFINITION OF DONE — DATABASE FEATURE

Additionally requires:

- migration;
- indexes/unique constraints;
- transaction boundary defined;
- idempotency where non-idempotent business event;
- failure behavior tested;
- live-game dependency rule preserved.

---

# 22. MERGE / HANDOFF CHECKLIST

Before handing work to another member:

- exact branch/commit;
- how to run;
- required env variables (names only, no secrets);
- migration command if applicable;
- known limitations;
- test command;
- affected requirement IDs;
- screenshots/logs only as supplemental evidence, not substitute for tests.

---

# 23. CRITICAL PATH

```text
Bootstrap
→ Game Rule Engine
→ Auth/Data foundation
→ Room
→ Realtime Match Core
→ Reconnect/Lock
→ Matchmaking/Rating
→ Persistence/History
→ Social
→ Guest/AI/Offline
→ Spectator
→ Load/Failure
→ Deploy/Demo
```

Parallel work is allowed, but shared contract dependencies must be respected.

---

# 24. SCOPE-CUT RULE

If schedule pressure occurs, cut in this order:

```text
visual polish
→ optional animation detail
→ secondary convenience UI
→ lower-priority social polish
```

Do NOT cut:

- authoritative Online match;
- room isolation;
- turn/timer correctness;
- reconnect;
- active-game lock;
- Ranked matchmaking correctness;
- match persistence idempotency;
- critical automated/network tests;
- benchmark evidence required for course value.

Friends/Spectator may receive reduced polish before core networking is weakened, but their locked v0.1 functional requirements remain target scope.

---

# 25. DEMO OWNERSHIP

## Person A demonstrates

- Vietnamese UI;
- Homepage/Create Room;
- board/game experience;
- Profile/History/Friends visible flows.

## Person B demonstrates

- server authority;
- Room/Match state;
- reconnect;
- database separation;
- API/realtime architecture.

## Person C demonstrates

- automated tests;
- latency/loss scenarios;
- concurrency race proof;
- load/benchmark charts;
- saturation statement.

All members must understand end-to-end flow.

---

# 26. PRIMARY DEMO SCENARIO

```text
1. Two registered users login
2. Show Homepage realtime room/friends state
3. Enter Ranked Quick Match
4. Match assigned BLUE/RED
5. Ready + countdown
6. Play accepted/rejected moves
7. Show server-authoritative clocks
8. Briefly disconnect one player
9. Reconnect + resync within 30s
10. Finish match by a valid win condition
11. Show Elo/history update
12. Open Profile/History
13. Show one spectator/custom-room or friend invite flow
14. Show automated/load benchmark evidence
```

A shorter backup demo should exist if network conditions are poor.

---

# 27. FINAL CONSISTENCY AUDIT CHECKLIST

Before implementation baseline is considered frozen:

```text
[PASS] Project scope reflects Account + Guest + Social + History
[PASS] Turn-based only; realtime cooldown removed
[PASS] a1/i9 empty at start
[PASS] BLUE→i9, RED→a1
[PASS] BLUE always first
[PASS] Host migration while WAITING
[PASS] Custom rooms Unranked
[PASS] Ranked only through registered Quick Match
[PASS] Elo 1000 / K32 / min0
[PASS] Recovery Code replaces security questions/email
[PASS] 30s reconnect pauses both clocks
[PASS] strict account/same-browser lock + best-effort cross-browser
[PASS] PostgreSQL outside per-move loop
[PASS] no hard capacity claim before benchmark
[PASS] load/degradation/failure plan exists
```

---

# 28. FINAL TEAM STATUS

```text
TEAM_SIZE                     = 3
ROLE_BOUNDARIES               = LOCKED
SHARED CONTRACT PROCESS       = LOCKED
PHASE PLAN                    = READY
TEST / BENCHMARK OWNERSHIP    = READY
DEMO OWNERSHIP                = READY
GAME-SPECIFIC TASKS           = RESOLVED
CRITICAL TASK TBD             = 0
DOCUMENT STATUS               = READY / FROZEN v0.1
```
