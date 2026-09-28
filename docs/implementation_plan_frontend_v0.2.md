# implementation_plan_frontend_v0.2.md

## 0. Trạng thái và mục tiêu

- **Status:** READY FOR IMPLEMENTATION
- **Mục tiêu:** nâng cấp frontend/UI/UX đạt 100% các acceptance item đã chốt từ 06, 06B và 120 câu hỏi discovery.
- **Phạm vi:** toàn bộ route/state/component hiện tại, toàn bộ Game Feel/VFX/Audio trong 06B và các phần frontend mà 06B chưa mô tả đủ.
- **Quy tắc:** không mock production thay cho canonical state; không để VFX/audio chặn input, state hoặc clock; không tự phát minh game-rule trong UI.
- **Cách chia Wave:** mỗi Wave có owner page, output UI/UX cụ thể, dependency, acceptance và evidence riêng.

BA/QA độc lập đã xác nhận đủ thông tin để bắt đầu coding. File này chỉ được tạo sau khi người dùng khóa toàn bộ phương án A trong 120 câu hỏi.

---

## 1. Decision log đã khóa

| Nhóm | Quyết định |
|---|---|
| Art direction | Neon Esports Arena; density ở overlay, clarity trong nội dung; góc sắc; không bounce/elastic |
| Color | Blue/Red chỉ dành cho side identity; Cyan cho system; Violet/Magenta/Amber theo semantic role |
| Typography | Space Grotesk display, Be Vietnam Pro body, monospace tabular cho data |
| Board | Dark glass slab, cyan grid, corner brackets, goal energy core |
| Piece | SVG line-art Đấm/Bao/Kéo; token 82–88%; side-first; không emoji |
| Orientation | Online cố định viewer side; AI/Offline không rotate theo turn; Spectator canonical Blue dưới |
| VFX | Semantic event bus + shared 2D canvas + DOM semantic layer |
| Event safety | Dedupe/coalesce theo eventId/stateVersion; pause tab hidden; cleanup unmount |
| Audio | Một AudioContext dùng lại; SFX synthesized; BGM lazy-load, OFF mặc định, crossfade/ducking |
| Mobile | Landscape ưu tiên; portrait full-width board + bottom sheet + hint xoay ngang |
| Keyboard | Roving focus, arrow navigation, Enter/Space select/commit, Escape clear, live region |
| Rank | Client derive từ một rank config; shield + chevrons; non-ranked không có badge/Elo |
| Goal Tension | Helper thuộc game-rules; UI không heuristic |
| Match flow | Server state machine WAITING_READY → COUNTDOWN → PLAYING |
| Result | Tách FINISHED/ABORTED/SERVER_INTERRUPTION/TIMEOUT/SURRENDER/DISCONNECT_TIMEOUT |
| Theme | 06B là visual token authority duy nhất |
| Scope | Bao phủ toàn bộ route/state hiện tại và các phần 06B chưa mô tả |
| Acceptance | 100% acceptance đã chốt; P2 chỉ deferred/tunable nếu 06B §17 cho phép |
| Browser | Chrome/Edge desktop, Chrome Android, Safari iOS; mobile landscape ưu tiên |

Setup cố định: a1 và i9 là ô thi đấu bình thường, quân khởi đầu nằm đúng tại hai ô đó.

---

## 2. Source of truth và dependency rules

1. Game state/legal move/winner/goal threat: package game-rules và canonical server snapshot.
2. Request/response/event payload: package contracts.
3. Realtime/session/reconnect: network spec và server contract.
4. Route/state/product shell: 06_FRONTEND_UI_SPEC.
5. Visual/motion/VFX/audio/quality: 06B_GAME_FEEL_SPEC, override 06.
6. Plan này: execution order, per-page output, dependency owner và evidence.

Nếu contract/backend chưa sẵn sàng, Wave chỉ được tạo fixture contract/unit test; không được dùng mock trong production.

---

## 3. Route inventory và page ownership

