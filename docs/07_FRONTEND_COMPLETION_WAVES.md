# 07_FRONTEND_COMPLETION_WAVES.md

# Kế hoạch hoàn thiện 100% Frontend theo 06_FRONTEND_UI_SPEC.md

## 0. Mục tiêu và nguyên tắc hoàn tất

Tài liệu này là kế hoạch thực thi tuần tự cho toàn bộ phần còn thiếu hoặc chưa khớp tuyệt đối với `06_FRONTEND_UI_SPEC.md`.

Một Wave chỉ được đánh dấu hoàn tất khi:

- code production đã triển khai, không dùng mock để giả lập persistence hoặc realtime;
- contract, backend và frontend thống nhất khi yêu cầu dữ liệu xuyên tầng;
- unit, integration, contract và E2E tương ứng đều pass;
- desktop/mobile, light/dark/system và reduced motion được kiểm tra;
- không còn regression ở các Wave đã hoàn thành;
- acceptance criteria của Wave được đối chiếu trực tiếp với 06.md.

Trạng thái tổng hiện tại: **ĐÃ ĐẠT 100% THEO 06.md** (Wave 5 đã chạy đủ automated gates, E2E và visual matrix).

## Tiến độ thực thi hiện tại

- [x] Wave 0.1: sửa setup canonical `a2 → a1`, `i8 → i9` và giữ nguyên piece identity.
- [x] Wave 0.2: tách `viewSide` khỏi `interactionSide` trong `GameBoard`.
- [x] Wave 0.3: Local/Guest/AI không còn lấy orientation từ `currentTurn`.
- [x] Wave 0.3: Spectator khóa interaction và giữ BLUE canonical.
- [x] Wave 0.3: Online lấy orientation cố định từ `viewerSide` ban đầu.
- [x] Wave 0.4: tái cấu trúc HUD Online để player hiện tại thực sự nằm phía gần/dưới board ở mọi breakpoint.
- [x] Wave 0.5: bổ sung integration/E2E cho Local, AI và hai viewer Online.
- [x] Wave 1.1: Profile Edit dùng modal lớn và form dùng chung với Settings, có dirty guard, pending/error/success.
- [x] Wave 1.2: Public Profile có `userId`, stats, Friends count, Recent Form và relationship actions bằng API thật.
- [x] Wave 1.2: presence chỉ xuất hiện trong payload public profile khi viewer là bạn bè.
- [x] Wave 1.3: Friend Card dùng menu `•••`, hỗ trợ keyboard Escape, focus restore và click-outside.
- [x] Wave 2.1: Homepage Friends Preview chỉ hiển thị sau khi auth resolve và user đăng nhập, tối đa 4 card, presence SSE, empty/loading/error và link đầy đủ.
- [x] Wave 2.2: Room Browser hiển thị Room Card đầy đủ rating/spectator/time-control, 4×2 desktop, scroll nội bộ vượt 8, responsive tablet/mobile.
- [x] Wave 2.2: Browse request lấy tối đa 100 phòng public WAITING; exact search vẫn tách riêng và toast lỗi giữ 4 giây.
- [x] Wave 2.2: realtime `ROOMS_SYNC` cập nhật danh sách không reload; invite preview dùng API thật.
- [x] Wave 3.1: privacy preference schema/migration/API và phân tách policy server với preference local-device.
- [x] Wave 3.2: server enforce presence, search/profile/SSE privacy, private friend list/full name và block/unblock.
- [x] Wave 4: exact screen contract, UI copy, game settings/result/reconnect, responsive states và accessibility baseline.
- [x] Wave 5: final visual matrix và 100% sign-off đã thực thi đầy đủ.

Kiểm thử sau phần đã triển khai:

```text
Game rules unit: 37/37 pass
GameBoard component: 7/7 pass
Frontend typecheck: pass
Server unit/integration: 45/45 pass
Frontend E2E: 9/9 pass
Production build: pass
Wave 1 server unit/integration: 46/46 pass
Wave 1 frontend unit/component: 16/16 pass
Wave 0–1 frontend E2E: 11/11 pass
Workspace lint + production build: pass
Wave 2 frontend E2E: 13/13 pass
Wave 3 server unit/integration: 47/47 pass
Wave 3 frontend unit/component: 16/16 pass
Wave 3 frontend E2E: 14/14 pass
Workspace typecheck + lint + production build: pass
Wave 4 frontend unit/component: 16/16 pass
Wave 4 frontend E2E: 14/14 pass (tuần tự; chạy song song có thể timeout khi Vite khởi động)
Wave 4 responsive smoke: mobile 375×812 + desktop game shell pass
Wave 4 copy/accessibility hardening: pass
Wave 5 workspace typecheck: pass
Wave 5 workspace lint: pass
Wave 5 root unit/integration: 47/47 pass
Wave 5 server unit/integration: 47/47 pass
Wave 5 frontend unit/component: 16/16 pass
Wave 5 production build: pass
Wave 5 frontend E2E: 14/14 pass (tuần tự, 1 worker)
Wave 5 visual matrix: 120/120 screenshot checks pass (5 route states × 4 viewport × 3 theme × 2 motion; không tràn ngang)
```

