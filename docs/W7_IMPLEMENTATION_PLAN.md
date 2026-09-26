# W7_IMPLEMENTATION_PLAN — Persistence & History

## Trạng thái

`IMPLEMENTED / VERIFIED` — phạm vi lấy nguyên văn từ `docs/task-div.md`, không mở rộng sang W8+.

## Phạm vi đã khóa từ task-div.md

| Lane | Task | Đầu ra bắt buộc |
| :--- | :--- | :--- |
| Person A | A18 | `/history` có rating, win rate, Ranked/Unranked/Guest/AI/Offline + Win/Loss + 7 ngày/30 ngày/Tất cả, load-more 20 bản ghi, Match Detail và loading/empty/error |
| Person B | B28 | Prisma `Match`/`MatchPlayer`, repository/projection fields cho mode, players, winner, reason, timer, started/ended/duration, rating |
| Person B | B29 | Match End transaction idempotent theo `matchId`, không ghi trùng player/result; retry-safe |
| Person B | B30 | Retry queue in-process khi DB tạm lỗi, flush nền và không làm mất kết quả authoritative |
| Person B | B31 | Authenticated history list/filter/pagination và match detail API; privacy chỉ trả các trận có viewer tham gia |
| Person C | C18 | Transaction/idempotency persistence tests + History/Match Detail UI states |
| Person C | C19 | DB outage/retry/burst tests + degraded UI/error recovery |
| Person C | C20 | History filter/pagination/detail tests |

## Nguyên tắc triển khai

1. `MatchSnapshot` vẫn là nguồn sự thật online; PostgreSQL là projection lâu dài sau khi match kết thúc.
2. `matchId` là idempotency key. Ghi lại một lần bằng primary key, retry cùng snapshot chỉ đọc/merge bản ghi đã có.
3. Lỗi DB khi persist không làm đảo ngược kết quả trận. Snapshot được đưa vào retry queue và UI nhận trạng thái degraded/error có thể thử lại.
4. History chỉ query những trận mà user hiện tại là một `MatchPlayer`; không lộ dữ liệu trận của user khác.
5. Pagination mặc định 20 item, cursor theo `matchId`, sort `endedAt DESC`.
6. Filter mode/result/range dùng cùng enum trong shared contracts để UI không tự suy đoán giá trị.
7. Không triển khai replay trong v0.1; detail chỉ là dossier kết quả theo UI spec.

## Trình tự thực thi

### Bước 1 — Contract & schema

- Thêm `HistoryMode`, `HistoryResult`, `HistoryRange`, query/list/detail schemas vào `packages/contracts`.
- Bổ sung timestamp lifecycle nullable vào match snapshot để projection giữ started/ended/duration.
- Thêm Prisma `Match` và `MatchPlayer`, migration W7, generate/deploy.

### Bước 2 — Backend persistence

- Tạo `MatchHistoryService`: map snapshot → Match/MatchPlayer projection, transaction idempotent, queue retry và `flush()`.
- Gọi service sau move/surrender/timeout/abort; rating được finalize trước khi projection ghi nếu có thể.
- Đăng ký `GET /history`, `GET /history/:matchId`, parse/validate query và enforce viewer membership.

### Bước 3 — Frontend History

- Tạo history API client typed theo contracts.
- Thay placeholder bằng History overview responsive: summary, chips, cards, load more, empty/error/loading.
- Match Detail mở từ card và hoạt động trực tiếp với `/history/:matchId`; neutral interruption không hiển thị như win/loss.

### Bước 4 — Verification

- Unit: projection/result mapping, cursor/filter và idempotency helper.
- Integration: persistence duplicate, DB outage queue/flush và privacy boundary.
- Web tests: filter, load-more, detail, empty/error states.
- Gate: typecheck, lint, build, all Vitest, Prisma status, API smoke và UI smoke trên `localhost:3000`/`localhost:3001`.

## Acceptance matrix

| Gate | Điều kiện pass |
| :--- | :--- |
| Data | Match/MatchPlayer migration deployed; match end duplicate không tạo row thứ hai |
| Reliability | DB fail → queue giữ snapshot; DB hồi phục → flush ghi đúng một lần |
| API | list/detail trả contract hợp lệ, filter 20/cursor hoạt động, user khác không truy cập được |
| UI | Có đủ loading/empty/error, filter mode/result/range, card subtle Win/Loss, detail fields theo spec |
| Regression | W0–W6 tests và build/typecheck/lint vẫn pass |

## Kết quả thực thi

- Prisma migration `20260925200000_w7_history`: applied; `db:status` báo schema up to date.
- Server: typecheck pass; 30/30 tests pass.
- Web: typecheck pass; lint pass; 14/14 tests pass; production build pass.
- Workspace: root `pnpm test` pass 36/36; root typecheck/lint pass.
- Local smoke: tạo 2 tài khoản → tạo/join room → ready → surrender → Match/MatchPlayer projection → `GET /history` và `GET /history/:matchId` trả đúng `UNRANKED`, `LOSS`, `ratingDelta=null`.
- Reliability: unit evidence xác nhận DB outage đưa snapshot vào retry queue, recovery flush đúng một lần; duplicate `matchId` không tạo row thứ hai; detail từ user ngoài trận trả `NOT_FOUND`.
- Runtime: API `http://localhost:3001`; frontend `http://localhost:3000`.