| Wave | Trang/route | Owner output |
|---|---|---|
| B0 | Toàn hệ thống | Contract, fixtures, state matrix |
| B1 | Shared foundation | Tokens, fonts, glyph, background, quality tier |
| B2 | Login/Register/Forgot/Recovery | Auth visual + form states |
| B3 | Homepage/Lobby/Room Browser | 3-column lobby + room/friends |
| B4 | Queue/Match Found/Waiting Room | Radar, VS, ready, countdown |
| B5 | GameView/Online Room | Board, HUD, move log, combat feed, VFX |
| B6 | Result/Rematch | Victory/Defeat/interruption/Elo |
| B7 | History/Match Detail | Cards, filters, thumbnail, detail |
| B8 | Profile/Public Profile | Dossier, rank, stats, relationship |
| B9 | Friends/Invites | Tabs, presence, invite/block |
| B10 | Settings | Theme, quality, audio, motion, privacy |
| B11 | Guest/AI/Offline | Local setup, handoff, import, results |
| B12 | Spectator/Not Found/App Error | Read-only canonical, failure shell |
| B13 | Cross-cutting QA | Accessibility, mobile, performance, visual regression |
| B14 | Final sign-off | Evidence and 100% release gate |

Route aliases phải render cùng một screen contract; không tạo implementation fork chỉ vì khác URL:
- Home: / và /home
- Auth: /dang-nhap, /login, /dang-ky, /register, /quen-mat-khau, /forgot-password
- Game: /phong/:roomId, /room/:roomId, /game/:roomId
- History: /lich-su, /history, /history/:matchId
- Profile: /ho-so, /profile/:username
- Friends: /ban-be, /friends
- Settings: /cai-dat, /settings
- Local: /guest, /guest/play, /ai, /offline
- Spectator: /spectate/:roomId
- Fallback: *

### Wave B0 — contract, fixtures và state-matrix (đã thực thi)

**Output:** [B0_FRONTEND_FOUNDATION.md](B0_FRONTEND_FOUNDATION.md), canonical fixture tại `tests/fixtures/frontend-fixtures.ts` và unit coverage tại `tests/unit/b0-frontend-fixtures.unit.test.ts`.

- [x] Decision log và source-of-truth đã khóa.
- [x] Route/alias state-matrix skeleton đã có owner, trạng thái bắt buộc và acceptance dimensions.
- [x] Canonical setup xác nhận a1/i9 là ô thi đấu bình thường có quân khởi đầu.
- [x] Orientation fixture xác nhận online rotate một lần theo viewer side; AI/Offline/Spectator không rotate theo lượt.
- [x] Playing/Finished Ranked/Aborted fixtures đều parse qua `MatchSnapshotSchema`.
- [x] Contract-gap register C-01…C-12 có owner, target Wave và exit criteria.
- [x] Evidence: `corepack pnpm test:unit -- tests/unit/b0-frontend-fixtures.unit.test.ts` → 7 files, 40 tests passed.

B0 không tự nhận hoàn tất visual/runtime của B1–B14; các Wave sau chỉ bắt đầu khi dùng các fixture và state contract này làm baseline.

---

## 4. State matrix bắt buộc cho từng page

Mỗi Wave phải có matrix cho:

- Actor/permission/entry.
- Loading, ready, empty.
- Recoverable error, fatal error, retry.
- Disabled/pending/duplicate-submit prevention.
- Offline/degraded/reconnecting.
- Realtime update, stale snapshot, resync.
- Keyboard/focus/screen reader.
- Normal/Reduced Motion.
- Light/Dark/System.
- Desktop/tablet/mobile portrait/mobile landscape.
- Exit/back/unsaved guard.
- Analytics/performance event nếu thuộc scope.
- Acceptance evidence và rollback behavior.

---

## 5. Shared foundation — Wave B1

### 5.1 Design tokens

