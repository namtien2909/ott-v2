# W8_IMPLEMENTATION_PLAN — Social, Presence & Invite

## Trạng thái

`IMPLEMENTED / VERIFIED` — phạm vi lấy từ `docs/task-div.md`: A19–A20, B32–B34, C21–C22.

## Contract khóa trước khi code

| Lane | Task | Acceptance |
| :--- | :--- | :--- |
| A | A19 | `/friends` có 4 tab, search debounce, friend card, incoming/sent requests, remove/block và competitive-safe profile actions |
| A | A20 | Friend-only presence (`OFFLINE/ONLINE/IN_GAME`), targeted invite modal, expiry/error/single-use states |
| B | B32 | Friendship/request/block domain, reciprocal request convergence, privacy boundaries |
| B | B33 | Ephemeral presence fan-out, SSE event `FRIEND_PRESENCE_CHANGED`, non-friend không thấy status/room id |
| B | B34 | Room-bound invite token TTL, single-use consume sau join commit, blocked/non-member/expired denial |
| C | C21 | Social race, reciprocal request, limits/privacy và friend-only presence tests |
| C | C22 | Invite expiry/single-use/stale-room tests và UI state contract |

## API/event contract

- `GET /social/friends`
- `GET /social/search?q=`
- `GET /social/requests?direction=incoming|sent`
- `POST /social/requests/:requestId/accept|reject|cancel`
- `DELETE /social/friends/:userId`
- `POST|DELETE /social/blocks/:userId`
- `GET /social/blocks`
- `GET /social/presence/events` (SSE)
- `GET /social/invites`
- `POST /social/invites`, `POST /social/invites/:token/accept`, `POST /social/invites/:token/reject`

Event names follow `03_NETWORK_SPEC.md`: `FRIEND_REQUEST_RECEIVED`, `FRIEND_REQUEST_UPDATED`, `FRIENDSHIP_CREATED`, `FRIENDSHIP_REMOVED`, `BLOCK_STATE_CHANGED`, `FRIEND_PRESENCE_CHANGED`, `ROOM_INVITE_RECEIVED`, `ROOM_INVITE_EXPIRED`.

## Reliability/privacy rules

1. Friendship is stored as a normalized pair, so reciprocal requests converge to one friendship.
2. Request/block mutations are idempotent where possible and never expose private profile fields.
3. Presence is ephemeral and only fan-outs to current friends; `IN_GAME` never includes a private room ID.
4. Invite token is random, room-bound, target-bound, expires after five minutes and is consumed only after a successful room join.
5. `CONSUMING` state closes concurrent accept races; failed join returns token to `ACTIVE`.

## Verification gate

- Prisma migration deployed and schema generated.
- Server social/presence/invite unit tests pass.
- Web typecheck/lint/build and Friends UI tests pass.
- Root regression tests pass.
- Runtime smoke: two users become friends, see presence, send/accept invite, invite expires/single-use rejects, blocked user is hidden.

## Kết quả thực thi

- Migrations `20260925210000_w8_social` and `20260925211000_w8_social_pair_key`: applied; PostgreSQL schema generated successfully.
- Server: typecheck pass; 33/33 tests pass, including presence privacy and reciprocal-key coverage.
- Web: Friends route/API, four tabs, search debounce, request actions, block confirmation, invite modal and presence updates implemented.
- Web tests: 14/14 pass; typecheck/lint/build pass.
- Root regression: 37/37 tests pass; root typecheck/lint pass.
- Runtime smoke: two accounts → friend request accept → friend list → private room invite → accept; second token consume returns 404; blocked target disappears from search.
- Reciprocal request smoke: opposite-direction requests converge to one friendship via the canonical `pairKey`.
- Runtime: API `http://localhost:3001`; frontend `http://localhost:3000`.
