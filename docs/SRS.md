# SRS.md

# Software Requirements Specification — OTTv2 Multiplayer v0.1

> **Status:** READY / FROZEN FOR v0.1 IMPLEMENTATION  
> **Language:** User-facing Vietnamese; internal identifiers English  
> **Authority:** Detailed WHAT/acceptance specification  
> **Parent:** `01_PROJECT_SPEC.md`

---

# 0. REQUIREMENT CONVENTIONS

- `MUST`: mandatory for v0.1.
- `SHOULD`: expected unless an implementation constraint is documented.
- `MAY`: optional implementation choice that cannot change locked behavior.
- Client never becomes authoritative for game-critical state.
- All room/game transitions that can race MUST be server-serialized/atomic at the logical operation boundary.
- UI animations MUST NOT delay or redefine canonical state.

---

# 1. ACTORS

| Actor | Description |
|---|---|
| Registered User | Persistent account with Elo, Profile, History, Friends and settings |
| Guest | Local identity/history; Online restricted to Unranked |
| Player | One of exactly two active participants in a match |
| Spectator | Read-only observer when allowed |
| Host | Current owner of custom-room pre-match configuration |
| Server | Authoritative application/game authority |
| PostgreSQL | Durable storage for account/social/history data, not per-move authority |
| PlayHTML realtime layer | Realtime/presence/shared-state integration; not the authority for private account data |

---

# 2. OTTv2 GAME RULES

## 2.1 Board

`GAME-BOARD-001` — Board MUST contain 9×9 squares with canonical coordinates `a1..i9`.

`GAME-BOARD-002` — `a1` and `i9` are goal squares and MUST be empty at initial state.

`GAME-BOARD-003` — Server canonical coordinates never rotate. RED UI MAY rotate the visual board 180°, but every displayed coordinate label MUST still represent the canonical square occupying that visual position.

`GAME-BOARD-004` — Spectator view MUST use canonical orientation with BLUE presented from the bottom side.

## 2.2 Pieces

Each player MUST start with exactly:

- 3 Rock `R` / Đấm `✊`;
- 3 Paper `P` / Lá `✋`;
- 3 Scissors `S` / Kéo `✌️`.

Canonical BLUE setup:

| Square | Piece |
|---|---|
| b1 | R |
| c1 | P |
| d1 | S |
| e1 | R |
| f1 | P |
| g1 | S |
| h1 | R |
| i1 | P |
| a2 | S |

Canonical RED setup is the exact 180° rotation:

| Square | Piece |
|---|---|
| a9 | P |
| b9 | R |
| c9 | S |
| d9 | P |
| e9 | R |
| f9 | S |
| g9 | P |
| h9 | R |
| i8 | S |

## 2.3 Side assignment and first turn

`GAME-SIDE-001` — When two players are ready to start, Server MUST randomly assign BLUE and RED.

`GAME-SIDE-002` — BLUE MUST always take the first turn.

`GAME-SIDE-003` — Host status MUST NOT determine side.

`GAME-SIDE-004` — Accepted rematch MUST swap player sides; because BLUE always starts, first-mover alternates across the immediate rematch.

## 2.4 Movement

`GAME-MOVE-001` — A piece moves exactly one square in any one of 8 directions.

Valid coordinate delta satisfies:

```text
max(abs(dx), abs(dy)) == 1
```

`GAME-MOVE-002` — Destination outside board MUST be rejected.

`GAME-MOVE-003` — Destination occupied by friendly piece MUST be rejected.

`GAME-MOVE-004` — Destination occupied by enemy piece of same R/P/S type MUST be rejected.

`GAME-MOVE-DERIVED-001` — The teacher/source material explicitly defines the three winning capture relations and same-type blocking, but does not explicitly state what happens when an attacker moves onto a stronger enemy. For deterministic v0.1 implementation, this specification derives the conservative rule: an enemy-occupied destination is legal only when the attacker beats the defender; a losing matchup is rejected. This is a **derived implementation rule**, not a verbatim teacher rule, and is the first gameplay rule to revisit if the teacher clarifies the interaction.

