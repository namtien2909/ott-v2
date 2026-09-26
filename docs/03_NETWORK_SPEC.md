# 03_NETWORK_SPEC.md

# Network Protocol & Realtime Contract — OTTv2 Multiplayer v0.1

> **Status:** PROTOCOL READY / FROZEN v0.1  
> **Protocol model:** semantic contract independent of concrete transport API  
> **Realtime integration:** PlayHTML-compatible adapter + application authority  
> **Parents:** `SRS.md`, `02_ARCHITECTURE.md`

---

# 0. PROTOCOL PRINCIPLES

1. Server/application authority first.
2. Client sends intent, never authoritative state.
3. Every non-idempotent command has duplicate protection.
4. Match mutations are serialized.
5. Sequence/state version prevents stale application.
6. Room isolation is mandatory.
7. Snapshot + delta/event supports efficient sync and recovery.
8. Reconnect preserves active-game identity during grace.
9. Spectator is read-only.
10. Private account/profile data is not carried in public PlayHTML identity.

---

# 1. TRANSPORT MODEL

## 1.1 HTTP/control plane

Recommended for:

- authentication;
- registration/recovery;
- profile/history/friends;
- room create/search/join authorization;
- matchmaking control;
- health.

## 1.2 Realtime data plane

Used for:

- room membership/presence updates;
- ready/countdown;
- game commands/events;
- clocks;
- snapshots/deltas;
- reconnect state;
- spectator updates;
- room list updates when implemented as subscription.

The semantic messages below may be mapped onto WebSocket/PlayHTML events/shared state as implementation requires.

---

# 2. COMMON ENVELOPE

Canonical semantic envelope:

```json
{
  "protocolVersion": "0.1",
  "messageId": "uuid",
  "type": "PIECE_MOVE",
  "timestamp": 0,
  "roomId": "AZ72KQ",
  "matchId": "uuid",
  "actorId": "server-resolved",
  "sequence": 42,
  "stateVersion": 17,
  "payload": {}
}
```

Rules:

- `messageId` identifies command/event for duplicate handling.
- Client-provided `actorId` is never trusted as authorization; server resolves actor from session.
- `sequence` is server event/order sequence for a room/match stream.
- `stateVersion` identifies canonical state generation.
- Non-applicable fields may be omitted depending on schema.

---

# 3. COMMAND PROCESSING PIPELINE

```text
Transport Receive
→ Decode/Schema Validate
→ Session Authenticate
→ Authorization/Membership
→ Rate Limit
→ Idempotency/Duplicate Check
→ Sequence/State Preconditions
→ Serialized Domain Operation
→ Game/Application Validation
→ Canonical Commit
→ Event/Delta/Snapshot Emit
```

Any step may reject without mutating canonical state.

---

# 4. ERROR ENVELOPE

```json
{
  "code": "NOT_YOUR_TURN",
  "message": "Chưa đến lượt của bạn.",
  "retryable": false,
  "details": {}
}
```

Internal stack/database/security details MUST NOT be exposed.

Error severity:

- `RECOVERABLE`;
- `INVALID`;
- `FATAL_SESSION`.

---

# 5. ERROR CATALOG BASELINE

At minimum:

```text
UNAUTHORIZED
SESSION_INVALID
SESSION_REVOKED
RATE_LIMITED
USERNAME_TAKEN
INVALID_CREDENTIALS
INVALID_RECOVERY_CODE
ROOM_NOT_FOUND
ROOM_FULL
ROOM_PASSWORD_INVALID
ROOM_NOT_JOINABLE
INVITE_INVALID
INVITE_EXPIRED
INVITE_ALREADY_USED
ACTIVE_GAME_EXISTS
BROWSER_GAME_LOCKED (client/UI category)
MATCHMAKING_NOT_QUEUED
MATCHMAKING_ALREADY_QUEUED
MATCH_ALREADY_COMMITTED
NOT_ROOM_MEMBER
NOT_PLAYER
SPECTATOR_READ_ONLY
NOT_YOUR_TURN
INVALID_PIECE
INVALID_MOVE
OUT_OF_BOUNDS
FRIENDLY_BLOCK
SAME_TYPE_BLOCK
STALE_STATE
DUPLICATE_COMMAND
RESYNC_REQUIRED
PROTOCOL_VERSION_MISMATCH
STATE_SCHEMA_UNSUPPORTED
MATCH_ENDED
SERVER_INTERRUPTION
PERSISTENCE_DEGRADED
```

---

# 6. AUTH / SESSION API CONTRACT

## 6.1 Register

Request concept:

```json
{
  "fullName": "...",
  "displayName": "...",
  "username": "...",
  "password": "..."
}
```

Response includes account/profile bootstrap plus a one-time Recovery Code reveal.

Recovery Code MUST NOT be returned by ordinary profile reads later.

