# W11_IMPLEMENTATION_PLAN — UI Conformance / Telemetry / Performance

Status: IMPLEMENTED / VERIFIED

## Scope khóa từ `docs/task-div.md`

| Lane | Tasks | Deliverable |
| :--- | :--- | :--- |
| Person A | A27 | UI-spec conformance audit: screen states, accessibility, responsive, reduced motion, sound, copy, assets, performance và UI↔network mapping |
| Person B | B37 | Metrics, diagnostic hooks, UI network-state telemetry và performance budgets |
| Person C | C26–C29, C32 | Network degradation, auth/matchmaking/load, DB burst/recovery, snapshot-vs-delta benchmark và acceptance evidence |

## Quyết định triển khai

1. Metrics là in-process diagnostic registry, không làm thay đổi authority của match/room. Registry giữ sample bounded theo route, p95 và active SSE; endpoint `/diagnostics/metrics` phục vụ local evidence.
2. HTTP client phát `CONNECTED`, `OFFLINE`, `DEGRADED` và UI telemetry event có method/path/status/duration. App shell render riêng trạng thái `DEGRADED`.
3. Snapshot-vs-delta benchmark dùng cùng payload contract hiện tại, đo kích thước serialized và thời gian lặp local; không giả lập con số network.
4. UI audit được ghi thành acceptance matrix có evidence route/state/accessibility/performance; không mở rộng sang deploy của W12.

## Thứ tự triển khai

1. Shared metrics contract và server MetricsRegistry/hooks/diagnostic endpoint.
2. Match/SSE active-stream instrumentation.
3. Frontend network degradation + telemetry events.
4. Performance/load/DB recovery tests và benchmark report.
5. UI-spec acceptance matrix, full gate và runtime smoke.

## Gate W11

- `/diagnostics/metrics` trả metrics hợp lệ, request latency/error và active streams có bounded sample.
- UI phân biệt CONNECTED/RECONNECTING/OFFLINE/DEGRADED và phát telemetry cho request.
- C26–C29/C32 evidence pass, snapshot/delta và board budget không vượt ngưỡng local.
- Không làm hỏng W0–W10: full tests, typecheck, lint, build và DB status pass.

## Kết quả thực thi

- Added shared metrics contract, bounded in-process `MetricsRegistry`, request hooks and `/diagnostics/metrics` with request count/error count/average/p95/active SSE/fan-out counters.
- Instrumented player and spectator SSE streams; frontend HTTP client now emits request telemetry and distinguishes CONNECTED/RECONNECTING/OFFLINE/DEGRADED. App shell shows a dedicated degraded banner.
- Added C26–C29 evidence: HTTP loss/degradation tests, 100-room + matchmaking local load, 100-record DB burst retry recovery, and snapshot-vs-delta serialization/render budget test.
- Added C32/A27 acceptance evidence in [W11_UI_SPEC_ACCEPTANCE_MATRIX.md](W11_UI_SPEC_ACCEPTANCE_MATRIX.md).
- Verification: root 41 tests, server 41 tests, web 15 tests; typecheck/lint/build pass; database schema up to date; runtime `/health` and `/diagnostics/metrics` both return 200.