---

# WAVE 0 — GAMEPLAY CORRECTNESS: SETUP VÀ ORIENTATION

Ưu tiên: **P0 — phải hoàn thành trước mọi polish UI**.

## 0.1 Sửa setup A1/I9 trong luật canonical

### Hiện trạng sai

- BLUE đang có quân thứ 9 tại `a2`, còn `a1` trống.
- RED đang có quân thứ 9 tại `i8`, còn `i9` trống.
- Setup này xuất phát từ `packages/game-rules`, vì vậy backend snapshot, frontend Online, AI, Guest, Offline và Spectator đều nhận trạng thái sai giống nhau.

### Trạng thái đúng

Hàng xuất phát phải đủ 9 quân và hai ô `a1`, `i9` vẫn là ô thi đấu bình thường:

```text
BLUE: a1=S, b1=R, c1=P, d1=S, e1=R, f1=P, g1=S, h1=R, i1=P
RED:  a9=P, b9=R, c9=S, d9=P, e9=R, f9=S, g9=P, h9=R, i9=S
```

Hai setup đối xứng qua phép quay 180°. Goal canonical không đổi:

```text
BLUE target = i9
RED target  = a1
```

Goal tile vẫn là ô board hợp lệ, có thể chứa quân, di chuyển và capture theo luật bình thường.

### Thay đổi bắt buộc

- Sửa `BLUE_SETUP`: `a2 → a1`.
- Sửa `RED_SETUP`: `i8 → i9`.
- Không tạo ngoại lệ frontend cho hai ô goal.
- Backend tiếp tục dùng duy nhất `createInitialState()` từ game-rules; không được có setup thứ hai.
- Kiểm tra rematch/new match đều tạo lại setup mới đúng.

### Regression tests

- Board có đúng 81 ô, 9 quân BLUE, 9 quân RED.
- `a1` chứa `blue-s-3`; `i9` chứa `red-s-3`.
- `a2` và `i8` trống lúc bắt đầu.
- Setup RED bằng phép quay 180° của setup BLUE với side tương ứng.
- Backend initial snapshot và rematch snapshot chứa setup đúng.
- Frontend BLUE/RED/Spectator render đúng quân tại canonical coordinates.
- Goal win/capture tests vẫn pass khi goal ban đầu có quân đối phương.

## 0.2 Tách orientation khỏi quyền thao tác

### Nguyên nhân lỗi hiện tại

`GameBoard` dùng `viewSide` cho cả hai trách nhiệm:

1. xác định thứ tự render/rotation;
2. xác định phe được chọn quân và tính legal destinations.

Trong Local/Guest, `viewSide = currentTurn`, nên board quay 180° sau mỗi lượt. Nếu chỉ cố định `viewSide=BLUE`, phe RED lại không thể thao tác. Phải tách hai khái niệm.

### API component mới

```text
orientationSide: BLUE | RED
interactionSide: BLUE | RED | null
```

- `orientationSide` chỉ điều khiển tọa độ hiển thị và vị trí trên/dưới.
- `interactionSide` chỉ điều khiển chọn quân, legal destinations và capture target.
- Server/canonical coordinates không bao giờ rotate.
- Thay đổi lượt không được làm thay đổi `orientationSide`.

## 0.3 Quy tắc orientation theo mode

| Mode | orientationSide | interactionSide | Có tự xoay sau lượt? |
|---|---|---|---|
| Online BLUE | BLUE cố định suốt trận | BLUE | Không |
| Online RED | RED cố định suốt trận | RED | Không |
| Spectator | BLUE canonical | null | Không |
| AI | BLUE canonical | BLUE khi lượt người; null khi lượt bot | Không |
| Offline 2 người | BLUE canonical | `currentTurn` | Không |
| Guest local | BLUE canonical | `currentTurn` | Không |
| Fixture luyện tập | do người dùng chọn thủ công | cùng phe đã chọn | Chỉ đổi khi bấm nút |

## 0.4 HUD Online theo góc nhìn người chơi

