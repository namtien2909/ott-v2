# 04_TEST_PLAN.md

# Verification, Network, Load & Benchmark Plan — OTTv2 Multiplayer v0.1

> **Status:** READY / FROZEN TEST BASELINE v0.1  
> **Authority:** Requirement → implementation → execution → evidence → acceptance  
> **Parents:** `SRS.md`, `02_ARCHITECTURE.md`, `03_NETWORK_SPEC.md`

---

# 0. TEST PRINCIPLES

1. Critical behavior is not complete until executed evidence exists.
2. Client-only correctness is insufficient for server-authoritative requirements.
3. Race conditions MUST be tested repeatedly, not only once.
4. Network degradation MUST be injected outside the Game Engine.
5. Capacity MUST be measured, not declared in advance.
6. DB failure and server interruption are first-class test scenarios.
7. Load evidence must name environment/configuration.
8. Tests must preserve room isolation and private-data boundaries.

---

# 1. TEST LAYERS

Required:

- Unit Tests;
- Contract/Schema Tests;
- Repository/Database Integration Tests;
- Service Integration Tests;
- Realtime Integration Tests;
- End-to-End Tests;
- Concurrency/Race Tests;
- Security/Abuse Tests;
- Network Degradation Tests;
- Load Tests;
- Stress Tests;
- Benchmark Comparison;
- Deployment/Recovery Tests.

---

# 2. TEST ENVIRONMENTS

## 2.1 Local

Used for:

- fast unit/integration;
- deterministic game rules;
- database migration tests;
- mocked/fault-injected transport;
- multi-client simulation.

## 2.2 CI

Must run deterministic automated suites that do not require manual UI interaction.

## 2.3 Public/deployment-like

Used for:

- end-to-end public URL;
- network/load measurement;
- Render/memory constraint observation;
- managed PostgreSQL behavior;
- restart/failure checks where possible.

Every benchmark report records:

- date;
- commit/version;
- server plan/resources;
- DB provider/plan where relevant;
- test client machine/environment;
- workload configuration.

---

# 3. UNIT TEST — GAME RULES

Mandatory deterministic cases:

## 3.1 Board setup

- exactly 81 squares;
- `a1` empty;
- `i9` empty;
- BLUE exactly 9 pieces;
- RED exactly 9 pieces;
- each side exactly 3 R, 3 P, 3 S;
- RED setup is 180° rotation of BLUE.

## 3.2 Movement

For every board edge/corner/interior category:

- each legal one-step direction accepted;
- zero-step rejected;
- two-step rejected;
- out-of-bounds rejected;
- friendly occupied destination rejected;
- same-type enemy destination rejected.

## 3.3 Capture matrix

| Attacker | Defender | Expected |
|---|---|---|
| R | S | capture |
| S | P | capture |
| P | R | capture |
| R | R | reject/block |
| P | P | reject/block |
| S | S | reject/block |
| R | P | reject invalid capture/move according to rule model |
| P | S | reject invalid capture/move |
| S | R | reject invalid capture/move |

The source material does not explicitly define the losing-attacker case. The v0.1 SRS records a transparent **derived implementation rule**: a piece may enter an enemy-occupied square only when the attacker beats the defender; otherwise the move is rejected. Tests lock this derived interpretation so client/server cannot diverge, and the rule must be revisited first if the teacher later clarifies it.

## 3.4 Victory

- eliminate RED R → BLUE extinction win;
- eliminate RED P → BLUE extinction win;
- eliminate RED S → BLUE extinction win;
- symmetric RED cases;
- BLUE moves into `i9` → BLUE goal win;
- BLUE moves into `a1` → not goal win;
- RED moves into `a1` → RED goal win;
- RED moves into `i9` → not goal win.

## 3.5 Turn

- BLUE starts;
- accepted BLUE move → RED;
- rejected BLUE move → BLUE remains;
- RED command during BLUE turn rejected;
- stale duplicate accepted move not applied twice.

---

# 4. UNIT TEST — TIMER

Cases:

- BLUE starts with configured time;
- only active side decreases;
- accepted move commits elapsed time and switches clock;
- rejected move does not switch clock;
- zero remaining time finalizes timeout exactly once;
- disconnect pauses both;
- reconnect resumes correct active side;
- long client render delay does not change server authority;
- client clock value spoof has no effect.

Test each allowed configuration:

```text
30, 60, 300, 600, 1800, 3600 seconds
```

---

# 5. AUTHENTICATION TESTS

## 5.1 Registration

