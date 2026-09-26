# 1. Tổng quan dự án

OTTv2 v0.1 là web game Oẳn Tù Tì chiến thuật 9×9, tập trung chứng minh năng lực lập trình mạng:

*   Frontend web tiếng Việt, desktop-first.
*   Backend Node.js/TypeScript theo modular monolith.
*   PostgreSQL + Prisma cho dữ liệu lâu dài.
*   PlayHTML/realtime adapter cho room, match, presence và spectator.
*   Server là nguồn sự thật duy nhất cho trận Online.
*   Game theo lượt, BLUE luôn đi trước.
*   Đồng hồ riêng cho mỗi người chơi, do server quản lý.
*   Reconnect trong 30 giây và pause cả hai đồng hồ.
*   Ranked matchmaking, Elo, History, Profile.
*   Friends, Presence, Block và Invite.
*   Guest, AI, Offline.
*   Spectator read-only.
*   Kiểm thử race condition, degradation, load, database failure và restart.
*   Deploy công khai kèm bằng chứng benchmark.
*   `06_FRONTEND_UI_SPEC.md` là nguồn sự thật cho route, shell, design system, screen state, responsive, accessibility, motion, sound và UI↔network mapping.

Phần khó nhất không phải UI mà là bảo đảm các invariant:

*   Client không phải authority
*   Realtime transport không chứa game rules
*   Room khác Match
*   Live match không phụ thuộc DB theo từng nước đi
*   Mỗi account chỉ có một active game
*   Duplicate/stale/out-of-order không làm hỏng state
*   Reconnect luôn hội tụ về canonical state
*   Match End và Elo không được ghi hai lần

# 2. Đánh giá mục tiêu hoàn thành trong hôm nay

Toàn bộ phạm vi v0.1 trong tài liệu tương đương một sản phẩm nhiều tuần nếu bắt đầu từ repository trống. Hoàn thành tuyệt đối, production-ready, có benchmark đầy đủ trong một ngày là rủi ro rất cao.

Cách khả thi nhất là triển khai theo hai ngưỡng:

1.  **Demo-safe core:** Online match, Auth, Room, realtime, reconnect, matchmaking, persistence, test critical và deploy.
2.  **Full v0.1:** thêm toàn bộ Social, Guest import, AI, Offline, Spectator, load/failure report và UX hoàn chỉnh.

Ta vẫn giữ nguyên phạm vi frozen, nhưng phải ưu tiên critical path trước. Không làm visual polish tách rời core; các yêu cầu UI bắt buộc của `06_FRONTEND_UI_SPEC.md` được khóa sớm ở A00–A01 và kiểm toán hoàn chỉnh ở A27/C32 trước deploy.

# 3. Bảng nhiệm vụ Person A — Game Experience Builder

