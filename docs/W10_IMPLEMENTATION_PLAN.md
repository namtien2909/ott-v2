# W10_IMPLEMENTATION_PLAN — Spectator

Status: IMPLEMENTED / VERIFIED

## Scope khóa từ `docs/task-div.md`

| Lane | Tasks | Deliverable |
| :--- | :--- | :--- |
| Person A | A25 | Spectator route, read-only Game Room, canonical BLUE-bottom orientation, capacity/denied/error states |
| Person B | B36 | Spectator authorization, read-only snapshot/event stream và fan-out |
| Person C | C24–C25 | Capacity/read-only/canonical tests, fan-out benchmark evidence for 1/10/50/100 listeners |

## Quyết định kiến trúc

1. Spectator là session đã xác thực, không phải room member và không nhận active-game lock.
2. `POST /rooms/:roomId/spectate` là authorization gate; private room vẫn yêu cầu password nếu viewer không phải member. `GET /matches/:roomId/spectator/events` chỉ phát snapshot/committed events/clock/result.
3. Spectator listener nằm trong fan-out lane riêng của `MatchManager`; API command routes tiếp tục đi qua `memberRoom`, vì vậy spectator không thể Ready/Move/Surrender/Rematch.
4. UI dùng canonical `viewSide=BLUE`, `disabled=true`, không legal highlight, không gameplay CTA. Capacity/disabled/private-denied được hiển thị thành state có hướng dẫn tiếp theo.
5. Benchmark C25 đo thời gian phát event tới 1/10/50/100 listeners bằng in-process harness, không làm giả network latency.

## Thứ tự triển khai

1. Shared spectator contract và RoomManager authorization/capacity lifecycle.
2. MatchManager spectator fan-out và read-only SSE route.
3. Web spectator API/page/route và Room Card CTA.
4. Unit/contract/integration tests + fan-out benchmark.
5. Migration/status không đổi vì spectator state là ephemeral trong room/match memory.

## Gate W10

- Public spectator có thể authorize; private/password, disabled và full-capacity bị chặn đúng.
- Spectator nhận snapshot và committed events, không có write controls/active lock.
- Board luôn canonical BLUE-bottom, disabled và không legal highlight.
- Fan-out benchmark có số liệu 1/10/50/100 listeners và không làm chậm writer lane quá budget local.

## Kết quả thực thi

- Added spectator contract, `POST /rooms/:roomId/spectate`, `POST /rooms/:roomId/spectate/leave`, read-only snapshot and SSE endpoints under `/matches/:roomId/spectator*`.
- RoomManager now enforces enabled/private/password/capacity policy and exposes only public player identity to an authorized spectator. Spectator never acquires active-game lock.
- MatchManager has a separate spectator listener lane; committed snapshots, moves, clock ticks and results fan out without exposing command handlers.
- Added `/spectate/:roomId`, Room Card `Xem trận`, password/denied/full-capacity states and canonical disabled board with BLUE bottom orientation.
- Verification: root 39 tests, server 38 tests, web 14 tests; typecheck/lint/build pass. Runtime smoke: spectator access 200, snapshot role `SPECTATOR`, viewer side `null`, two players visible, capacity denial 409, Ready write attempt 403. Fan-out 1/10/50/100 listener harness passes under 100ms local budget.