- valid Vietnamese full name;
- username 4 chars accepted;
- username 20 accepted;
- 3 rejected;
- 21 rejected;
- spaces rejected;
- illegal username chars rejected;
- case-insensitive duplicate (`Giang` vs `giang`) rejected;
- display name duplicates allowed;
- password <8 rejected;
- successful registration creates initial Elo 1000;
- Recovery Code returned exactly in registration success flow.

## 5.2 Login

- valid credentials;
- wrong password;
- unknown user without excessive information leakage;
- progressive throttle under repeated failures;
- multiple sessions for same account allowed outside gameplay.

## 5.3 Recovery

- valid username + code resets password;
- wrong code rejected;
- throttling under repeated wrong codes;
- code not returned by ordinary profile endpoint;
- successful recovery revokes old sessions.

## 5.4 Password change

- current session survives;
- all other sessions revoked.

---

# 6. GUEST TESTS

- Guest enters display name;
- duplicate Guest names permitted;
- Guest Ranked Quick Match redirected to Unranked semantics;
- Guest History stored locally;
- browser-data loss behavior documented;
- registration on same browser detects Guest data;
- import prompt one-time;
- decline does not reprompt;
- import accepts history/stats;
- imported account Elo remains 1000;
- same import batch submitted twice does not duplicate history.

---

# 7. ROOM TESTS

## 7.1 Create

- Public valid;
- Private valid;
- Public with password rejected/normalized to no password;
- Private password 1 accepted;
- 12 accepted;
- >12 rejected;
- blank name auto-generates friendly name;
- name >30 rejected;
- time controls only allowed set;
- spectator capacities only allowed set;
- Room ID 6 chars, excludes ambiguous chars;
- active Room IDs unique;
- custom room mode always Unranked;
- duplicate Create submission yields one room.

## 7.2 Browse/search

- browse includes Public WAITING;
- browse excludes Private;
- browse excludes PLAYING;
- realtime add/update/remove;
- search exact Public;
- search exact Private;
- room not found toast semantics;
- PLAYING spectator-enabled returns watch action;
- spectator-disabled/full prevents watch.

## 7.3 Membership

- second player join makes 2/2;
- third active player rejected;
- P2 leaves WAITING → Host remains, 1/2;
- Host leaves WAITING → P2 becomes Host;
- no players → room cleanup;
- leave PLAYING confirmation path → surrender;
- Host cannot change rules after PLAYING.

---

# 8. READY / COUNTDOWN TESTS

- one player Ready only → no countdown;
- both Ready → side assignment + 3s countdown;
- BLUE/RED assignment statistically/randomly server-driven, not Host-driven;
- BLUE always currentTurn on start;
- both press Space → countdown skips;
- only one Space → countdown continues;
- duplicate fast-ready has no duplicate start;
- reconnect during countdown yields deterministic state or safe restart of ready flow per implementation contract.

---

# 9. MATCHMAKING TESTS

## 9.1 Basic

- Registered Quick Match → Ranked queue;
- Guest Quick Match → Unranked queue;
- cancel works before pair commit;
- no hard timeout; queue remains until matched/cancelled.

## 9.2 Elo range

Use deterministic simulated wait clock:

- close rating matches early;
- outside initial range not matched early;
- widened range eventually allows eligible pair;
- recent form does not alter eligibility.

## 9.3 Race

Mandatory repeated races:

- two match workers/requests cannot pair same player twice;
- cancel concurrent with match commit;
- if commit wins, cancel returns committed failure/state;
- account already in active game cannot be committed again;
- reconnect/duplicate queue request does not duplicate queue entry.

---

# 10. ELO TESTS

- initial 1000;
- K=32 formula verified against test vectors;
- minimum rating clamp at 0;
- Ranked normal win/loss updates both;
- Unranked no Elo change;
- custom room no Elo;
- rematch no Elo;
- Guest no Elo;
- AI no Elo;
- Offline no Elo;
- ABORTED no Elo;
- SERVER_INTERRUPTION no Elo;
- duplicate Match End persistence does not apply rating twice.

---

# 11. GAME ROOM END-TO-END

Happy path:

```text
2 players join
→ Ready
→ countdown
→ BLUE move
→ RED observes accepted move
→ RED move
→ captures
→ clocks switch correctly
→ win condition
→ result
→ history/rating if applicable
```

Verify:

- opponent does not see local piece selection before commit;
- spectators see committed state;
- client board orientation differs for RED but semantic square stays canonical;
- spectator canonical orientation;
- result reason correct.