| ID | Phase | Nhiệm vụ | Phụ thuộc | Mức độ |
| :--- | :--- | :--- | :--- | :--- |
| A00 | 0 | Khởi tạo web app, canonical route map theo UI spec (`/`, `/login`, `/register`, `/forgot-password`, `/home`, `/queue`, `/room/:roomId`, `/game/:roomId`, `/history`, `/history/:matchId`, `/profile/:username`, `/friends`, `/settings`) và app shell; giữ alias tương thích nếu cần | Shared contracts skeleton | Dễ |
| A01 | 0 | Design-system foundation: dark/light/system tokens, typography, responsive breakpoints, loading/empty/error, modal/toast, focus/accessibility, reduced-motion và sound/settings hooks | A00 | Dễ |
| A02 | 1 | Render bàn cờ 9×9 từ fixture + tactical full-bodied piece token, goal tile và semantic piece labels | Game types | Trung bình |
| A03 | 1 | BLUE/RED rotation, canonical coordinate labels, goal ownership và spectator canonical orientation | A02 | Trung bình |
| A04 | 1 | Selection, legal/capture-target distinction, local feedback và assistive labels | A02, rule helpers | Trung bình |
| A05 | 2 | Login/Register/Forgot Password UI theo screen contract, show/hide password, confirm password, inline validation/loading/error | Auth contract | Trung bình |
| A06 | 2 | Recovery Code one-time UI với explicit acknowledgement, Profile own/other dossier, Settings tabs/password/privacy/theme/reduced-motion/sound và unsaved-change guard | A05, backend auth | Trung bình |
| A07 | 3 | Compact Homepage hero, 3 quick actions, guest/account semantics, guest warning và global network status | A01 | Dễ |
| A08 | 3 | Room grid 4×2, Room Card, Empty State, responsive variants và room-list event reactions | A07, room contract | Dễ |
| A09 | 3 | Create Room tactical modal, explicit Room ID search, private inline password flow, clipboard success, loading/error/duplicate-submit states | A08, backend room API | Trung bình |
| A10 | 4 | Game Room player HUDs, minimal Game Header, board connection và `/game/:roomId` route | A03, realtime contract | Khó |
| A11 | 4 | Ready, countdown, fast-ready, clocks, turn indicator và low-time urgency states | A10, server timer | Khó |
| A12 | 4 | Move submission, authoritative accepted/rejected feedback, legal/capture animation và canonical state-first rendering | A10, match events | Khó |
| A13 | 4 | Surrender, neutral Result UI, rematch, in-game settings và active-match leave guard | A10, match result | Trung bình |
| A14 | 5 | Reconnect overlay, refresh recovery, connection states và stale-data/unsafe-action behavior | A10, reconnect server | Khó |
| A15 | 5 | Same-browser lock, cross-tab notification, session-expired modal và global network banner | A00 | Trung bình |
| A16 | 6 | Quick Match queue/cancel UI, expanding rating range, Match Found cinematic và guest/account mode semantics | Matchmaking API | Trung bình |
| A17 | 6 | Ranked result Elo display, match-found/player comparison và neutral server-interruption result | A13, rating result | Dễ |
| A18 | 7 | History overview, Ranked/Unranked/Guest/AI/Offline filters, load-more, match detail và empty/error states | History API | Trung bình |
| A19 | 8 | Friends/search/request/block UI, other-user competitive profile dossier và privacy-safe actions | Social API | Trung bình |
| A20 | 8 | Presence preview, friend-only presence rules và targeted invite popup/expiry states | Realtime presence | Khó |
| A21 | 9 | Guest name entry, guest warning và IndexedDB history/score | A00 | Trung bình |
| A22 | 9 | One-time guest import prompt, decline persistence và import error/loading states | A21, import API | Trung bình |
| A23 | 9 | Local Normal AI setup, bot HUD, timer selection và no-reconnect presentation | Shared game rules | Trung bình |
| A24 | 9 | Offline hai người, local setup và ~500ms turn-handoff overlay | Shared game rules | Trung bình |
| A25 | 10 | Spectator flow, read-only Game Room, canonical orientation, capacity/denied states | A10, spectator backend | Trung bình |
| A26 | 12 | Production config, canonical-route/responsive sanity, public URL smoke và deploy | Các tính năng cần demo | Trung bình |
| A27 | 11 | Frontend UI-spec conformance audit: design system, screen contracts, state matrix, accessibility, reduced motion, sound, copy, assets, performance và UI↔network event map | A01, A05–A25, B14, B37 | Khó |

# 4. Bảng nhiệm vụ Person B — Backend / Network / Data