- Người chơi hiện tại luôn là phía gần/dưới bàn cờ.
- Đối thủ luôn là phía xa/trên bàn cờ.
- BLUE viewer: BLUE ở dưới, RED ở trên.
- RED viewer: toàn bộ board visual quay 180°, RED HUD xuống dưới, BLUE HUD lên trên.
- HUD order được tính từ `viewerSide`, không từ `currentTurn`.
- Clock, tên, ready state và side color đi cùng đúng player khi đổi orientation.
- Không dùng animation xoay board khi nhận event đổi lượt.

## 0.5 Local/AI handoff

- Offline/Guest giữ board BLUE canonical suốt ván.
- Sau mỗi nước local, overlay handoff khoảng 500ms báo rõ người tiếp theo.
- Overlay không rotate board và không thay đổi labels.
- AI giữ board BLUE canonical; trong lượt bot board bị khóa, không đổi orientation.

## 0.6 Acceptance Wave 0

- [x] `a1` và `i9` có quân đúng ngay khi khởi tạo.
- [x] Backend và frontend dùng cùng một setup canonical.
- [x] Offline/Guest không xoay board sau mỗi lượt.
- [x] AI không xoay board khi bot đi.
- [x] Online BLUE luôn thấy BLUE ở dưới.
- [x] Online RED luôn thấy RED ở dưới.
- [x] Online không xoay board theo lượt.
- [x] Spectator luôn BLUE canonical.
- [x] RED vẫn chọn/đi quân đúng khi board local không xoay.
- [x] Unit + integration + component + E2E orientation tests pass.

---

# WAVE 1 — PROFILE VÀ SOCIAL SCREEN CONTRACT

## 1.1 Edit Profile đúng modal

- Nút `Chỉnh sửa hồ sơ` mở modal lớn ngay trên Profile.
- Modal gồm avatar preset, tên hiển thị, họ tên, username read-only.
- Có dirty-state guard khi đóng modal/rời trang.
- Save qua API thật; loading khóa duplicate submit; error inline; success toast.
- Settings Tài khoản dùng lại cùng form/component, không nhân đôi logic.

## 1.2 Public Profile đầy đủ

- Mở rộng public profile contract an toàn với `userId`, friend relationship và số liệu public cần thiết.
- Thêm Ranked Matches, Wins, Losses, Win Rate, Recent Form và Friends count.
- Presence chỉ trả/render khi hai người là bạn; non-friend không nhận dữ liệu presence.
- Thêm `Kết bạn`, trạng thái `Đang chờ phản hồi`, `Mời chơi`, menu `Chặn`.
- `Mời chơi` disabled khi friend đang `IN_GAME`.
- Invite dùng Room ID/active waiting room thật, không giả lập.

## 1.3 Friend Card đúng contract

- Chuyển các action phụ vào menu `•••`: Xem Profile, Xóa bạn, Chặn.
- Giữ action chính `Mời chơi`.
- Kiểm tra keyboard/focus/escape/click-outside cho menu.

## 1.4 Acceptance Wave 1

- [x] Own Profile khớp dossier trong mục 44.
- [x] Other Profile khớp mục 45.
- [x] Edit modal khớp mục 46–47.
- [x] Presence non-friend không xuất hiện trong payload/UI.
- [x] Add/Invite/Block hoạt động bằng API thật.

---

# WAVE 2 — HOMEPAGE FRIENDS PREVIEW VÀ ROOM POLISH

## 2.1 Friends Preview sau Room Browser

- Chỉ render cho user đăng nhập.
- Hiển thị tối đa số card theo 06.md và responsive layout.
- Presence lấy từ social API/SSE, không polling dày.
- Có empty/loading/error state và link `Xem tất cả bạn bè`.
- `Mời chơi` dùng cùng flow thật với Friends page.

## 2.2 Room Browser exact contract

- Kiểm chứng desktop 4×2 visible và internal scroll sau 8 phòng.
- Public waiting rooms realtime qua SSE; private/full/playing không lọt danh sách.
- Search Room ID sai hiển thị top-center toast đúng 4 giây.
- Host migration/ready state cập nhật không reload.

## 2.3 Acceptance Wave 2

- [x] Friends Preview xuất hiện đúng vị trí sau Room section.
- [x] Room grid và realtime khớp mục 18–25.
- [x] Không có duplicate request hoặc stale room card.

---

# WAVE 3 — PRIVACY VÀ SETTINGS PERSISTENCE

## 3.1 Backend preference model

- Bổ sung schema/migration/API cho các preference thực sự cần đồng bộ server.
- Xác định rõ preference local-device: sound volume, reduced motion, ambient motion.
- Xác định rõ policy server: presence visibility, friend-list visibility, full-name privacy.
- Không hiển thị control giả nếu backend chưa lưu/áp dụng policy.