---

# 12. SURRENDER TESTS

- user cancels surrender confirmation → match continues;
- confirmed surrender ends once;
- duplicate surrender no duplicate result;
- logout during match requires surrender path;
- losing player lock releases after finalization.

---

# 13. REMATCH TESTS

- request shown to opponent;
- reject keeps ended state/room behavior;
- accept creates new match/reset;
- sides swap;
- previous RED becomes BLUE and first mover;
- immediate rematch is Unranked;
- active game locks remain consistent;
- old match persistence remains distinct from rematch.

---

# 14. SPECTATOR TESTS

- allowed before PLAYING if policy permits;
- allowed during PLAYING;
- capacities 1/2/5/10/50/100 boundary;
- one over capacity rejected;
- Private password required unless valid targeted invite token;
- receives snapshot and committed deltas;
- sees both clocks;
- gameplay command rejected;
- spectator disconnect frees slot immediately;
- reconnect counts as new spectator;
- no Player grace reservation.

---

# 15. FRIEND TESTS

## 15.1 Search

- username exact;
- username prefix;
- display name contains;
- duplicate display names distinguish via username;
- private fields absent;
- non-friend presence absent.

## 15.2 Request lifecycle

- send;
- incoming;
- sent;
- accept;
- reject;
- cancel;
- remove;
- pending limits 50/50;
- friend limit 200;
- rate-limit send/cancel spam;
- 24h resend cooldown after reject.

## 15.3 Reciprocal race

Run A→B and B→A concurrently many times.

Expected:

- exactly one friendship;
- no duplicate pair rows;
- no orphan conflicting pending requests.

---

# 16. BLOCK TESTS

- blocking friend removes friendship;
- pending both directions cancelled;
- blocked pair cannot send request;
- blocked pair cannot invite;
- presence hidden;
- unblock restores only ability to interact, not automatically friendship.

---

# 17. ROOM INVITE TESTS

- only ONLINE non-IN_GAME friend eligible;
- offline target unavailable;
- IN_GAME target unavailable;
- token target-bound;
- token room-bound;
- token expires at 60s;
- token single-use;
- Private invite joins without password;
- stale invite after room full rejected after server revalidation;
- password never exposed in invitation payload.

---

# 18. PROFILE TESTS

Self profile:

- private full name visible to self;
- Recovery Code plaintext absent;
- edit Display Name;
- edit Full Name;
- avatar restricted to built-in set;
- username immutable;
- theme persists.

Public profile:

- no full name;
- no private recovery/session data;
- friend count public;
- friend list not public;
- Ranked stats correct;
- Recent Form last 5 Ranked;
- presence only if viewer is Friend.

---

# 19. HISTORY TESTS

- Ranked stored;
- Unranked stored;
- Vs AI stored without Elo;
- Offline not stored in server account history;
- pagination 20;
- filters;
- detail page/modal;
- no delete operation for official history;
- current opponent Display Name resolution;
- summary does not require full move list;
- idempotent `matchId` unique persistence.

---

# 20. PRESENCE TESTS

Transitions:

```text
login → ONLINE
join active game → IN_GAME
match finalized/leave → ONLINE
disconnect/session expiry → OFFLINE after policy
```

Verify:

- only friends receive presence;
- `IN_GAME` does not leak Room ID;
- room member presence remains isolated;
- fan-out targets relevant users;
- reconnect updates presence consistently.

---

# 21. SAME-BROWSER GAME LOCK TESTS

Using multiple tabs/windows in same browser profile:

- Tab A begins gameplay and acquires client lock;
- Tab B sees website pages but cannot begin second gameplay;
- Tab B with same account rejected;
- Tab B after login as different account still blocked at browser gameplay layer;
- closing/crashing active tab does not immediately allow cheating around 30s server grace;
- after match finalizes, new gameplay permitted.

---

# 22. ACCOUNT ACTIVE-GAME LOCK TESTS

Server-side:

- same account from Chrome-like session and second session races JOIN;
- only one acquisition succeeds;
- second receives `ACTIVE_GAME_EXISTS`;
- lock retained during reconnect grace;
- lock released on final result;
- lock released on server-interruption recovery;
- stale lock cleanup verified.

Cross-browser physical-device detection is tested only as best-effort and MUST NOT be scored as an absolute guarantee.

---

# 23. DUPLICATE MESSAGE TESTING

Inject duplicate:

- Create Room;
- Join Room;
- Ready;
- PIECE_MOVE;
- Surrender;
- Rematch accept;
- friend request;
- friend accept;
- Match End persistence.

Expected: no duplicate domain mutation.

---

# 24. OUT-OF-ORDER / STALE TESTING

Cases:

- stale `expectedStateVersion` move;
- event N+1 arrives before N in simulated client layer;
- old snapshot after newer event;
- reconnect client with old sequence;
- stale room list event.

Expected:

- stale state not applied over newer state;
- resync triggered where necessary;
- canonical convergence restored.

---

# 25. DESYNC / RESYNC TESTING

Force client replica divergence.

Verify:

```text
Detect
→ RESYNC_REQUEST
→ replay or snapshot
→ verify sequence/stateVersion
→ resume
```

No permanent divergence after recoverable fault.

---

# 26. DISCONNECT TESTING

Required:

- disconnect on own turn;
- disconnect on opponent turn;
- reconnect at <30s;
- reconnect near grace boundary;
- reconnect >30s;
- refresh;
- simulated browser crash;
- both players disconnect;
- one reconnects while other remains disconnected;
- both grace-expire → ABORTED/no Elo;
- spectator disconnect.

Verify both clocks pause during player grace.

---

# 27. DATABASE TESTS

## 27.1 Schema/migrations

- clean database migration from zero;
- migration in CI/test environment;
- unique username case-insensitive behavior;
- friendship pair uniqueness;
- matchId uniqueness;
- indexes used for expected lookup patterns.

## 27.2 Ranked Match transaction

Inject failure between writes.

Expected: no half-updated player ratings.

## 27.3 DB outage during live match

Failure injection:

1. start Online match;
2. disconnect DB;
3. continue valid moves;
4. match remains playable;
5. Match End persistence becomes retry/pending;
6. DB restoration allows retry where process survives.

## 27.4 DB unavailable at Login

Login/Register/Profile/Friends may fail/degrade cleanly; process does not crash.

---

# 28. RETRY QUEUE TESTS

- enqueue failed Match End;
- retry succeeds;
- duplicate retries idempotent;
- bounded queue behavior under burst;
- metrics show queue depth/failures;
- process restart with pending item demonstrates documented possible loss limitation.

---

# 29. SERVER RESTART TEST

Scenario:

```text
Ranked match active
→ restart authoritative server
→ clients receive/derive SERVER_INTERRUPTION
→ no Elo change
→ stale active-game locks cleaned
→ users can queue/start again
```

Persistence already committed before restart remains intact.

---

# 30. NETWORK LATENCY TESTS

Run representative gameplay/reconnect/load at:

- Normal/base;
- +100 ms;
- +300 ms;
- +500 ms.

Measure:

- command-to-commit/visible latency;
- HTTP latency;
- realtime event latency/RTT where measurable;
- reconnect latency;
- error/desync rate.

Do not require impossible <50ms user RTT under injected +500ms network delay.

---

# 31. PACKET / MESSAGE LOSS TESTS

Where harness supports:

- 0%;
- 5%;
- 10% loss.

Verify:

- gaps detected;
- replay/snapshot recovery;
- no duplicate move from retransmission;
- no permanent desync;
- recovery latency recorded.

---

# 32. LOAD MODEL A — AUTH/API

Workload:

- concurrent Register/Login/Profile/History/Friends reads and safe writes.

Metrics:

- p50/p95 HTTP latency;
- throughput;
- error rate;
- DB latency;
- pool utilization;
- CPU/RAM.

---

# 33. LOAD MODEL B — MATCHMAKING

Simulate many users joining/cancelling queue.

Measure:

- queue operation latency;
- match commit rate;
- duplicate pairing = MUST be zero;
- queue wait distribution;
- CPU/RAM.

---

# 34. LOAD MODEL C — MANY ROOMS

Increase concurrent matches gradually.

For each stage record:

- players;
- active rooms;
- move frequency;
- p50/p95 move processing latency;
- error rate;
- CPU/RAM;
- connection count.

No predeclared “must support 50 rooms” guarantee. Continue until saturation/resource constraint is observed safely.

---

# 35. LOAD MODEL D — SPECTATOR FAN-OUT

Per-room staged scenario:

```text
2 players + 1 spectator
2 players + 10 spectators
2 players + 50 spectators
2 players + 100 spectators
```

Measure:

- event fan-out latency;
- bytes/sec;
- message count;
- CPU/RAM;
- dropped/error connections;
- client impact where practical.