`GAME-MOVE-005` — Only the current-turn player's own piece may move.

`GAME-MOVE-006` — A rejected move MUST NOT switch turn or stop the current player's clock.

## 2.5 Capture

- `R` captures `S`.
- `S` captures `P`.
- `P` captures `R`.

On valid capture:

1. defender is removed;
2. attacker occupies destination;
3. piece counts update;
4. win conditions evaluate;
5. if no win, turn switches.

## 2.6 Victory

`GAME-WIN-001` — Extinction: player wins immediately when opponent has zero remaining pieces of any one type.

`GAME-WIN-002` — Goal: BLUE wins only by moving a surviving BLUE piece into `i9`.

`GAME-WIN-003` — Goal: RED wins only by moving a surviving RED piece into `a1`.

`GAME-WIN-004` — Timeout: player's personal clock reaches zero → that player loses.

`GAME-WIN-005` — Surrender: explicit confirmed surrender → opponent wins.

`GAME-WIN-006` — Disconnect: player fails to reconnect within 30-second grace → opponent wins, unless both players also expire their grace windows.

`GAME-WIN-007` — Both players grace-expire → result `ABORTED`, no winner, no Elo change.

`GAME-WIN-008` — `SERVER_INTERRUPTION` in Ranked match → aborted/no Elo change.

---

# 3. TURN CLOCK

`TIMER-001` — Each player owns an independent countdown clock.

Allowed initial time per player:

```text
30s, 60s, 300s, 600s, 1800s, 3600s
```

`TIMER-002` — At `GAME_START`, BLUE clock begins immediately.

`TIMER-003` — Only current-turn player's clock runs.

`TIMER-004` — Clock switch MUST occur only when Server accepts the move and commits canonical state.

`TIMER-005` — During a player disconnect grace period, both clocks MUST pause.

`TIMER-006` — On successful reconnect/resync, the appropriate current-turn clock resumes.

`TIMER-007` — Spectators MUST see both clocks in realtime.

Server time is authoritative. Client countdown is presentation derived from server timestamps/state.

---

# 4. READY / COUNTDOWN / MATCH LIFECYCLE

Canonical room/match lifecycle:

```text
WAITING
  ↓
READY_CHECK
  ↓
COUNTDOWN
  ↓
PLAYING
  ↓
ENDED | ABORTED
  ↓
WAITING (accepted rematch) or room closure
```

`READY-001` — Both players MUST explicitly enter Ready before countdown begins.

`READY-002` — Countdown is 3 seconds.

`READY-003` — During countdown each player MAY press Space to fast-ready.

`READY-004` — If both fast-ready before countdown completes, remaining countdown is skipped.

`READY-005` — Side assignment MUST be server-controlled before `GAME_START`.

---

# 5. AUTHENTICATION AND ACCOUNT

## 5.1 Login

Login UI MUST contain:

- title `Oẳn Tù Tì`;
- username;
- password;
- `Đăng nhập`;
- `Quên mật khẩu`;
- register navigation;
- optional `Ghi nhớ đăng nhập`.

`AUTH-LOGIN-001` — Successful login creates/refreshes an authenticated server session.

`AUTH-LOGIN-002` — Multiple login sessions are allowed, but active gameplay is limited separately.

`AUTH-LOGIN-003` — Authentication session SHOULD use Secure + HttpOnly + SameSite cookie semantics in production.

`AUTH-LOGIN-004` — Login failures MUST use progressive throttle/rate limiting; no permanent lock solely from failed password attempts.

## 5.2 Registration

Required fields:

- Full Name;
- Display Name;
- Username;
- optional helper `Dùng tên hiển thị` for username field;
- Password;
- Confirm Password.

Validation:

- Username: 4–20, `[A-Za-z0-9_]`, no spaces, unique case-insensitively.
- Display Name: 2–20, duplicates allowed.
- Full Name: 2–50 Unicode characters, Vietnamese supported.
- Password: at least 8 characters.

`AUTH-REG-001` — Username is immutable after registration.

`AUTH-REG-002` — Full Name is private.

`AUTH-REG-003` — Registration MUST produce one Recovery Code.

## 5.3 Recovery Code

`AUTH-REC-001` — Recovery Code plaintext MUST be displayed exactly once after registration with Copy action.

`AUTH-REC-002` — Server MUST store only a protected verifier/hash, not recoverable plaintext.

`AUTH-REC-003` — Forgot Password requires username + valid Recovery Code + new password.

`AUTH-REC-004` — Successful recovery MUST revoke all prior sessions.

`AUTH-REC-005` — Failed recovery attempts MUST be rate-limited by account and request/network context.

No email verification, SMTP recovery or security-question recovery exists in v0.1.

## 5.4 Password change

When authenticated user changes password:

- current session remains valid;
- every other session is revoked.

---

# 6. GUEST

`GUEST-001` — Guest MAY use Online, Vs AI and Offline modes.

`GUEST-002` — Guest Online MUST always be Unranked.

`GUEST-003` — Guest enters a Display Name before playing; duplicate names are allowed.

`GUEST-004` — UI SHOULD append a short Guest identifier where duplicate names could be confusing.

`GUEST-005` — Guest History and Guest Score MUST be local-browser data, recommended IndexedDB.

`GUEST-006` — Clearing browser data may remove Guest History; UI SHOULD explain that registering preserves durable account history.

## 6.1 Guest → Account import

On successful registration in the same browser:

- if eligible local Guest History exists, show one import popup exactly once;
- Accept → import Guest history/W-L/local score;
- Decline → do not prompt again for that account/browser import state;
- imported Guest Score MUST NOT initialize official Ranked Elo;
- official Ranked Elo starts at 1000;
- import MUST be idempotent to avoid duplicate match/history records.

---

# 7. HOMEPAGE

`HOME-001` — Header/hero contains `Oẳn Tù Tì v2`.

`HOME-002` — Room search placeholder: `Nhập id phòng chơi`.

`HOME-003` — Quick actions:

- `Chơi 1vs1 Online`;
- `Chơi với máy`;
- `Chơi Offline`.

`HOME-004` — Room list shows 4 columns × 2 visible rows = 8 room cards, with internal scroll.

`HOME-005` — Empty list displays an Empty State and `Tạo phòng` action.

`HOME-006` — Profile control is available top-right.

`HOME-007` — Friends preview is present.

`HOME-008` — Room list updates realtime without manual refresh.

---

# 8. ROOM SEARCH AND ROOM CARDS

## 8.1 Search

Exact Room ID search:

- existing WAITING Public → room card + Join;
- existing WAITING Private → room card + password join flow;
- existing PLAYING + spectators enabled + slot → `Xem trận`;
- PLAYING without spectator eligibility → joining denied;
- absent → top/center toast `Phòng đấu không tồn tại` for ~4 seconds.

## 8.2 Room card

Card SHOULD display:

- room name;
- Room ID;
- `Players 1/2`;
- waiting player's rating when applicable;
- Unranked;
- Public/Private context when directly searched;
- time control;
- spectator capacity/status;
- WAITING/PLAYING state when context requires.

Homepage browse list contains only Public + WAITING rooms.

Private rooms MUST NOT appear in browse list.

---

# 9. CREATE ROOM

All custom rooms are `UNRANKED`.

Fields/options:

- Room Name optional, max 30 characters;
- Public/Private;
- server-generated Room ID;
- time control;
- Private password 1–12 characters;
- spectator enabled/disabled;
- if enabled, capacity 1/2/5/10/50/100.

`ROOM-CREATE-001` — Blank room name → server generates friendly name.