## 6.2 Login

Request: username/password/remember preference.

Response: public/self profile bootstrap; session is established through secure cookie/session mechanism.

## 6.3 Logout

If active match exists, UI requires explicit surrender confirmation before server completes gameplay logout flow.

## 6.4 Password recovery

```text
RECOVER_PASSWORD(username, recoveryCode, newPassword)
```

Success revokes prior sessions.

---

# 7. PROFILE / HISTORY API CONTRACT

Profile read variants:

- `GET_SELF_PROFILE` includes private self fields allowed by SRS.
- `GET_PUBLIC_PROFILE(userId|username)` excludes fullName/recovery/private settings.

History:

```text
GET_MATCH_HISTORY(cursor/page, limit<=20 baseline, filters)
GET_MATCH_DETAIL(matchId)
```

History result MUST respect authorization and pagination.

---

# 8. FRIEND / BLOCK PROTOCOL

Commands:

```text
SEARCH_USERS
SEND_FRIEND_REQUEST
ACCEPT_FRIEND_REQUEST
REJECT_FRIEND_REQUEST
CANCEL_FRIEND_REQUEST
REMOVE_FRIEND
BLOCK_USER
UNBLOCK_USER (optional UI but domain supported if block exists)
INVITE_FRIEND_TO_ROOM
ACCEPT_ROOM_INVITE
REJECT_ROOM_INVITE
```

Events:

```text
FRIEND_REQUEST_RECEIVED
FRIEND_REQUEST_UPDATED
FRIENDSHIP_CREATED
FRIENDSHIP_REMOVED
BLOCK_STATE_CHANGED
FRIEND_PRESENCE_CHANGED
ROOM_INVITE_RECEIVED
ROOM_INVITE_EXPIRED
```

Reciprocal request race MUST converge to one friendship.

---

# 9. PRESENCE CONTRACT

Presence enum:

```text
OFFLINE
ONLINE
IN_GAME
```

Presence is visible to friends only.

`IN_GAME` event MUST NOT include private Room ID for ordinary friend presence.

Presence updates are ephemeral and do not require durable replay.

---

# 10. ROOM LIST CONTRACT

Room-list item concept:

```json
{
  "roomId": "AZ72KQ",
  "name": "Neon Hammer 18",
  "players": 1,
  "playerCapacity": 2,
  "waitingPlayerRating": 1426,
  "mode": "UNRANKED",
  "visibility": "PUBLIC",
  "timerSeconds": 300,
  "spectators": 8,
  "spectatorCapacity": 50,
  "status": "WAITING"
}
```

Browse stream contains Public + WAITING only.

Events:

```text
ROOM_LIST_ADDED
ROOM_LIST_UPDATED
ROOM_LIST_REMOVED
```

---

# 11. CREATE ROOM CONTRACT

Command/API fields:

```text
name? <= 30 chars
visibility = PUBLIC | PRIVATE
password? = 1..12 chars only if PRIVATE
timerSeconds ∈ {30,60,300,600,1800,3600}
spectatorsEnabled
spectatorCapacity ∈ {1,2,5,10,50,100} when enabled
```

Server sets:

```text
mode = UNRANKED
roomId = generated 6-char active-unique ID
host = authenticated/guest creator
status = WAITING
```

Create operation MUST be idempotency-protected against double submit.

---

# 12. ROOM SEARCH / JOIN

`SEARCH_ROOM_BY_ID(roomId)` returns joinable metadata or semantic error.

Join command:

```text
JOIN_ROOM(roomId, password? | inviteToken?)
```

Server validates:

- room exists;
- role requested/derived;
- active-game lock;
- player capacity;
- spectator capacity;
- password/invite;
- block/invite eligibility where applicable.

Room ID alone is not authorization for Private room.

---

# 13. HOST MIGRATION

On Host leaving WAITING:

```text
HOST_CHANGED { oldHostId, newHostId }
```

If another player remains, server selects that remaining player.

No client election protocol exists.

---

# 14. READY / COUNTDOWN MESSAGES

Commands:

```text
PLAYER_READY
PLAYER_UNREADY (only before countdown if implementation allows)
COUNTDOWN_FAST_READY
```

Events:

```text
READY_STATE_CHANGED
SIDES_ASSIGNED
COUNTDOWN_STARTED { durationMs: 3000 }
COUNTDOWN_FAST_READY_CHANGED
GAME_START
```

If both fast-ready, server may emit `GAME_START` before countdown deadline.

BLUE is always currentTurn at `GAME_START`.

---

# 15. MATCH SNAPSHOT

Snapshot concept:

```json
{
  "matchId": "...",
  "status": "PLAYING",
  "mode": "RANKED",
  "bluePlayer": {"id":"...","displayName":"..."},
  "redPlayer": {"id":"...","displayName":"..."},
  "board": [],
  "pieceCounts": {},
  "currentTurn": "BLUE",
  "clock": {
    "blueRemainingMs": 300000,
    "redRemainingMs": 300000,
    "activeSide": "BLUE",
    "activeSinceServerTime": 0,
    "paused": false
  },
  "sequence": 0,
  "stateVersion": 1
}
```

Snapshot MUST be sufficient to reconstruct gameplay replica.

---

# 16. PIECE_MOVE COMMAND

Request payload:

```json
{
  "pieceId": "blue-r-1",
  "from": "b1",
  "to": "b2",
  "expectedStateVersion": 17
}
```

Server validates independently:

- sender is active Player;
- sender side owns piece;
- match is PLAYING;
- sender is current turn;
- state version is acceptable/current;
- `from` matches canonical piece location;
- one-square king movement;
- board bounds;
- friendly block;
- same-type enemy block;
- capture relation;
- timer not expired before accepted operation.

Client MUST NOT send capture/winner/remainingClock as authoritative values.

---

# 17. ACCEPTED MOVE EVENT

Example semantic event:

```json
{
  "type": "MOVE_COMMITTED",
  "sequence": 43,
  "stateVersion": 18,
  "payload": {
    "pieceId": "blue-r-1",
    "from": "b1",
    "to": "b2",
    "capturedPieceId": null,
    "pieceCounts": {},
    "previousTurn": "BLUE",
    "nextTurn": "RED",
    "clock": {},
    "result": null
  }
}
```

Opponent/spectator receives accepted committed move, not sender's pre-move selection/highlight.

---

# 18. MOVE REJECTION

Rejected move returns `ERROR`/`MOVE_REJECTED` semantic code.

Rejection MUST NOT:

- change board;
- change turn;
- reset/switch clock;
- increment canonical stateVersion as if a move committed.

It MAY increment diagnostic counters but not game state.

---

# 19. CLOCK EVENTS

Clock state is primarily derived from authoritative snapshot/event timestamps.

Relevant events:

```text
CLOCK_PAUSED
CLOCK_RESUMED
TURN_CHANGED
TIMEOUT
```

No requirement to broadcast every visual countdown tick.

Client interpolates display from server state.

---

# 20. GAME OVER

```json
{
  "type": "GAME_OVER",
  "payload": {
    "winnerId": "... or null",
    "loserId": "... or null",
    "reason": "EXTINCTION|GOAL_REACHED|TIMEOUT|SURRENDER|DISCONNECT_TIMEOUT|ABORTED|SERVER_INTERRUPTION",
    "ranked": true,
    "rating": {
      "before": 1000,
      "after": 1016,
      "delta": 16
    }
  }
}
```

For `ABORTED`/`SERVER_INTERRUPTION`, winner/loser may be null and rating delta is zero/not applicable.

---

# 21. SURRENDER

Command:

```text
SURRENDER_MATCH
```

UI confirmation occurs client-side before sending.

Server verifies player/match status and finalizes opponent win exactly once.

Logout/navigation that intentionally surrenders maps to same domain operation.

---

# 22. REMATCH

Commands/events:

```text
REMATCH_REQUEST
REMATCH_ACCEPT
REMATCH_REJECT
REMATCH_STARTED
```

On accepted rematch:

- match identity SHOULD be new;
- board reset;
- sides swapped;
- rating mode = UNRANKED;
- both active-game participants remain locked to this new match;
- READY/countdown policy follows product flow as implemented consistently.

---

# 23. DISCONNECT / RECONNECT PROTOCOL

Events:

```text
PLAYER_CONNECTION_LOST
MATCH_PAUSED_FOR_RECONNECT
PLAYER_RECONNECTED
MATCH_RESUMED
RECONNECT_GRACE_EXPIRED
```

On disconnect:

- mark player reconnecting;
- pause both clocks;
- preserve match/account lock;
- grace duration = 30,000 ms.

On reconnect:

1. validate session/account/match;
2. restore room/match membership;
3. send replay if safe and available, otherwise full snapshot;
4. verify client stateVersion;
5. resume.

---

# 24. RESYNC

Client may send:

```text
RESYNC_REQUEST { lastSequence, stateVersion }
```

Server may respond with:

- missing event replay; or
- `STATE_SNAPSHOT`.

Client MUST discard/avoid applying stale state over newer committed state.

---

# 25. DUPLICATE / IDEMPOTENCY

Non-idempotent commands MUST use `messageId`/operation id.

Duplicate command behavior:

- never reapply mutation;
- return prior outcome when safely cached/known; or
- return deterministic duplicate acknowledgement/error.

Critical duplicates include:

- Create Room;
- Join Player;
- Matchmaking queue/commit interactions;
- PIECE_MOVE;
- Surrender;
- Rematch accept;
- Friend request/accept;
- Match End persistence.

