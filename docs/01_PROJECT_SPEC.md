# 01_PROJECT_SPEC.md

# OTTv2 Multiplayer — Project Specification v0.1

> **Status:** READY / FROZEN FOR v0.1 IMPLEMENTATION  
> **Project:** Bài 2 — Oẳn Tù Tì v2 Multiplayer  
> **Course context:** Network Programming (INT3304)  
> **Primary objective:** Demonstrate a correct, observable, testable multiplayer network system through a playable OTTv2 board game.  
> **Source of Truth chain:** Teacher Assignment → Locked Product Decisions Q1–Q191 → this document → `SRS.md` → `02_ARCHITECTURE.md` → `03_NETWORK_SPEC.md` → `04_TEST_PLAN.md` → `05_TEAM_TASKS.md`

---

# 0. DOCUMENT GOVERNANCE

## 0.1 Purpose

This file defines the project-level contract: what v0.1 is, what is in/out of scope, what must work for the demo, and what completion means.

Detailed behavior belongs in `SRS.md`. Technical organization belongs in `02_ARCHITECTURE.md`. Protocol semantics belong in `03_NETWORK_SPEC.md`. Testing evidence belongs in `04_TEST_PLAN.md`. Ownership and execution belong in `05_TEAM_TASKS.md`.

## 0.2 Change rule

Locked requirements MUST NOT be silently changed. Any future change must identify:

- the requirement being changed;
- affected files;
- implementation impact;
- test impact;
- migration/compatibility impact if applicable.

If documents conflict, STOP the affected implementation, resolve the conflict, update all affected documents, then continue.

## 0.3 Readiness meaning

`READY / FROZEN FOR v0.1 IMPLEMENTATION` means requirement ambiguity has been reduced to implementation-measurement items such as benchmark saturation and database pool sizing. It does **not** mean the software is already complete or bug-free.

---

# 1. PROJECT IDENTITY

## 1.1 Project type

A web-based multiplayer board game platform centered on OTTv2, built primarily to demonstrate Network Programming concepts:

- realtime client/server communication;
- server-authoritative state;
- room isolation;
- synchronization and resynchronization;
- concurrent users and concurrent rooms;
- session lifecycle;
- reconnect/recovery;
- spectators and presence;
- matchmaking;
- persistence outside the live game loop;
- load, stress and network-degradation testing;
- measurable benchmark evidence.

## 1.2 Teacher-assignment game

OTTv2 is a 9×9 strategic Rock–Paper–Scissors board game for exactly two active players.

Each side owns 9 pieces:

- 3 Rock / Đấm `✊`;
- 3 Paper / Lá `✋`;
- 3 Scissors / Kéo `✌️`.

Each piece moves exactly one square in any of 8 king-like directions.

Capture relation:

- Rock beats Scissors;
- Scissors beats Paper;
- Paper beats Rock;
- same-type enemy pieces cannot capture each other and block the destination;
- friendly pieces also block the destination.

A player wins by:

- eliminating all pieces of at least one type owned by the opponent; or
- reaching that player's opponent-side goal square; or
- opponent timeout; or
- opponent surrender; or
- opponent disconnect grace expiry.

## 1.3 Turn model

v0.1 gameplay is **turn-based only**.

Realtime behavior still exists at the network/system layer for:

- room list updates;
- ready/countdown;
- move broadcast;
- clocks;
- spectators;
- presence;
- reconnect/resync;
- friend invitations;
- matchmaking state.

Realtime piece cooldown gameplay is explicitly removed from v0.1.

---

# 2. PRODUCT SURFACES

The v0.1 web application contains six primary user-facing surfaces:

1. Login / Register
2. Homepage
3. Game Room
4. Match History
5. Profile
6. Friends

Supporting surfaces include Forgot Password, Account Settings, matchmaking queue, create-room modal, room-search result, match result, and guest-history import prompt.

All user-facing UI text is Vietnamese. Protocol identifiers, code identifiers and internal enums remain English.

---

# 3. USERS AND ROLES

## 3.1 Registered User

Can:

- log in on multiple browser sessions;
- enter Ranked Quick Match;
- create/join Unranked custom rooms;
- play against AI;
- play Offline mode;
- persist profile, theme, rating, match history and friends;
- use friend/block/invite features;
- view Profile and History.

Only one active gameplay instance is allowed per account at a time.

## 3.2 Guest

Can:

- play Online only as Unranked;
- play Vs AI;
- play Offline;
- maintain local Guest History and Guest Score in the browser;
- later register and receive a one-time import prompt on the same browser.

Guest Score is not official Ranked Elo.

## 3.3 Spectator

Can:

- join a playing room only if spectators are enabled and capacity remains;
- observe board state and both clocks in realtime;
- not send gameplay commands;
- reconnect as a new spectator rather than receiving a player-style grace reservation.

## 3.4 Host

The room creator is initial Host.

Before a match, Host controls custom-room configuration. If Host leaves while another player remains in WAITING, Host ownership transfers to the remaining player.

During PLAYING, Host cannot kick players or change game rules.

---

# 4. CORE USER JOURNEYS

## 4.1 Registered Ranked journey

```text
Login
  ↓
Homepage
  ↓
Chơi 1vs1 Online
  ↓
Ranked Matchmaking Queue
  ↓
Rating range widens with waiting time
  ↓
Match committed atomically
  ↓
BLUE / RED assigned randomly
  ↓
Both READY
  ↓
3-second countdown
  ↓
BLUE always moves first
  ↓
Turn-based match
  ↓
Result
  ↓
Persist summary + Elo transaction
  ↓
History/Profile updated
```

## 4.2 Guest Online journey

```text
Guest identity
  ↓
Chơi 1vs1 Online
  ↓
Unranked Queue
  ↓
Match
  ↓
Local Guest History / Guest Score
```

## 4.3 Custom-room journey

```text
Homepage
  ↓
Create Room
  ↓
Public or Private
  ↓
All custom rooms are UNRANKED
  ↓
WAITING
  ↓
Player 2 joins
  ↓
Both READY
  ↓
Countdown / optional double-SPACE skip
  ↓
PLAYING
```

## 4.4 Reconnect journey

```text
Active Match
  ↓
Disconnect
  ↓
Pause both clocks
  ↓
30-second Grace Period
  ├─ reconnect → resync canonical state → continue
  └─ expire → disconnected player forfeits
```

If both players disconnect and both grace periods expire, the match is `ABORTED` with no Elo change.

---

# 5. GAME BASELINE

## 5.1 Board and goals

Canonical board coordinates are `a1` through `i9`.

- BLUE starts near `a1` and targets `i9`.
- RED starts near `i9` and targets `a1`.
- `a1` and `i9` are empty at match start.
- BLUE always takes the first turn.
- RED's client rotates the board 180° for presentation only; server coordinates remain canonical.
- Spectator orientation is canonical with BLUE shown from the bottom side.

## 5.2 Canonical starting setup

BLUE:

```text
b1 ✊   c1 ✋   d1 ✌️
e1 ✊   f1 ✋   g1 ✌️
h1 ✊   i1 ✋   a2 ✌️
```

RED is the exact 180° rotation:

```text
a9 ✋   b9 ✊   c9 ✌️
d9 ✋   e9 ✊   f9 ✌️
g9 ✋   h9 ✊   i8 ✌️
```

## 5.3 Clock

Each player owns an independent chess-style countdown clock.

Available time controls per player:

- 30 seconds;
- 1 minute;
- 5 minutes;
- 10 minutes;
- 30 minutes;
- 1 hour.

Only the current-turn player's clock runs. Clock switch occurs only after the server accepts a valid move.

## 5.4 Rematch

A rematch requires request + accept.

Players swap BLUE/RED sides, therefore the previous RED player becomes BLUE and moves first in the rematch.

A rematch following a Ranked Quick Match is Unranked.

---

# 6. ACCOUNT, PROFILE AND RECOVERY

## 6.1 Registration fields

Required:

- full name;
- display name;
- username;
- password;
- password confirmation.

Registration provides a one-time Recovery Code. No email verification and no SMTP recovery flow exist in v0.1.

## 6.2 Identity rules

- Username: 4–20 characters; letters/numbers/underscore; no spaces; case-insensitive uniqueness; immutable after registration.
- Display name: 2–20 characters; not unique; freely editable.
- Full name: 2–50 characters; Vietnamese Unicode supported; always private.
- Password: minimum 8 characters; no rigid composition rule.

## 6.3 Recovery

Forgot Password requires:

```text
Username
+
Recovery Code
↓
Set new password
↓
Revoke all existing sessions
```

Recovery Code plaintext is shown once after registration and is never displayed again by the server.

---

# 7. HOMEPAGE, ROOMS AND MATCHMAKING

## 7.1 Homepage

Contains:

- title `Oẳn Tù Tì v2`;
- Room ID search;
- `Chơi 1vs1 Online`;
- `Chơi với máy`;
- `Chơi Offline`;
- public waiting-room grid;
- Create Room;
- Profile access;
- Friends preview.

Room list shows 8 cards at a time in a 4×2 area with internal scroll.

## 7.2 Room visibility

Homepage room list shows only Public + WAITING rooms.