The configured 100-spectator room option is a product capacity setting, not proof that every deployment environment sustains 100 smoothly; benchmark reports actual behavior.

---

# 36. LOAD MODEL E — MATCH END DB BURST

Create many matches that end within a narrow interval.

Measure:

- DB transaction latency;
- connection-pool behavior;
- retry queue depth;
- API/game impact;
- duplicate persistence count (must be zero).

---

# 37. SNAPSHOT VS DELTA BENCHMARK

Compare equivalent scenario using:

- frequent/full Snapshot strategy;
- Delta/Event strategy with snapshot only for bootstrap/recovery.

Record:

- total bytes;
- message count;
- p50/p95 delivery/processing latency;
- client/server CPU impact if measurable;
- resync cost.

Conclusion must describe trade-off, not only “Delta is better.”

---

# 38. STRESS TEST

Ramp beyond comfortable operating point until one or more show clear degradation:

- p95 latency;
- errors;
- memory pressure;
- connection failures;
- DB saturation.

Then reduce load and verify server returns to stable behavior.

Do not perform destructive uncontrolled stress against shared production infrastructure.

---

# 39. CAPACITY REPORTING

Final statement format:

```text
In environment X, commit Y, server configuration Z,
workload W reached the defined saturation criterion at ...
```

Never report a context-free universal “supports N users” claim.

---

# 40. UI/UX EDGE TESTS

- loading disables Login/Register/Create/Join/Search action;
- transient toast ~4s;
- actionable modal remains until decision;
- Browser Back warning in active match;
- reconnect within grace prevents immediate surrender;
- Light/Dark/System can change during game without state mutation;
- animation does not delay canonical update;
- responsive mobile layout remains usable;
- Vietnamese UI strings used in user-facing surfaces.

---

# 41. SECURITY / ABUSE TESTS

Attempt:

- spoof userId/playerId;
- spoof BLUE/RED;
- move opponent piece;
- move out of turn;
- fake remaining clock;
- fake winner/rating delta;
- join Private room without credential;
- reuse invitation token;
- use invite as wrong target;
- spectator send game command;
- read other room state;
- repeated malformed messages;
- recovery brute attempts;
- friend-request spam.

Expected:

- reject safely;
- no server crash;
- no private data leak;
- rate limit where specified.

---

# 42. PLAYHTML INTEGRATION TESTS

Verify project genuinely exercises realtime library integration:

- two clients in same room observe shared/realtime state;
- different rooms isolated;
- presence appears/disappears appropriately;
- custom app account identity is not replaced by local PlayHTML browser identity;
- reconnect/resubscribe restores correct application snapshot;
- transport/shared-state mutation cannot bypass application game validation.

---

# 43. HEALTH / DEPLOYMENT TESTS

- public frontend reachable;
- backend reachable;
- health reports application status;
- DB-degraded health state distinguishable where implemented;
- public Git README contains deployment link;
- fresh deployment can run migrations;
- environment secrets are not committed;
- restart scenario verified.

---

# 44. EVIDENCE FORMAT

Each benchmark scenario stores:

- scenario ID;
- purpose;
- configuration;
- client count;
- room/spectator count;
- duration;
- ramp profile;
- network impairment;
- environment;
- metrics table;
- chart(s) where useful;
- observed bottleneck;
- conclusion;
- reproducibility command/instructions.

---

# 45. ACCEPTANCE GATES

## Gate A — Game correctness

All critical board/turn/capture/goal/timer tests pass.

## Gate B — Account/data

Auth, recovery, profile, history, friend, rating transaction tests pass.

## Gate C — Network correctness

Ordering, duplicate, room isolation, reconnect, resync, spectator tests pass.

## Gate D — Failure behavior

DB outage and server restart scenarios produce defined behavior.

## Gate E — Performance evidence

Load, stress, spectator and snapshot/delta benchmarks executed with recorded environment.

## Gate F — Demo

Public deploy supports one complete primary demo journey.

---

# 46. FINAL TEST PLAN STATUS

```text
UNIT / CONTRACT             = DEFINED
INTEGRATION / E2E           = DEFINED
CONCURRENCY                 = DEFINED
NETWORK DEGRADATION         = DEFINED
DB / RESTART FAILURE        = DEFINED
LOAD / STRESS               = DEFINED
SNAPSHOT-DELTA BENCHMARK    = DEFINED
HARD CAPACITY CLAIM         = NONE BEFORE MEASUREMENT
STATUS                       = READY / FROZEN v0.1
```