Tạo một token source duy nhất cho BG-ROOT/BG-SECONDARY, SURFACE-1/2/3, GLASS, TEXT, SYSTEM-CYAN, BLUE, RED, VIOLET, MAGENTA, AMBER, SUCCESS/WARNING/ERROR, gradients, glow, z-index, spacing, easing và duration.

Không page nào được viết lại màu Blue/Red/Cyan bằng hex riêng.

### 5.2 Typography/assets

- Space Grotesk Vietnamese subset cho hero/result.
- Be Vietnam Pro cho body/form.
- Monospace tabular cho clock/Elo/ping/coordinates.
- Preload display font; test dấu tiếng Việt ở viewport 375px.
- SVG glyph source cho Đấm/Bao/Kéo.
- Royalty-free/open-source asset only; tạo attribution cho BGM/font/glyph nếu cần.

### 5.3 Ambient/background

- L0 base gradient, L1 grid, L2 data dots, L3 aurora, L4 scanline, L5 particles.
- Context tint Home/Queue cyan-violet, Game neutral/dimmed, Victory amber-magenta, Defeat red-violet.
- Reduced Motion tắt chuyển động; Low tier giữ static layer.

### 5.4 Quality tier

| Tier | Particle | FPS | DPR | Shake/Tilt |
|---|---:|---:|---:|---|
| High | 400 | 60 | 2 | On |
| Medium | 150 | 45 | 1.5 | On |
| Low | 0 | 30 | 1 | Off |

Auto đọc hardwareConcurrency/deviceMemory/saveData/reduced-motion/viewport. Nếu p95 frame >24ms trong 3 giây, hạ một tier. Manual override persist local-device.

### 5.5 Event bus, canvas, audio

Event envelope phải có eventId, stateVersion, emittedAt, source, type, payload.

Các type tối thiểu: MOVE, SELECT, CAPTURE, GOAL_TENSION, MATCH_FOUND, READY, COUNTDOWN, VICTORY, DEFEAT, TIMEOUT, SURRENDER, DISCONNECT_TIMEOUT, SERVER_INTERRUPTION, REMATCH, ROUTE_GLITCH, CLOCK_WARNING, TOAST, COMBAT_FEED.

- Shared 2D canvas cho particles/trail/shockwave/fireworks/embers.
- DOM/CSS cho selected/legal/focus/labels/critical feedback.
- Dedupe/coalesce stale event; pause khi tab hidden; cleanup khi unmount.
- Một AudioContext dùng lại; SFX không tạo context mới cho mỗi cue.
- BGM lobby_loop và match_loop lazy-load, OFF mặc định, crossfade 800ms, duck 6dB.

### Wave B1 execution evidence (đã thực thi)

Chi tiết: [B1_SHARED_FOUNDATION.md](B1_SHARED_FOUNDATION.md).

- [x] Semantic token source + Light/Dark/System application.
- [x] Space Grotesk / Be Vietnam Pro / data font stack và Vietnamese glyph-safe line-height baseline.
- [x] Shared ambient canvas với High/Medium/Low budget, DPR cap, reduced-motion và tab-hidden pause.
- [x] Quality auto-detection, persisted override và p95 frame downgrade.
- [x] Semantic event bus dedupe/coalesce baseline theo `eventId`/`stateVersion`; GameRoom realtime đã publish event.
- [x] Một lazy AudioContext; SFX fallback; BGM lazy/off/crossfade/ducking API.
- [x] SVG line-art glyph cho Đấm/Bao/Kéo.
- [x] Evidence: web typecheck pass, 19 frontend tests pass, production build pass, ESLint pass.

### Wave B2 execution evidence (đã thực thi)

Chi tiết: [B2_AUTH_FOUNDATION.md](B2_AUTH_FOUNDATION.md).

- [x] Login/Register/Forgot/Recovery dùng cùng Arena token, typography và frosted-glass output.
- [x] Inline field validation, stable labels/IDs, ARIA error association và pending lock.
- [x] Recovery Code one-time hologram, copy/manual fallback và acknowledgement gate.
- [x] Forgot Password dùng username + Recovery Code, không dùng email.
- [x] Reduced Motion auth fallback và mobile safe-area baseline.
- [x] Evidence: web typecheck pass, 22 frontend tests pass, ESLint pass, production build pass.