Private rooms do not appear in the list but can be found by exact Room ID or entered by friend invite.

Search of a playing room can offer `Xem trận` only when spectator access is enabled and capacity remains.

## 7.3 Room IDs

Room ID:

- 6 characters;
- uppercase letters and digits;
- excludes visually ambiguous `O`, `0`, `I`, `1`;
- unique among active rooms.

## 7.4 Custom-room configuration

Custom rooms are always Unranked.

Configuration:

- optional room name; server generates friendly name if blank;
- Public or Private;
- Private password 1–12 characters;
- time control;
- spectators on/off;
- spectator capacity: 1, 2, 5, 10, 50, 100.

Public rooms cannot have a password.

## 7.5 Ranked matchmaking

Registered Quick Match is Ranked.

Matching uses current Elo range and widens the allowed range as queue wait increases. Recent form may be stored/displayed but does not participate in v0.1 matching.

Guests automatically use Unranked matchmaking.

---

# 8. RATING

Official Ranked rating uses simple Elo:

- starting Elo: `1000`;
- fixed `K = 32`;
- minimum Elo: `0`;
- only Ranked Quick Match changes Elo;
- custom rooms, rematches, Guest, AI and Offline do not change Elo.

Profile Win Rate and Recent Form use Ranked 1v1 only.

Recent Form = last 5 Ranked matches.

---

# 9. HISTORY

Registered Account history persists match summaries.

- Ranked Online: stored, affects Elo.
- Unranked Online: stored, affects Win/Loss history but not Elo.
- Vs AI: stored, no Elo.
- Offline: local only, not Account stats.
- Guest: local browser storage until optional import after registration.

History loads 20 matches per page/load-more request.

Official Account Match History cannot be deleted by the user in v0.1.

v0.1 stores match summary, not full move replay.

---

# 10. FRIENDS, PRESENCE AND BLOCKING

Core social features:

- search by username/display name;
- send friend request;
- incoming/sent requests;
- accept/reject/cancel;
- remove friend;
- Block User;
- friend-only realtime presence;
- invite eligible online friend to Room.

Limits:

- 200 friends/account;
- 50 incoming pending requests;
- 50 sent pending requests;
- rejected pair cooldown: 24 hours;
- invitation token expiry: 60 seconds.

If A→B and B→A requests race, the server resolves atomically to one friendship.

Presence visible to friends only:

- Online;
- Offline;
- Đang chơi.

`Đang chơi` never exposes Room ID.

Friend chat is out of scope for v0.1.

---

# 11. SESSION AND ACTIVE-GAME CONTROL

## 11.1 Session

Registered users may be logged in on multiple sessions.

Only one active game is permitted per account.

## 11.2 Same-browser enforcement

Within one browser profile, gameplay exclusivity uses:

- browser-level exclusive lock;
- cross-tab notification;
- server active-game lock.

A second tab may still view Homepage/Profile/History but cannot start a second gameplay instance.

## 11.3 Cross-browser / incognito

Product intent: one physical device should run only one active gameplay instance.

Web implementation guarantee:

- STRICT: one Account = one Active Game;
- STRICT: one Browser Profile = one Active Gameplay Instance;
- BEST-EFFORT: cross-browser/incognito physical-device detection.

v0.1 MUST NOT claim perfect physical-device identification across unrelated browsers/private profiles.

---

# 12. AI AND OFFLINE MODES

## 12.1 Vs AI

AI runs client-side and has one `Normal` level:

```text
if legal capture exists → prefer a legal capture
else → choose a legal move
```

AI mode does not use Ranked Elo.

## 12.2 Offline

Two humans share one device and alternate turns locally.

Offline match history is local only.

---

# 13. TECHNICAL PROJECT SCOPE

## 13.1 Core networking

Must demonstrate:

- HTTP control operations;
- realtime channel via PlayHTML/realtime adapter;
- server-authoritative commands;
- canonical room/game state;
- ordering/sequence/version semantics;
- duplicate protection/idempotency;
- snapshot + delta/event synchronization;
- desync detection and full snapshot resync;
- disconnect/reconnect;
- room isolation;
- spectators;
- presence;
- matchmaking concurrency;
- server-side validation;
- rate limiting.

## 13.2 Persistence

PostgreSQL stores durable application data such as:

- users;
- profiles;
- sessions;
- user statistics;
- friendships;
- friend requests;
- blocks;
- matches;
- match players;
- rating/history data.

Live move processing MUST NOT require a database read/write per move.

## 13.3 Technology baseline