| ID | Phase | Nhiệm vụ | Phụ thuộc | Mức độ |
| :--- | :--- | :--- | :--- | :--- |
| B00 | 0 | Khởi tạo server, config/env validation | Repo bootstrap | Dễ |
| B01 | 0 | Health endpoint và error envelope | B00 | Dễ |
| B02 | 0 | Prisma, PostgreSQL và migration workflow | B00 | Trung bình |
| B03 | 0 | HTTP/realtime adapter skeleton + room/match/global network-state event channels | B00, contracts | Trung bình |
| B04 | 1 | Pure authoritative Game Engine | Shared game types | Khó |
| B05 | 1 | Board setup, moves, capture, victory, turns | B04 | Khó |
| B06 | 2 | User/Profile/Stats/Session schema | B02 | Trung bình |
| B07 | 2 | Register/Login/Logout và password hashing | B06 | Khó |
| B08 | 2 | Recovery Code, revoke session, throttling | B07 | Khó |
| B09 | 2 | Profile/settings APIs | B06, B07 | Trung bình |
| B10 | 3 | Room ID/name generation, Room Manager và authoritative room-list event source | B03 | Khó |
| B11 | 3 | Public/Private room, password verifier, timer/spectator constraints | B10 | Trung bình |
| B12 | 3 | Browse/search/join/idempotency + ROOM_CREATED/UPDATED/REMOVED event mapping | B10, B11 | Khó |
| B13 | 3 | Host migration, room cleanup và authoritative room-list removal/update events | B10 | Trung bình |
| B14 | 4 | Protocol envelope/schema validation + stable UI-facing event and error names | Shared contracts | Trung bình |
| B15 | 4 | Match state store và serialized command lane | B05, B14 | Khó |
| B16 | 4 | Ready, side assignment và countdown | B15 | Khó |
| B17 | 4 | Authoritative Timer Service | B15 | Khó |
| B18 | 4 | PIECE_MOVE validation và commit pipeline | B05, B15, B17 | Rất khó |
| B19 | 4 | Snapshot, delta, sequence, stateVersion | B15, B18 | Rất khó |
| B20 | 4 | Match End, surrender, rematch và neutral server-interruption result | B18 | Khó |
| B21 | 5 | Disconnect detection, 30s grace và PLAYER_DISCONNECTED/RECONNECTED events | B17, B19 | Rất khó |
| B22 | 5 | Reconnect membership, refresh recovery và STATE_RESYNC contract | B19, B21 | Rất khó |
| B23 | 5 | Account active-game lock, same-browser/cross-tab authority handshake | Auth, room/match | Khó |
| B24 | 5 | Stale-lock, session-expired và server-interruption cleanup | B23 | Khó |
| B25 | 6 | Ranked/Guest queues, Elo-range widening và MATCH_FOUND state contract | B23 | Khó |
| B26 | 6 | Atomic pairing và cancel/commit race | B25 | Rất khó |
| B27 | 6 | Elo service và Ranked result transaction | B20, persistence | Khó |
| B28 | 7 | Match/MatchPlayer schema, repositories và history projection fields | B02, B06 | Trung bình |
| B29 | 7 | Idempotent Match End transaction | B27, B28 | Rất khó |
| B30 | 7 | Retry queue khi DB lỗi | B29 | Khó |
| B31 | 7 | History/filter/pagination/detail APIs for Ranked/Unranked/Guest/AI/Offline | B28 | Trung bình |
| B32 | 8 | Friendship/request/block domain + privacy boundaries | B06 | Khó |
| B33 | 8 | Presence fan-out with friend-only visibility and UI event mapping | B03, B32 | Khó |
| B34 | 8 | Targeted invite token, expiry/single-use and room-bound authorization | B10, B32, B33 | Khó |
| B35 | 9 | Guest import validation/idempotency and local-history reconciliation | B28 | Trung bình |
| B36 | 10 | Spectator authorization, read-only snapshots and fan-out | B19 | Khó |
| B37 | 11 | Metrics, diagnostic hooks, UI network-state telemetry and performance budgets | Server modules | Trung bình |
| B38 | 12 | Production DB/backend/realtime deployment + canonical frontend route/CORS/base-url validation | Core backend hoàn tất | Khó |

# 5. Bảng nhiệm vụ Person C — Integration / QA / Performance