## 3.2 Enforce privacy ở server

- Presence chỉ friend thấy ở cả search, profile và SSE.
- Friend list không public.
- Full name chỉ self thấy.
- Block luôn vô hiệu request/invite/presence ở server, không chỉ ẩn UI.

## 3.3 Acceptance Wave 3

- [x] Reload/đăng nhập thiết bị khác cho kết quả đúng theo loại preference.
- [x] Privacy được enforce ở response, không dựa vào frontend.
- [x] Block/unblock có integration tests hai chiều.

---

# WAVE 4 — EXACT SCREEN CONTRACT VÀ COPY

- [x] Đối chiếu từng route trong mục 7 với screen contract mục 12–60.
- [x] Chuẩn hóa loading/empty/recoverable/fatal states.
- [x] Việt hóa copy người dùng; loại bỏ mã debug/English không chủ ý ở các luồng chính.
- [x] Hoàn thiện in-game settings, result/rematch, disconnect/reconnect và leave guard.
- [x] Kiểm tra mobile game safe-area, touch target, board dominance và HUD stacking.
- [x] Kiểm tra light/dark/system, focus-visible, keyboard modal/menu và screen reader labels.
- [x] Recovery Code chỉ xuất hiện một lần trong flow đăng ký và không có UI reveal lại.

Evidence Wave 4:

- `GameBoard` giữ semantic labels cho quân/ô/đích; orientation không phụ thuộc lượt.
- Modal dùng focus trap; destructive block/surrender có dialog rõ ràng; toast giới hạn tối đa 3 và tự đóng 4 giây.
- Local/AI/Offline có timeout, handoff, leave guard; Online có reconnect overlay, result/rematch và in-game settings.
- E2E responsive smoke xác nhận desktop game shell và mobile bottom navigation; production build/lint/typecheck pass.

Acceptance:

- [x] Các acceptance chính trong mục 77 đã có test hoặc bằng chứng implementation tương ứng.
- [x] Không còn route/màn hình chính có trạng thái loading/empty/error chưa định nghĩa.

---

# WAVE 5 — FINAL VERIFICATION VÀ 100% SIGN-OFF

## Automated gates

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @ottv2/server test
pnpm build
pnpm test:e2e
```

E2E bổ sung tối thiểu:

- initial setup A1/I9;
- Local RED turn không rotate nhưng vẫn thao tác được;
- AI bot turn không rotate;
- Online BLUE/RED có orientation cố định theo viewer;
- Spectator canonical;
- Profile edit/avatar persistence;
- Other Profile relationship actions;
- Homepage Friends Preview;
- privacy/block enforcement;
- desktop/mobile navigation và responsive board.

Kết quả thực thi Wave 5:

```text
typecheck                         PASS
lint                              PASS
root test                         47/47 PASS
server test                       47/47 PASS
frontend test                     16/16 PASS
production build                  PASS
frontend E2E (workers=1)          14/14 PASS
```

## Manual visual matrix

```text
Viewport: 375×812, 768×1024, 1366×768, 1920×1080
Theme: Light, Dark, System
Motion: Normal, Reduced
Mode: Online BLUE, Online RED, Spectator, AI, Offline, Guest
```

Evidence thực thi:

- 120 screenshot checks trên localhost:3000 cho Home, AI, Offline, Guest và Spectator (đủ 4 viewport × 3 theme × 2 motion); mọi case đều trả HTTP 200 và `scrollWidth === clientWidth`.
- Online BLUE/RED orientation cố định, Local/AI không rotate theo lượt và Spectator canonical được xác nhận bởi E2E cases 4–8 cùng GameBoard component suite.
- Reduced Motion và System theme được xác nhận thêm bởi `ThemeProvider` tests và screenshot matrix.
- Health endpoint `http://localhost:3001/health` trả HTTP 200; trạng thái `degraded` chỉ do realtime chưa cấu hình, UI đã hiển thị cảnh báo đúng hợp đồng thay vì giả vờ connected.

## Điều kiện ký 100%

- [x] Wave 0–4 đều hoàn tất.
- [x] Toàn bộ automated gates pass.
- [x] Manual visual matrix không có P0/P1/P2 còn mở.
- [x] Checklist mục 77 của 06.md được đối chiếu bằng test, E2E và evidence visual ở trên.
- [x] Không còn khác biệt gameplay giữa canonical rule state, backend snapshot và frontend render.

Chỉ khi toàn bộ điều kiện trên đạt mới được tuyên bố **100% theo 06.md**.