- Web client, desktop-first and responsive.
- Node.js/TypeScript backend baseline.
- PostgreSQL, provider-agnostic.
- Prisma ORM and migration files in Git.
- PlayHTML used for realtime/presence/shared-state integration.
- One authoritative application backend instance in v0.1.
- No Redis in v0.1 unless a future benchmark-driven change is explicitly approved.

---

# 14. DEPLOYMENT BASELINE

Production-like v0.1:

```text
Static Frontend
      ↓
Application Backend / Game Authority
      ↓
Managed PostgreSQL

Realtime integration
      ↕
PlayHTML-compatible realtime host/adapter
```

The application backend remains the authority for account/session/authorization/game/rating regardless of realtime transport implementation.

Render 512 MB is a deployment constraint for measurement, not a capacity guarantee.

A public deploy link must be included in the Git repository/README.

---

# 15. OUT OF SCOPE v0.1

Explicitly excluded unless the teacher later requires them:

- 2v2 or >2 active players per OTTv2 match;
- realtime cooldown gameplay mode;
- global leaderboard complexity beyond user Elo display;
- advanced anti-cheat/device fingerprint guarantees;
- native mobile apps;
- friend chat/voice chat;
- upload-your-own avatar;
- email verification/SMTP recovery;
- payment/items/economy;
- production autoscaling/multi-region architecture;
- multi-instance distributed matchmaking;
- Redis/message broker infrastructure;
- full match replay/move-history storage;
- advanced AI difficulty levels;
- Delete Account flow;
- enterprise authentication.

---

# 16. PRIORITY ORDER

If scope must be reduced, protect work in this order:

```text
1. Online Game + Network Correctness
2. Auth / Session / Account
3. Room + Ranked Matchmaking
4. Realtime Sync + Reconnect
5. Match History + Profile
6. Friends + Presence
7. Spectator
8. UX polish
9. Optional enhancements
```

Optional polish must never weaken core networking correctness.

---

# 17. PERFORMANCE AND BENCHMARK POLICY

No hard claim such as “supports 100/500 users” is valid before measurement.

Load tests increase workload until saturation and report the environment used.

Required metrics include:

- p50 latency;
- p95 latency;
- throughput;
- error rate;
- CPU;
- RAM;
- active/concurrent connections;
- database latency;
- bytes/message and messages/sec where applicable.

Benchmark evidence must include configuration, metrics, tables/charts and conclusion.

Capacity wording must be contextual:

> “In environment X with configuration Y, workload Z reached saturation at …”

not an unconditional production guarantee.

---

# 18. COMPLETION MODEL

Weights retained for v0.1:

- Core Protocol / Networking: 30%
- Game / Product Rules: 25%
- Reliability / Data Correctness: 25%
- QA / Load / Benchmark Evidence: 20%

`DEMO_SAFE_THRESHOLD = 90%`, with all Critical Requirements passing.

Critical requirements cannot be compensated for by optional completion percentage.

---

# 19. CRITICAL REQUIREMENTS

The demo is not considered safe if any of these fail:

- two-player Online match completes correctly;
- server validates moves and turn ownership;
- canonical state converges on both players;
- BLUE/RED assignment and goal ownership are correct;
- personal clocks are server-authoritative;
- Ranked Quick Match can pair users atomically;
- room isolation holds;
- duplicate/out-of-order inputs do not corrupt state;
- disconnect/reconnect works within 30 seconds;
- grace expiry produces deterministic result;
- spectator is read-only;
- one account cannot join two active games simultaneously;
- PostgreSQL failure does not kill an already-running healthy live match;
- Match End persistence is idempotent;
- server restart releases stale active-game locks and does not incorrectly change Ranked Elo;
- required automated/network/load tests can be executed;
- public deployment is reachable for the demo.

---

# 20. FINAL PROJECT READINESS

```text
TEACHER_ASSIGNMENT            = INTEGRATED
PRODUCT_DECISIONS_Q1_Q191     = LOCKED
GAME_RULE_AMBIGUITY           = 0 CRITICAL
REQUIREMENT_COVERAGE          ≈ 99%
PROJECT_SPEC                  = READY / FROZEN v0.1
IMPLEMENTATION                = MAY PROCEED
```

Remaining unknowns are measurement-derived values such as saturation point, connection-pool tuning and exact production latency; they are intentionally resolved by implementation/benchmark rather than invented in requirements.

---

# 21. CHANGE LOG

| Version | Status | Change |
|---|---|---|
| 1.0 | Superseded baseline | Initial generic multiplayer/network project baseline |
| 1.1 | Superseded | Initial OTTv2 assignment integration |
| 0.1-final | READY / FROZEN | Integrated locked Q1–Q191 product, game, account, social, persistence, networking, deployment and benchmark decisions |