| ID | Phase | Nhiệm vụ | Phụ thuộc | Mức độ |
| :--- | :--- | :--- | :--- | :--- |
| C00 | 0 | Khởi tạo unit/integration/E2E test structure + Playwright screen harness | Repo bootstrap | Dễ |
| C01 | 0 | CI commands và test scripts | C00 | Dễ |
| C02 | 0 | Multi-client harness skeleton + browser/session context helpers | Contracts, server skeleton | Trung bình |
| C03 | 1 | Game setup và movement tests | B04/B05 | Trung bình |
| C04 | 1 | Capture, victory và turn tests | B05 | Trung bình |
| C05 | 2 | Auth validation/session/recovery tests | B07/B08 | Trung bình |
| C06 | 2 | Public/private profile separation tests | B09 | Trung bình |
| C07 | 3 | Room lifecycle/visibility tests + ROOM_CREATED/UPDATED/REMOVED UI event expectations | B10–B13 | Trung bình |
| C08 | 3 | Duplicate create/join, private-error and cross-room isolation tests | B12 | Khó |
| C09 | 4 | Protocol/schema contract tests + network-event-to-UI mapping | B14 | Trung bình |
| C10 | 4 | Two-client convergence E2E + Game Room/HUD state assertions | A10, B18/B19 | Rất khó |
| C11 | 4 | Duplicate/stale/out-of-order tests + animation/state-authority assertions | B18/B19 | Khó |
| C12 | 4 | Clock/result authority tests + low-time/neutral-interruption UI states | B17/B20 | Khó |
| C13 | 5 | Reconnect under/over 30s tests + reconnect overlay/resync UI | B21/B22 | Khó |
| C14 | 5 | Account/browser lock race tests + cross-tab notification | A15, B23 | Khó |
| C15 | 5 | Restart/stale-lock/session-expiry tests | B24 | Khó |
| C16 | 6 | Matchmaking race/load tests + queue/cancel/Match Found UI | B25/B26 | Rất khó |
| C17 | 6 | Elo eligibility/formula tests | B27 | Trung bình |
| C18 | 7 | Persistence transaction/idempotency tests + Match Detail/History UI states | B29 | Khó |
| C19 | 7 | DB outage/retry/burst tests + degraded UI/error recovery | B30 | Rất khó |
| C20 | 7 | History filter/pagination/detail tests | B31 | Trung bình |
| C21 | 8 | Social race/limits/privacy tests + friend-only presence assertions | B32/B33 | Khó |
| C22 | 8 | Invite expiry/single-use/stale-room tests + invite popup states | B34 | Khó |
| C23 | 9 | Guest/AI/Offline isolation tests + warning/import/handoff UI | A21–A24, B35 | Trung bình |
| C24 | 10 | Spectator capacity/read-only tests + canonical orientation | A25, B36 | Khó |
| C25 | 10 | Spectator 1/10/50/100 fan-out benchmark + smoothness budget | B36/B37 | Khó |
| C26 | 11 | Network latency/loss scenarios + global CONNECTED/RECONNECTING/OFFLINE/DEGRADED UI | Online core | Rất khó |
| C27 | 11 | Auth/matchmaking/many-room load + frontend action latency | B37 | Rất khó |
| C28 | 11 | Match-end DB burst và stress recovery + neutral result safety | B29/B37 | Rất khó |
| C29 | 11 | Snapshot-vs-delta benchmark report + Board/render performance budget | B19/B37 | Khó |
| C30 | 12 | Public URL smoke test + route/responsive/accessibility sanity | A26/B38 | Trung bình |
| C31 | 12 | Evidence tables, charts và demo rehearsal + screen-state coverage | Toàn hệ thống | Trung bình |
| C32 | 11 | Frontend UI-spec acceptance matrix: screen contracts, states, responsive, accessibility, reduced motion, sound, copy và UI↔network mapping | A27, B14/B37 | Khó |

# 6. Những công việc có thể chạy song song

Ba lane có thể chạy song song, nhưng chỉ sau khi contract của wave tương ứng được khóa. `06_FRONTEND_UI_SPEC.md` phải được xem là contract của Person A; Person B khóa network/event/error semantics; Person C khóa acceptance matrix. Không cho A tự suy đoán protocol từ mock UI, và không cho B/C coi UI loading/empty/error/reconnect là phần “để sau”.

| Wave | Person A | Person B | Person C | Cổng hoàn thành |
| :--- | :--- | :--- | :--- | :--- |
| W0 | A00–A01 | B00–B03 | C00–C02 | Shared route/design/event contract, web gọi được /health, DB migrate được, tests chạy |
| W1 | A02–A04 | B04–B05 | C03–C04 | Rule engine + board visual baseline tests pass |
| W2 | A05–A06 | B06–B09 | C05–C06 | Auth/Profile flow + form/state/accessibility baseline hoàn chỉnh |
| W3 | A07–A09 | B10–B13 | C07–C08 | Tạo/join/search room, visibility/idempotency + responsive room UI ổn định |
| W4 | A10–A13 | B14–B20 | C09–C12 | Hai client hoàn thành Online match với HUD/clocks/authority/result states |
| W5 | A14–A15 | B21–B24 | C13–C15 | Reconnect, session/active-game locks và network-state UI pass |
| W6 | A16–A17 | B25–B27 | C16–C17 | Ranked matchmaking + Elo + queue/Match Found UI pass |
| W7 | A18 | B28–B31 | C18–C20 | Match End/History idempotent + filter/detail/degraded states pass |
| W8 | A19–A20 | B32–B34 | C21–C22 | Social/Presence/Invite + privacy UI pass |
| W9 | A21–A24 | B35 | C23 | Guest/AI/Offline + warning/import/handoff UI pass |
| W10 | A25 | B36 | C24–C25 | Spectator read-only, canonical orientation và fan-out pass |
| W11 | A27 | B37 + tuning | C26–C29 + C32 | UI-spec conformance, accessibility/performance + load/failure evidence pass |
| W12 | A26 | B38 | C30–C31 | Public demo hoàn chỉnh, route/responsive/accessibility smoke pass |