---

# 26. OUT-OF-ORDER / STALE STATE

If command expected version is stale and operation cannot be safely interpreted:

```text
STALE_STATE
→ RESYNC_REQUIRED
```

Server sequence is monotonic within the defined stream scope.

Client MUST NOT apply event with sequence/stateVersion older than its current canonical replica unless replay algorithm explicitly expects it.

---

# 27. MATCHMAKING PROTOCOL

Commands:

```text
JOIN_RANKED_QUEUE
JOIN_UNRANKED_QUEUE
CANCEL_QUEUE
```

Events:

```text
QUEUE_JOINED
QUEUE_RANGE_UPDATED (optional UI)
MATCH_FOUND
QUEUE_CANCELLED
```

Atomic invariant:

```text
QUEUED → MATCH_COMMITTED
```

Once committed, late `CANCEL_QUEUE` cannot dismantle the match and must return `MATCH_ALREADY_COMMITTED` or equivalent.

---

# 28. ACTIVE GAME LOCK ERRORS

If account attempts second match:

```text
ACTIVE_GAME_EXISTS
```

Same-browser second gameplay tab SHOULD be rejected locally before server join where possible, but server lock is still checked.

Browser non-game pages remain accessible.

---

# 29. SPECTATOR PROTOCOL

Join role:

```text
role = SPECTATOR
```

Server validates spectator policy/capacity/access.

Spectator receives:

- snapshot;
- committed moves/events;
- clock state;
- result;
- relevant room presence.

Spectator sending `PIECE_MOVE`, Ready or Surrender MUST receive `SPECTATOR_READ_ONLY`/authorization error.

---

# 30. ROOM INVITE TOKEN

Token semantic claims:

```text
roomId
targetUserId
expiresAt
nonce/single-use id
```

Token does not carry plaintext room password.

Accept operation consumes single-use token only after validation path is safely committed.

---

# 31. SERVER INTERRUPTION

If server process loses active match state:

Client-facing recovery outcome is semantic `SERVER_INTERRUPTION`.

Rules:

- no Ranked Elo change;
- release/reset stale game locks;
- do not invent winner based on board advantage;
- user may join a new match after cleanup.

---

# 32. PERSISTENCE EVENT CONTRACT

At Match End application generates idempotent result event conceptually:

```json
{
  "matchId": "uuid",
  "mode": "RANKED",
  "resultReason": "GOAL_REACHED",
  "participants": [],
  "ratingInputs": {},
  "startedAt": 0,
  "endedAt": 0
}
```

Persistence processor:

- attempts immediate write;
- uses DB transaction;
- on transient failure enqueue bounded retry;
- duplicate `matchId` cannot double-apply rating.

Persistence state is not required to block client from seeing finalized game result indefinitely.

---

# 33. GUEST IMPORT CONTRACT

Command/API:

```text
IMPORT_GUEST_HISTORY(importBatchId, guestMatchSummaries, guestStats)
```

Rules:

- authenticated newly registered account;
- one-time prompt semantics are client/account state;
- server validates shape/limits;
- `importBatchId` and/or guestMatchId provides idempotency;
- official account Elo remains 1000 regardless of Guest Score.

---

# 34. RATE LIMITING

Separate scopes:

- auth/login/recovery;
- HTTP request abuse;
- realtime messages;
- game commands;
- friend request spam;
- room search/create/join abuse.

Exact numeric thresholds MAY be tuned from testing; protocol behavior on throttle is explicit `RATE_LIMITED` with retry guidance when appropriate.

---

# 35. ROOM ISOLATION

A Room A client MUST NOT receive:

- Room B snapshot;
- Room B private membership;
- Room B private invite/password data;
- Room B game events.

Room ID knowledge alone grants no authority.

---

# 36. VERSIONING

`protocolVersion = 0.1` baseline.

Protocol version and state schema version may evolve independently.

Unsupported version must fail explicitly; no silent downgrade.

---

# 37. PROTOCOL TEST CONTRACT

Contract tests must verify:

```text
Schema / typed model / serialized message
```

and at minimum:

- duplicate handling;
- stale state;
- invalid role;
- spoofed identity;
- cross-room leakage prevention;
- reconnect/resync;
- spectator write rejection;
- match-ending idempotency;
- reciprocal friend-request race;
- matchmaking cancel/commit race.

---

# 38. FINAL PROTOCOL STATUS

```text
TURN MODEL                  = TURN-BASED ONLY
SERVER AUTHORITY            = LOCKED
ROOM / MATCH / SOCIAL MSG   = DEFINED
SNAPSHOT / DELTA / RESYNC   = DEFINED
DUPLICATE / ORDERING        = DEFINED
RECONNECT                   = 30s
CRITICAL PROTOCOL TBD       = 0
STATUS                       = PROTOCOL FROZEN v0.1
```