`ROOM-CREATE-002` — Room ID is 6 uppercase alphanumeric characters excluding `O,0,I,1` and unique among active rooms.

`ROOM-CREATE-003` — Public room MUST NOT have password.

`ROOM-CREATE-004` — Private password MUST be verified server-side and MUST NOT be stored as plaintext.

`ROOM-CREATE-005` — Client MUST disable Create while request is pending; Server MUST protect against duplicate create submissions.

---

# 10. ROOM MEMBERSHIP AND HOST

`ROOM-MEM-001` — Active player capacity is exactly 2.

`ROOM-MEM-002` — If P2 leaves WAITING, room remains with Host at `1/2`.

`ROOM-MEM-003` — If Host leaves WAITING while P2 remains, Host role transfers to remaining player.

`ROOM-MEM-004` — If no active player remains, room may be destroyed and its Room ID released.

`ROOM-MEM-005` — Host cannot kick after PLAYING begins.

`ROOM-MEM-006` — Rules/time/spectator configuration cannot be changed after PLAYING begins.

`ROOM-MEM-007` — Leaving PLAYING requires confirmation and is treated as Surrender.

---

# 11. MATCHMAKING

## 11.1 Ranked Quick Match

Registered `Chơi 1vs1 Online` enters Ranked queue immediately.

Match logic:

- match by Elo range;
- allowed range widens as waiting time increases;
- no hard queue timeout; user may cancel;
- recent form/head-to-head are stored/displayed only, not matching inputs in v0.1.

`MM-001` — Match commit MUST be atomic: if cancellation races with a completed pair commit, already-committed match wins and cancel fails clearly.

`MM-002` — One queued player MUST NOT be matched twice.

## 11.2 Guest Quick Match

Guest enters Unranked queue automatically and receives a small notice that Guests can only play Unranked Online.

## 11.3 Cancel

Queue UI MUST provide `Hủy tìm trận`.

---

# 12. ELO

Official rating:

```text
initial = 1000
K = 32
minimum = 0
```

`RATING-001` — Only Registered Ranked Quick Match updates Elo.

`RATING-002` — Public/Private custom rooms are Unranked.

`RATING-003` — Immediate rematch after Ranked match is Unranked.

`RATING-004` — Guest/AI/Offline never change official Elo.

`RATING-005` — Elo updates for both players and match persistence MUST be logically atomic where durable write succeeds.

---

# 13. GAME ROOM UI

Game Room MUST prioritize board visibility.

## 13.1 Header

Display:

- room name;
- Room ID where appropriate;
- Ranked/Unranked;
- Public/Private where applicable;
- time control;
- copy ID when relevant;
- leave/surrender action.

## 13.2 Player panels

BLUE and RED panels display:

- avatar;
- display name;
- rating when account/ranked context applies;
- clock;
- connection state;
- own ping indicator only.

Opponent's exact ping MUST NOT be exposed.

## 13.3 Board interaction

- selected own piece highlight;
- locally valid destinations highlight;
- opponent MUST NOT receive hover/selection/highlight intent;
- only accepted move is broadcast;
- visual animation MUST follow accepted canonical state and MUST NOT delay state application.

## 13.4 Result

Result UI supports reasons:

- `EXTINCTION`;
- `GOAL_REACHED`;
- `TIMEOUT`;
- `SURRENDER`;
- `DISCONNECT_TIMEOUT`;
- `ABORTED`;
- `SERVER_INTERRUPTION`.

Ranked result displays Elo before/after/delta when applicable.

Post-match actions MAY include:

- Chơi lại;
- Trang chủ;
- Xem hồ sơ đối thủ;
- Kết bạn;
- Xem lịch sử.

---

# 14. REMATCH

`REMATCH-001` — One player requests; other must accept.

`REMATCH-002` — Board resets to canonical initial setup.

`REMATCH-003` — Players swap BLUE/RED.

`REMATCH-004` — Rematch after Ranked match is Unranked.

---

# 15. SPECTATOR

