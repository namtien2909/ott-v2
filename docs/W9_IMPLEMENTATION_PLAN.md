# W9_IMPLEMENTATION_PLAN — Guest / AI / Offline

Status: IMPLEMENTED / VERIFIED

## Scope khóa từ `docs/task-div.md`

| Lane | Tasks | Deliverable |
| :--- | :--- | :--- |
| Person A | A21–A24 | Guest warning/name, local IndexedDB history/score, one-time import UX, local Normal AI, offline two-player và turn-handoff |
| Person B | B35 | Guest import validation, idempotency và local-history reconciliation |
| Person C | C23 | Isolation, import/warning/handoff acceptance tests |

## Quyết định kiến trúc

1. Guest, AI và Offline không phụ thuộc mạng để bắt đầu hoặc tiếp tục ván local. IndexedDB là primary storage; localStorage là fallback khi IndexedDB bị chặn.
2. Guest identity chỉ là profile cục bộ trên thiết bị. Không tạo user giả trên server và không đưa guest vào auth/session.
3. Lịch sử local dùng `localId` ổn định. API import yêu cầu session thật, validate payload, giới hạn kích thước và `@@unique([userId, localId])` để retry an toàn.
4. AI Normal chạy cùng `@ottv2/game-rules`; bot chọn legal move đầu tiên deterministic để demo/test không flaky. Offline chuyển lượt qua overlay ngắn khoảng 500ms.
5. Online match vẫn giữ server-authoritative path hiện tại. Local pages không gọi realtime và không hiển thị reconnect affordance.

## Thứ tự triển khai

1. Shared guest/import contract và Prisma migration.
2. Server import service/route với validation/idempotency.
3. Local storage adapter và API client.
4. Local game screen + routes + Home quick actions.
5. One-time import prompt trong History.
6. C23 unit/contract/UI isolation tests, typecheck/lint/build và runtime smoke.

## Gate W9

- `POST /guest/history/import` trả imported/skipped ổn định khi gửi lại cùng `localId`.
- Guest warning hiển thị đúng; local play vẫn hoạt động khi API offline.
- AI và Offline không phát sinh request realtime; offline handoff hiển thị khoảng 500ms.
- `pnpm test`, server/web typecheck, lint, build và migration status pass.

## Kết quả thực thi

- Added `GuestHistoryImport` Prisma model/migration `20260925220000_w9_guest_import` and authenticated `POST /guest/history/import`.
- Added shared Zod guest contract with bounded payload and server-side localId idempotency.
- Added IndexedDB-first local storage with localStorage fallback for guest profile, local score/history and one-time import decision.
- Added `/guest`, `/guest/play`, `/ai`, `/offline`; Home now links to all local modes. AI uses deterministic legal moves; Offline renders a 500ms handoff overlay and local pages never open realtime/reconnect flows.
- Added import prompt with explicit `Đồng bộ` / `Để sau`, loading and recoverable error states.
- Verification: root 38 tests, server 34 tests, web 14 tests; typecheck/lint/build pass; migration deploy pass; runtime smoke returned `/health` 200, UI routes 200, and import retry `1/0` then `0/1`.