### Wave B1 acceptance

- Token snapshot Light/Dark/System pass.
- Font không clipping dấu tiếng Việt.
- Không có raw color drift.
- SVG glyph 28px phân biệt được và contrast ≥3:1.
- Quality tier switch được, reduced motion được, audio autoplay failure im lặng.
- Canvas/audio failure fallback không ảnh hưởng gameplay.

---

## 6. Wave B2 — Login/Register/Forgot/Recovery

### Output bắt buộc

- Arena background nhưng giảm particle để form dễ đọc.
- Logo OẲN TÙ TÌ v2 + gradient ARENA-AURORA.
- Frosted glass card width 420–520px trên desktop; mobile không chạm safe-area.
- Input có label nhìn thấy, focus cyan ring, password toggle accessible.
- Inline error gần field; submit pending lock.
- Recovery Code là hologram card, copy action, checkbox đã lưu, chỉ hiện một lần.
- Reduced Motion chuyển glitch thành fade 150ms.

### Acceptance

- Login/Register visual consistency.
- Recovery Code không reveal lại.
- Forgot dùng username + Recovery Code, không email.
- Clipboard fallback có hướng dẫn copy thủ công.
- Keyboard/focus/screen reader pass.
- Mobile 375×812 không clipping/overflow.

---

## 7. Wave B3 — Homepage/Lobby/Room Browser

### Output bắt buộc

Desktop 3 cột:

- Trái: profile, avatar frame, rank badge, Elo, W/L.
- Giữa: CTA TÌM TRẬN lớn nhất, SYSTEM-PULSE, ba mode cards AI/Offline/Guest.
- Phải: Room Browser 4×2 visible, scroll nội bộ beyond 8, Tạo phòng, Friends Preview.
- Server status strip mảnh, không phá hierarchy.
- Guest biến profile thành registration invite và CTA thành ĐĂNG NHẬP ĐỂ XẾP HẠNG.
- Tilt ≤6°, spotlight, magnetic ≤8px, ripple chỉ khi tier cho phép; touch không phụ thuộc hover.
- Empty/loading/error giữ cùng layout contract; private room không lộ.

### Acceptance

- Room realtime không layout shift.
- Search/create/private password/invite states rõ.
- Friends preview mount sau auth resolve.
- Mobile thứ tự CTA → mode → server → room → friends; bottom nav không che nội dung.
- 1366×768 và 1920×1080 đạt 3-column output; 375×812 đạt mobile output.

---

## 8. Wave B4 — Queue/Match Found/Waiting Room

### Queue output

- Radar concentric cyan ring, SVG fist ở tâm.
- Ba stat card Elo/khoảng tìm kiếm/thời gian dùng tabular numerals.
- Ring expansion theo server range.
- Cancel danger button pending và committed state.

### Match Found/VS output

- Diagonal Blue/Red split.
- Avatar/name/rank/Elo slide-in khoảng 300ms.
- VS impact scale-in, shock ring, micro-shake trong budget.
- Countdown 3–2–1 theo server timestamp, tổng ≤3 giây.

### Waiting Room output

- Hai hologram slot Blue/Red.
- Ready glow, host crown, room-code chip có copy.
- Hint Space fast-ready.
- Waiting/loading/full/reconnect/error có state riêng.

### Acceptance

- State machine server-authoritative: WAITING_READY → COUNTDOWN → PLAYING.
- Refresh/reconnect/event trễ không tạo duplicate VS/countdown.
- Cancel race và ready race được E2E.

---

## 9. Wave B5 — GameView/Online Room

### Layout output

- Header tối giản.
- Opponent HUD phía xa/trên; own HUD phía gần/dưới.
- Board chiếm 55–65% attention.
- Right rail: move log, combat feed, match info; mobile chuyển drawer/bottom sheet.
- Reconnect/server interruption overlay dim VFX/audio, khóa action nguy hiểm, không giống Win/Loss.