`SPEC-001` — Spectator may join before or during PLAYING when enabled and capacity remains.

`SPEC-002` — Private-room spectator must authenticate access by password unless entering via valid targeted invitation token.

`SPEC-003` — Spectator is read-only and gameplay commands MUST be rejected.

`SPEC-004` — Spectator disconnect removes presence/slot promptly; reconnect counts as a new spectator join.

`SPEC-005` — Spectator sees both clocks and canonical board orientation.

`SPEC-006` — No spectator chat in v0.1.

---

# 16. FRIENDS

## 16.1 Search

Search supports:

- username exact/prefix;
- Display Name contains.

Search results show at least:

- avatar;
- display name;
- `@username`;
- rating;
- relationship action.

Non-friends MUST NOT receive realtime presence state.

## 16.2 Requests

Limits:

- max 200 friends;
- max 50 incoming pending;
- max 50 sent pending.

Actions:

- send;
- accept;
- reject;
- cancel sent;
- remove friend.

`FRIEND-REQ-001` — Simultaneous A→B and B→A requests resolve atomically to one friendship.

`FRIEND-REQ-002` — Rejected same pair has 24-hour resend cooldown.

`FRIEND-REQ-003` — Friend-request operations are rate-limited against send/cancel spam.

## 16.3 Invite

Only friend who is `ONLINE` and not `IN_GAME` may be invited.

Private-room invitation token MUST contain/represent:

- target room;
- target user;
- expiry;
- single-use semantics.

Expiry = 60 seconds.

Accepting invite MUST revalidate current room existence/capacity/access; stale popup data is not authority.

---

# 17. BLOCK USER

Block MUST:

- remove existing friendship;
- cancel pending requests both directions;
- prevent new requests/invites between the pair;
- hide presence both directions.

Friend chat is not implemented.

---

# 18. PROFILE

## 18.1 Own profile

Shows:

- avatar;
- display name;
- `@username`;
- current Elo;
- Ranked match count;
- Ranked wins/losses;
- Ranked Win Rate;
- last 5 Ranked form;
- friend count;
- editable profile/settings entry.

## 18.2 Public profile

Public to other users:

- avatar;
- display name;
- `@username`;
- Elo;
- Ranked matches;
- Ranked Win Rate;
- Recent Form;
- friend count.

Full friend list is not public.

Presence is visible only to friends.

## 18.3 Private fields

Private:

- full name;
- recovery credential state;
- account/session settings.

## 18.4 Avatar

v0.1 uses built-in avatar/emoji/icon choices only; no image uploads.

---

# 19. HISTORY

History overview may show:

- total relevant matches;
- wins/losses;
- Win Rate;
- current Elo;
- Recent Form.

Filters SHOULD support:

- All;
- Ranked;
- Unranked;
- Guest/local context;
- Vs AI;
- Offline/local context;
- Win/Loss;
- 7 days / 30 days / All.

Registered account server history loads 20 records per page/load-more.

Match detail stores summary, not full move list.

Minimum summary fields:

- matchId;
- mode;
- ranked flag;
- participants;
- BLUE/RED assignment;
- winner/loser where applicable;
- result reason;
- rating before/after/delta when applicable;
- timer config;
- startedAt;
- endedAt;
- duration.

Display opponent's current Display Name when resolving profile identity.

Official Account History cannot be deleted by user in v0.1.

---

# 20. VS AI

`AI-001` — Runs client-side/local.

`AI-002` — One difficulty `Normal`.

`AI-003` — Decision rule: prefer any legal capture; if none, select a legal move.

`AI-004` — Account History MAY store Vs AI summary, but Elo does not change.

---

# 21. OFFLINE

`OFFLINE-001` — Two humans share one device.

`OFFLINE-002` — Uses same OTTv2 rule engine semantics where practical.

`OFFLINE-003` — No realtime game server required for gameplay.

`OFFLINE-004` — History is local only; does not affect Account statistics/Elo.