### 6.1. Khóa contract trước khi chạy song song

*   **W0 → W1:** A00–A01 khóa canonical route map, shell, design tokens, common states, accessibility baseline và UI state domains; B03 khóa transport/event/error envelope; C00–C02 khóa browser/multi-client harness.
*   **W1 → W2:** A02–A04 khóa board coordinate/orientation/piece semantics; B04–B05 khóa authoritative rules; C03–C04 khóa fixture và invariant evidence.
*   **W2:** A05–A06 chỉ nối endpoint đã có từ B07–B09; C05–C06 kiểm tra cả API contract lẫn inline/loading/error/one-time UI states.
*   **W3:** A07–A09 chỉ hiển thị dữ liệu từ B10–B13; room list phải map được `ROOM_CREATED`, `ROOM_UPDATED`, `ROOM_REMOVED`, không tự tạo state riêng trên client.
*   **W4–W5:** A10–A15 không được tự suy đoán clocks, reconnect, lock hoặc result; mọi state phải có event/error semantics từ B14–B24 và test từ C09–C15.
*   **W6–W10:** mỗi UI lane chỉ bắt đầu sau khi B/C khóa state machine, authorization, privacy và event mapping tương ứng.
*   **W11–W12:** A27/C32 là gate bắt buộc trước A26/B38; không được coi responsive, accessibility, reduced motion, sound, performance hoặc error states là polish tùy chọn.

Không nên chạy tất cả ngay từ đầu. Ví dụ, A10 không thể hoàn thiện khi B14–B19 chưa ổn định; nếu giao quá sớm, hai phía sẽ tự suy đoán protocol khác nhau.

# 7. Thứ tự thực hiện chi tiết

Thứ tự tối ưu là:

1.  Tạo repository/workspace baseline
2.  Khóa package manager, runtime và cấu trúc thư mục
3.  Tạo shared contracts package skeleton
4.  Tạo web shell + canonical route map + frontend state domains
5.  Tạo server shell + /health
6.  Tạo test shell
7.  Kết nối web → server + khóa UI↔network event/error mapping
8.  Kết nối Prisma → PostgreSQL và chạy migration rỗng
9.  Viết Game Engine
10. Viết tests Game Engine
11. Render bàn cờ từ fixture + khóa board visual/orientation/accessibility contract
12. Xây Auth/Profile + đầy đủ form/loading/error/one-time/recovery states
13. Xây Homepage/Room + browse/search/join/idempotency và room-list events
14. Khóa protocol envelope, schema, event/error names và UI reaction matrix
15. Xây realtime match + Game Header/HUD/board authority/clock/result UI
16. Thêm reconnect, active-game lock và global network-state UI
17. Thêm Ranked matchmaking/Elo + queue/Match Found/result UI
18. Thêm persistence và History + filter/detail/empty/error UI
19. Thêm Social + privacy-safe profile/friends/presence/invite UI
20. Thêm Guest/AI/Offline + warning/import/bot/handoff UI
21. Thêm Spectator + read-only/canonical/capacity UI
22. Chạy frontend UI-spec audit, accessibility/responsive/reduced-motion/sound/performance checks song song với network/load/failure tests
23. Chốt public URL smoke, route/base-url/CORS và deploy
24. Chạy smoke test, diễn tập demo và đối chiếu evidence với từng screen contract

Các checkpoint bắt buộc:

*   **CP0:** Repo chạy được + frontend route/design/event foundation
*   **CP1:** Game rules chính xác + board visual/orientation baseline
*   **CP2:** Auth + Room hoạt động + form/error/privacy states
*   **CP3:** Online match hoàn chỉnh + HUD/clock/result authority UI
*   **CP4:** Reconnect + Ranked + Persistence an toàn + network-state UI
*   **CP5:** Full feature scope + frontend screen-contract coverage
*   **CP6:** Benchmark + Public demo + responsive/accessibility/evidence pass

Nếu một checkpoint chưa pass thì chưa chuyển toàn lực sang wave kế tiếp.

# 8. Bước đơn giản nhất để bắt đầu