### Board output

- Dark glass slab, cyan grid, corner brackets.
- Canonical coordinates luôn đúng.
- Goal a1/i9 là energy core, không khóa click.
- Piece token 82–88%, body/rim/motif/glyph/contact shadow.
- Select: lift/scale/cyan ring.
- Legal empty: cyan dot ≥14px.
- Capture target: amber crosshair.
- Blocked: shake tối đa 3px/150ms và edge flash.
- Move: slide 160–220ms.
- Capture: state commit trước, cosmetic sequence 600–900ms.

### Orientation output

- Online Blue/Red viewer side cố định, player tương ứng ở phía gần/dưới.
- AI/Offline không rotate theo current turn.
- Spectator canonical, Blue bottom, không selection feedback.

### Acceptance

- Board keyboard roving focus.
- Arrow navigation, Enter/Space select/commit, Escape clear selection.
- Live region thông báo turn/legal/capture/result/reconnect.
- MOVE/CAPTURE/RESYNC dedupe pass.
- Input latency không bị VFX/audio block.

### Wave B5 execution evidence (đã thực thi)

Chi tiết: [B5_GAMEVIEW_ONLINE_ROOM.md](B5_GAMEVIEW_ONLINE_ROOM.md).

- [x] Online Blue/Red viewer perspective cố định; không xoay theo current turn.
- [x] Realtime event dedupe theo `messageId`, `stateVersion`, `sequence`; semantic event bus vẫn nhận event hợp lệ.
- [x] Board roving focus, Arrow navigation, Enter/Space commit, Escape clear và live status.
- [x] Move log + combat feed từ snapshot diff, giới hạn lịch sử và responsive right rail/mobile layout.
- [x] Evidence: web typecheck/lint/build pass, 49 web tests pass, 43 workspace unit tests pass.

---

## 10. Wave B6 — Result/Rematch

### Output

- FINISHED + winner: Victory/Defeat cinematic.
- Victory: VICTORY gradient, fireworks tier-aware.
- Defeat: DEFEAT gradient, board desaturate 40%, embers.
- ABORTED/SERVER_INTERRUPTION trung tính.
- TIMEOUT/SURRENDER/DISCONNECT_TIMEOUT có copy/reason riêng.
- Ranked: Elo before/after/delta, count-up 1200ms, rank-up flip/ring, rank-down dim.
- Non-Ranked/AI/Offline/Guest: không Elo card.
- Stats row: số nước, quân ăn, quân mất, thời gian.
- Primary ĐẤU LẠI, secondary Về sảnh, pending/disabled/focus rõ.

### Acceptance

- Không result reason nào bị render thành false Victory/Defeat.
- Rematch server-authoritative.
- Reduced Motion bỏ fireworks/count-up nhưng giữ hierarchy.
- E2E FINISHED, TIMEOUT, SURRENDER, INTERRUPTION.

### Wave B6 execution evidence (đã thực thi)

Chi tiết: [B6_RESULT_REMATCH.md](B6_RESULT_REMATCH.md).

- [x] ResultPanel cinematic phân biệt Victory/Defeat/neutral interruption, reason copy, stats và reduced-motion.
- [x] Ranked Elo before/after/delta count-up dùng rank config chung; non-ranked/local không hiển thị Elo.
- [x] Rematch request/accept/reject server-authoritative; reset board, swap side và chuyển rematch sang Unranked.
- [x] `DISCONNECT_TIMEOUT` được thêm vào shared contract/history và backend disconnect expiry.
- [x] Web 53 tests, server 48 tests, typecheck/lint/build pass.

---

## 11. Wave B7 — History/Match Detail

### Output

- History card có result strip, mode chip, versus, duration, Elo delta.
- Filter chips: Tất cả, Ranked, Unranked, Guest, AI, Offline.
- Loading skeleton không layout shift.
- Empty state có next action.
- Detail giữ context list, có final-position thumbnail canonical, read-only.
- Thumbnail dùng SVG glyph, không cho click thao tác.