---

# 22. THEME AND UI

Themes:

- Sáng;
- Tối;
- Theo hệ thống.

Account user stores theme locally and persistently in Profile for cross-device preference. Guest stores locally.

Visual direction:

- modern Robotic + Data + AI;
- familiar `✊ ✋ ✌️` motifs;
- raised/3D interaction surfaces;
- subtle background data patterns;
- BLUE vs RED side contrast;
- board remains visual focus.

Responsive mobile viewing/interaction SHOULD work, but desktop is primary target.

Click/touch is primary gameplay control. Keyboard shortcuts are secondary; full keyboard board control is not a v0.1 gameplay requirement.

---

# 23. LOADING, ERRORS AND DOUBLE-SUBMIT

`UX-001` — Pending Login/Register/Join/Create/Search actions MUST disable the triggering control and show loading state where appropriate.

`UX-002` — Server MUST still protect non-idempotent operations; client disabling alone is insufficient.

`UX-003` — Transient errors such as room not found/password wrong/room full may use ~4-second toast unless user action is required.

`UX-004` — Browser Back/navigation away during match SHOULD warn about disconnect risk; navigation itself is not immediate surrender if reconnect occurs within grace.

---

# 24. SESSION AND DEVICE/GAME LOCK

## 24.1 Account lock

`LOCK-001` — One account MUST NOT participate in more than one active match simultaneously.

Check/acquire MUST be atomic.

## 24.2 Browser lock

`LOCK-002` — Same browser profile MUST reject a second active gameplay tab/window, while allowing non-game pages.

Implementation SHOULD combine browser exclusive lock, cross-tab messaging and server authority.

## 24.3 Physical device intent

`LOCK-003` — Product intent is one active gameplay instance per physical device.

Acceptance MUST distinguish:

- strict account enforcement;
- strict same-browser-profile enforcement;
- best-effort cross-browser/incognito detection.

Absolute cross-browser physical-device identity is not a web v0.1 guarantee.

## 24.4 Release

Active-game lock releases when match is finalized/aborted, not only after returning Home.

---

# 25. DISCONNECT / RECONNECT

`NET-REC-001` — Player disconnect starts 30-second grace.

`NET-REC-002` — Both clocks pause during grace.

`NET-REC-003` — Refresh/browser crash may reconnect within grace using valid session/match identity.

`NET-REC-004` — Reconnect MUST restore membership and canonical state through replay/resync or snapshot fallback.

`NET-REC-005` — Grace expiry forfeits the disconnected player unless both expire → ABORTED.

`NET-REC-006` — Spectator has no player grace reservation.

---

# 26. SERVER INTERRUPTION

v0.1 does not require live-match restoration after process restart.

On restart/interruption:

- affected live matches become `SERVER_INTERRUPTION`/aborted;
- Ranked Elo MUST NOT change due solely to interruption;
- stale active-game locks MUST be cleaned/recovered;
- user MUST be able to start a new match afterward.

---

# 27. DATA / POSTGRESQL REQUIREMENTS

Durable model MUST cover at least:

- users;
- profiles;
- user_stats;
- sessions;
- friendships;
- friend_requests;
- user_blocks;
- matches;
- match_players;
- durable preferences/audit fields as required.

PostgreSQL provider MUST be swappable without changing domain semantics.

Prisma migrations MUST be committed to Git.

Live canonical game state resides in realtime server memory/runtime, not in PostgreSQL per move.

Match persistence occurs immediately after `MATCH_END` attempt, with idempotency and bounded retry behavior.

---

# 28. DATABASE FAILURE

`DB-FAIL-001` — If DB is down before Login/Register/Profile/Friends operations, those dependent functions may be unavailable/degraded.

`DB-FAIL-002` — A healthy live match MUST continue if DB becomes unavailable mid-match.

`DB-FAIL-003` — Match result persistence failure MUST NOT hold players indefinitely; result can finalize while persistence enters retry/pending state.