Bước đầu tiên nên là Phase 0 — Bootstrap, vì hiện repository chỉ có docs.
Đầu ra Phase 0 cần có:

*   `apps/web`
*   `apps/server`
*   `packages/contracts`
*   `packages/game-rules`
*   `packages/test-utils`
*   `prisma`
*   `tests`
*   `package.json`
*   `workspace config`
*   `TypeScript config`
*   `env example`
*   `README`
*   `CI/test commands`

Ba task đầu tiên sẽ là:

1.  `A00_WEB_BOOTSTRAP.md`
2.  `B00_SERVER_BOOTSTRAP.md`
3.  `C00_TEST_BOOTSTRAP.md`

Tuy nhiên, trước khi viết chúng cần khóa bốn quyết định kỹ thuật tối thiểu. Đề xuất mặc định của mình:

| Hạng mục | Lựa chọn |
| :--- | :--- |
| Workspace | pnpm workspace |
| Frontend | React + Vite + TypeScript |
| Backend | Fastify + TypeScript |
| Validation/contracts | Zod |
| Database | PostgreSQL + Prisma |
| Unit/integration test | Vitest |
| Browser E2E | Playwright |
| Load test | k6 |
| Styling | Tailwind CSS |
| CI | GitHub Actions |

# 9. Phân tích chênh lệch hệ thống hiện tại với Frontend UI Spec

`06_FRONTEND_UI_SPEC.md` không chỉ là danh sách màu sắc. Đây là frontend source of truth bao phủ route, shell, design system, state machine hiển thị, network-event reactions, accessibility, responsive, motion, sound, performance và acceptance criteria. Vì vậy task-div được điều chỉnh theo các điểm sau:

*   **Foundation:** A00–A01 bây giờ chịu trách nhiệm khóa canonical routes, state domains, dark/light/system tokens, typography, responsive breakpoints, focus, modal/toast/loading/empty/error, reduced motion và sound hooks. Đây là contract dùng chung, không phải visual polish cuối wave.
*   **Current route gap:** hệ thống hiện tại đang có route tiếng Việt như `/dang-nhap`, `/phong/:roomId`, `/ho-so`, trong khi spec mô tả canonical `/login`, `/room/:roomId`, `/game/:roomId`, `/profile/:username`. A00/A26 phải xử lý route map/alias/smoke, không để mỗi wave tự đặt route.
*   **Current shell gap:** app shell hiện còn thiếu Network status, Profile dropdown, Đăng xuất, mobile bottom navigation và game-specific minimal header. Các nhiệm vụ đã được gắn vào A00, A01, A10, A14–A15 và A26.
*   **Current visual gap:** board fixture/W1 và room/home/W3 đã chạy được, nhưng chưa đạt full-bodied tactical piece, goal visual, dark-first competitive system, screen-state coverage và game HUD của spec. Các phần board được bổ sung vào A02–A04; phần hardening tổng hợp nằm ở A27/C32.
*   **Current realtime gap:** Room Manager hiện là process-local và UI room list chưa có đầy đủ `ROOM_CREATED/UPDATED/REMOVED` subscription. B03/B10–B13 và A08–A09/C07 phải khóa event mapping trước khi gọi W3 hoàn chỉnh; không được dùng refresh polling để giả authority.
*   **Current auth/profile gap:** W2 API đã hoạt động, nhưng UI spec còn yêu cầu show/hide password, confirm password, explicit Recovery Code acknowledgement, profile own/other dossier, settings tabs, privacy, reduced motion, sound và unsaved-change guard. Các yêu cầu này đã được mở rộng trong A05–A06 và kiểm chứng ở C32.
*   **Cross-cutting QA:** C32 được thêm riêng cho frontend UI-spec acceptance matrix. C32 chạy song song W11 với C26–C29 nhưng chỉ pass khi mọi screen có đủ loading, empty, error, disabled, responsive, accessibility và UI↔network reaction evidence.
*   **Wave gate policy:** W3/W4/W5 không được đánh giá chỉ bằng backend HTTP hoặc happy path. Gate phải bao gồm đúng state hiển thị, event ordering, error copy, unsafe-action disable, reconnect/lock/result semantics tương ứng.

Các điều chỉnh trên chỉ thay đổi phân công và cổng nghiệm thu trong `task-div.md`; không thay đổi cấu trúc của `06_FRONTEND_UI_SPEC.md` và không tự động đồng nghĩa với việc các phần UI còn thiếu đã được code.