### Acceptance

- History filter/query state persist đúng phạm vi.
- Detail không tạo game action.
- Guest import one-time có confirmation/error/deferred state.
- Mobile card không tràn ngang.

---

## 12. Wave B8 — Profile/Public Profile

### Output

- Competitive dossier: avatar frame, identity, rank badge, Elo, W/L, win rate, recent form.
- Rank badge shield + chevrons; shape phân biệt khi bỏ màu.
- Avatar frame không lấn side identity.
- Public profile chỉ hiển thị presence theo privacy policy.
- Self profile có edit modal, dirty guard, pending/error/success.
- Public profile có Kết bạn/Mời chơi/Chặn.
- Block modal nêu đầy đủ consequence.

### Acceptance

- Rank derive client-side một nguồn config.
- Elo data không bị client tự đoán.
- Public/private fields đúng contract.
- Avatar/profile update persistence và rollback pass.
- Profile mobile giữ dossier hierarchy.

---

## 13. Wave B9 — Friends/Invites

### Output

- Header + tabs Bạn bè/Lời mời/Đã gửi/Tìm người chơi.
- Friend card: avatar, username, Elo, presence, action.
- Presence dot + text, chỉ lộ khi policy cho phép.
- Secondary menu accessible: Escape, click-outside, focus restore.
- Invite modal có Room ID, one-time token, pending/expired/error.
- Block modal dùng cùng consequence language với Profile.
- Empty/loading/error/realtime update đầy đủ.

### Acceptance

- Incoming/Sent action state không nhầm.
- Invite/reject/expire không gây stale card.
- Block/unblock hai chiều được phản ánh.
- Keyboard menu và screen reader pass.

---

## 14. Wave B10 — Settings

### Output

Tabs/sections:

- Giao diện: Sáng/Tối/Hệ thống, Auto/Cao/Vừa/Thấp, Giảm chuyển động, Chuyển động nền.
- Âm thanh: Master, SFX, BGM, countdown, SFX volume, BGM volume.
- Tài khoản: profile/password.
- Riêng tư: presence visibility.
- Đã chặn: list/unblock.

### Output

- Live preview khi đổi theme/quality/motion.
- Auto downgrade toast có link mở đúng tab.
- Audio autoplay failure im lặng.
- Local preference persist; account preference sync khi authenticated.
- Mobile settings dùng section/card không bị tab overflow.

### Acceptance

- Reload giữ preference đúng.
- Guest/offline vẫn có local presentation preference.
- Server failure không làm mất preference local.
- Quality tier test được với deterministic mock.

---

## 15. Wave B11 — Guest/AI/Offline

### Guest

- Entry card nêu rõ dữ liệu chỉ lưu trên thiết bị.
- Guest name validation.
- Local history warning.
- Import một lần sau login, dedupe và defer.

### AI

- Bot identity, difficulty, timer.
- Dùng cùng GameBoard/VFX với Online.
- Orientation cố định, không rotate theo turn.
- Result có cinematic nhưng không Elo.

### Offline

- Hai người một máy, timer.
- Handoff overlay rõ người chơi tiếp theo.
- Persistence local.
- Không reconnect giả, không server status giả.

### Acceptance

- Guest/AI/Offline đều có loading/empty/error/leave guard.
- Local clock đúng side.
- Handoff không làm sai canonical board.

### Wave B11 execution evidence (đã thực thi)

Chi tiết: [B11_GUEST_AI_OFFLINE.md](B11_GUEST_AI_OFFLINE.md).

- [x] Guest identity và history chỉ lưu local; import sau login giữ one-time decision, retry và dedupe.
- [x] AI Normal dùng shared rules/board, fixed orientation, local timer và không mở realtime.
- [x] Offline 2P giữ canonical board, timer theo side, handoff overlay và leave guard.
- [x] Phiên đang chơi được lưu local, restore sau reload, xoá khi finish/leave và có recoverable storage error.
- [x] Local result không hiển thị Elo/ranked card.