`DB-FAIL-004` — v0.1 retry queue may be bounded in-memory; pending writes may be lost on server restart and this limitation MUST be documented/tested.

---

# 29. PRESENCE

Realtime source of truth for `ONLINE / OFFLINE / IN_GAME` is realtime/session runtime, not PostgreSQL.

DB MAY store `lastSeenAt`.

Presence fan-out SHOULD target relevant friends/room members rather than broadcasting every state change globally.

---

# 30. PLAYHTML INTEGRATION

The project MUST visibly use `playhtml.fun` capabilities for realtime multiplayer integration where appropriate.

Requirements:

- room-scoped realtime/shared state and/or events/presence;
- private account/profile/history data MUST remain in the application's own backend/PostgreSQL;
- PlayHTML browser identity MUST NOT replace authenticated account identity;
- server/application authority MUST remain the final validator for game-critical state;
- if a custom PlayHTML-compatible host is used, its deployment MUST preserve the same authority boundaries.

---

# 31. NETWORK PROTOCOL REQUIREMENTS

Protocol MUST provide:

- message identity/idempotency metadata;
- room/match identity;
- authenticated actor context;
- sequence/state-version metadata for ordered state transitions;
- typed command/event/error semantics;
- duplicate rejection/replay-safe behavior;
- out-of-order/stale-state rejection;
- snapshot and delta/event representation;
- explicit resync path;
- room isolation;
- read-only spectator authorization;
- rate limiting.

Client selection/hover MUST remain local and MUST NOT be broadcast as gameplay intent.

Accepted move is broadcast after server validation/commit.

---

# 32. SECURITY REQUIREMENTS

Server MUST NOT trust client claims for:

- side;
- turn;
- clock;
- piece owner/type/state;
- capture result;
- winner;
- Elo delta;
- room authorization;
- friendship/block relationship;
- active-game lock.

Passwords, private-room passwords, session tokens and Recovery Code verifier MUST use appropriate standard cryptographic libraries; no custom cryptography.

Internal error details MUST NOT be exposed to clients.

IP address MUST NOT be treated as a unique device identifier.

---

# 33. PERFORMANCE / LOAD REQUIREMENTS

No unconditional capacity number is a v0.1 requirement before benchmark.

Required load scenarios:

- concurrent Register/Login/Profile;
- Ranked matchmaking race/load;
- many active rooms;
- spectator fan-out at 1/10/50/100;
- many matches ending close together causing DB writes;
- snapshot vs delta/event comparison.

Network degradation scenarios:

- normal;
- 100 ms;
- 300 ms;
- 500 ms added latency;
- 0%; 5%; 10% packet/message loss as supported by test harness;
- disconnect/reconnect <30s;
- reconnect >30s;
- browser refresh/crash simulation.

Metrics:

- p50/p95 latency;
- throughput;
- error rate;
- CPU;
- RAM;
- active connections;
- DB latency;
- messages/sec and bytes/sec where relevant.

Tests MUST include ramp, sustained load, overload/stress and recovery after load decreases.

---

# 34. ACCEPTANCE STATUS

Implementation is acceptable for v0.1 only when:

```text
Requirements implemented
+
Protocol/contracts implemented
+
Critical automated tests pass
+
Network degradation evidence exists
+
Load/stress benchmark executed
+
Cross-document traceability is current
+
Public deployment/demo path works
```

---

# 35. FINAL SRS STATUS

```text
GAME RULES                = LOCKED
ACCOUNT / GUEST           = LOCKED
ROOM / MATCHMAKING        = LOCKED
TIMER / RECONNECT         = LOCKED
PROFILE / HISTORY         = LOCKED
FRIENDS / PRESENCE        = LOCKED
DATA / PERSISTENCE        = LOCKED
UI EDGE CASES             = LOCKED
CRITICAL TBD              = 0
DOCUMENT STATUS           = READY / FROZEN v0.1
```