---

## 16. Wave B12 — Spectator/Not Found/App Error

### Spectator

- Entry password/private/loading/error/reconnecting/ready.
- Canonical Blue bottom, Red HUD top.
- Full VFX nhưng không selection feedback.
- Read-only move log/combat feed.
- Reconnect/resync không tạo false result.

### Not Found/App Error

- Not Found có logo, giải thích, Về sảnh.
- Error boundary có mã lỗi, retry/reload và không lộ stack.
- Không dùng fatal dark screen thiếu next action.

### Acceptance

- Spectator no-op click không đổi state.
- Private/password/error copy Vietnamese.
- Error boundary screenshot Light/Dark/Reduced.

---

## 17. Cross-cutting QA — Wave B13

### Accessibility

- Roving focus board.
- Arrow/Enter/Space/Escape behavior.
- Live regions turn/countdown/capture/reconnect/result.
- Focus visible ≥3px cyan.
- Axe scan mỗi screen family.
- Text ≥4.5:1, glyph ≥3:1.
- Color-blind side motif/shape test.
- Không phụ thuộc hover.

### Responsive

- 375×812 portrait.
- 768×1024 tablet.
- 1366×768 desktop.
- 1920×1080 wide desktop.
- Mobile landscape game.
- Safe-area bottom nav/drawer.
- Không overflow ngang.

### Motion/audio safety

- Normal/Reduced Motion snapshots.
- Flash ≤3Hz.
- Full-screen burst tối đa một frame/80ms/12% luminance.
- Shake ≤3px/150ms, không lặp trong 400ms.
- Tab hidden pause/resume.
- Autoplay blocked silent.
- Audio luôn có visual counterpart.

### Performance

- High/Medium/Low deterministic tier.
- p95 frame >24ms/3s hạ tier.
- High effect cost ≤4ms/frame.
- VFX+audio added JS ≤60KB gzip.
- BGM ≤5MB lazy-load.
- DPR/particle/FPS cap đúng tier.
- Không thêm WebGL/video/dependency nếu chưa có justification.

### Wave B13 execution evidence (đã thực thi)

Chi tiết: [B13_CROSS_CUTTING_QA.md](B13_CROSS_CUTTING_QA.md).

- [x] Semantic board grid: row/gridcell structure, roving focus, Arrow/Enter/Space/Escape and live selection state.
- [x] Axe WCAG 2A/2AA scans across public/auth/recovery, history/social/settings/local and online game families: 0 critical/serious violations.
- [x] Light-theme contrast corrections, side ink/shape redundancy and focus-visible contract.
- [x] Responsive matrix 375×812, 768×1024, 1366×768, 1920×1080 with no horizontal overflow.
- [x] Reduced-motion + low-tier browser gate and three-second p95 frame downgrade monitor.
- [x] 28/28 full frontend E2E tests passed; web 54 component tests passed; typecheck/lint/build gate executed.

---

## 18. Backend/contract work package

Frontend plan không tự triển khai game-rule, nhưng phải block đúng dependency:

| Dependency | Owner | Frontend consumer | Acceptance |
|---|---|---|---|
| eventId/stateVersion | contracts/server | event bus/resync | duplicate/stale event test |
| MOVE/CAPTURE payload | game server | trail/combat feed | from/to/piece/captured/side |
| Goal Tension helper | game-rules | board/goal VFX | NONE/LEVEL_1/LEVEL_2 + threat side |
| Elo before/after/delta | rating/match | result count-up | non-ranked null |
| ready/countdown timestamp | match server | VS/waiting | state race test |
| reconnect/resync | realtime | overlays/coalesce | monotonic version |
| move log/combat feed | match snapshot | right rail | order/truncation/mobile |
| final thumbnail | history | detail | canonical read-only |
| rank input | profile/auth | badge | Elo only, client tier |
| privacy/presence | social server | friends/profile | policy enforcement |

Nếu backend dependency thiếu, phải tạo contract ticket + test fixture + owner + exit criteria trước khi page Wave được sign-off.

---

## 19. Test strategy

### Unit/component

- Token/theme/typography.
- SVG glyph/occupancy/contrast.
- Board orientation/keyboard/semantic state.
- Event bus dedupe/coalesce/cleanup.
- VFX tier/reduced-motion/fallback.
- Audio cue/context/mute/volume.
- Rank boundaries/badge/non-ranked.
- Settings persistence/quality downgrade.
- Goal Tension helper và canonical setup.

### Integration/contract

- Snapshot stateVersion.
- MOVE/CAPTURE/RESULT payload.
- Goal Tension.
- VS/ready/countdown race.
- Reconnect/resync.
- Elo and result reason.
- History thumbnail/combat feed.
- Privacy/block/invite.

### E2E

- Auth/recovery.
- Homepage room/friends/realtime.
- Queue/cancel/VS/waiting.
- Online Blue/Red orientation.
- Local/AI no rotation.
- Spectator canonical/no selection.
- Result reason/rematch.
- History/detail.
- Profile/edit/block.
- Friends/invite.
- Settings/audio/quality/theme.
- Guest import/offline handoff.
- Keyboard/reduced motion.

### Visual/performance

- Browsers: Chrome/Edge desktop, Chrome Android, Safari iOS.
- Viewports: 375×812, 768×1024, 1366×768, 1920×1080.
- Theme: Light/Dark/System.
- Motion: Normal/Reduced.
- Visual snapshot theo page × state × mode.
- Axe scan và keyboard trace.
- Performance trace và bundle budget trong CI.

---

## 20. Wave sign-off format

Mỗi Wave phải cập nhật:

1. Files/components đã thay đổi.
2. Output visual trước/sau.
3. State matrix coverage.
4. Backend dependency status.
5. Unit/integration/E2E results.
6. Visual regression evidence.
7. Performance/accessibility evidence.
8. Known deferred/tunable item.
9. Rollback/fallback path.
10. BA/QA verdict.

Không được đánh dấu Wave hoàn tất chỉ vì build pass.

---

## 21. Final 100% release gate — Wave B14

Chỉ release khi:

- 100% acceptance item đã chốt có implementation và evidence.
- Không còn P0/P1 blocker.
- P2 deferred/tunable được 06B §17 cho phép và ghi rõ.
- Không còn emoji piece/UI decoration trái decision log.
- a1/i9 setup và orientation regression pass.
- Event bus/canvas/audio/quality tier pass.
- Toàn bộ route/state matrix pass.
- Light/Dark/System, Normal/Reduced, desktop/mobile pass.
- Keyboard/axe/contrast/screen-reader pass.
- Performance/bundle/audio budgets pass.
- Backend dependency matrix có owner và completion evidence.
- Independent BA/QA review kết luận READY FOR RELEASE.

Chỉ khi Wave B14 pass mới được tuyên bố **100% frontend/UI/UX v0.2**.

### Wave B14 execution evidence (đã thực thi)

Chi tiết: [B14_RELEASE_GATE.md](B14_RELEASE_GATE.md).

- [x] Production release gate audits route inventory, canonical a1/i9 setup, vector-only UI decoration and forbidden WebGL/video.
- [x] All 16 06B synthesized SFX cues are present behind one shared lazy AudioContext; BGM is opt-in, lazy, attributed and budgeted.
- [x] Initial JS 129.7 KB gzip, total JS 184.9 KB gzip, VFX/audio source 8.3 KB gzip, BGM 689.1 KB total.
- [x] B14 route/theme/motion/audio Playwright matrix passes; existing full frontend E2E remains green.
- [x] `release:gate` is wired into CI immediately after production build.
- [ ] Physical Safari iOS/Chrome Android trace and independent human BA/QA attachment remain release-ticket activities; automated gate is READY FOR RELEASE.

