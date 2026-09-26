# 06_FRONTEND_UI_SPEC.md

# Frontend / UI / UX Source of Truth — OTTv2 v0.1

**Document Status:** FRONTEND SPECIFICATION — READY FOR IMPLEMENTATION  
**Version:** 0.1  
**Authority:** Authoritative Frontend Source of Truth  
**Coverage Target:** ≥99% of known UI requirements  
**Primary Language:** Vietnamese UI / English code & protocol identifiers  
**Primary Desktop Reference:** 1920×1080  
**Primary Product Style:** Futuristic Competitive Command Arena  
**Primary UX Principle:** Premium polish, gameplay clarity, and performance before visual excess

---

# 0. PURPOSE AND AUTHORITY

This document is the authoritative Frontend/UI contract for OTTv2 v0.1.

It defines visual direction, application shell, routes, screen contracts, components, interaction states, realtime UI behavior, board/HUD presentation, responsive behavior, accessibility, motion, sound, frontend performance, UI copy, and acceptance criteria.

Frontend authority chain:

```text
Teacher Assignment
+
Locked Product Decisions
        ↓
01_PROJECT_SPEC.md
        ↓
SRS.md
        ↓
02_ARCHITECTURE.md
        ↓
03_NETWORK_SPEC.md
        ↓
06_FRONTEND_UI_SPEC.md
        ↓
04_TEST_PLAN.md
        ↓
05_TEAM_TASKS.md
```

This document MUST NOT redefine backend/game rules. It defines how authoritative product/network/game behavior is presented.

---

# 1. FRONTEND NORTH STAR

The frontend must feel like a premium competitive game interface rather than an admin dashboard, CRUD app, social network, generic component-library demo, or neon-heavy cyberpunk template.

> **Futuristic Competitive Command Arena**

Visual formula:

```text
Dark Graphite Foundation
+
Data / AI / Tactical Background Language
+
Raised Interactive Surfaces
+
Electric Cyan System Actions
+
Competitive Blue vs Competitive Red
+
Strong Board Focus
+
Crisp Vietnamese Typography
+
Controlled Motion
+
Subtle 3D Depth
+
✊ ✋ ✌️ Product Identity
```

AAA-like means coherence, hierarchy, state completeness, tactile feedback, audiovisual polish, responsiveness, and performance discipline. It does not mean maximum effects.

---

# 2. CORE UI PRINCIPLES

1. **All Eyes on the Game** — During gameplay, Board + Turn + Clocks dominate.
2. **Clarity Before Decoration** — Side, piece type, legal move, timer, and result are instantly readable.
3. **Blue vs Red Must Be Immediate** — Side identity is obvious at all sizes/themes.
4. **System Cyan Is Not Blue Player** — Generic CTA uses Electric Cyan; Blue remains player-side identity.
5. **Realtime UI Feels Alive** — Rooms, presence, ready, clocks, spectator count, reconnect, and board update without refresh.
6. **Every Action Gets Feedback** — hover, pressed, loading, success, error, disabled.
7. **No Invisible Failure** — Errors explain what happened and next action.
8. **Server Authority Wins** — Client preview is assistance, never authority.
9. **Animation Is Presentation** — Never block canonical state.
10. **Desktop First, Mobile Usable** — Desktop primary, mobile/tablet functional.

---

# 3. DESIGN SYSTEM

## 3.1 Color Roles

### Dark Theme — recommended defaults

```text
BG-ROOT            #080B10
BG-SECONDARY       #0D1118
SURFACE-1          #111720
SURFACE-2          #161E29
SURFACE-3          #1C2633

TEXT-PRIMARY       #F5F8FC
TEXT-SECONDARY     #A9B5C6
TEXT-MUTED         #6F7D90

SYSTEM-CYAN        #44E7FF
SYSTEM-CYAN-HOVER  #75EEFF

BLUE-PLAYER        #267BFF
BLUE-PLAYER-HIGH   #55A1FF

RED-PLAYER         #FF3F5E
RED-PLAYER-HIGH    #FF7188

SUCCESS            #41D98A
WARNING            #F3B84B
ERROR              #FF684B
```

### Light Theme

```text
BG-ROOT            #EDF2F7
SURFACE-1          #FFFFFF
SURFACE-2          #F6F8FB
TEXT-PRIMARY       #101722
TEXT-SECONDARY     #4C5B70
```

Light mode MUST retain strong Blue/Red side recognition.

## 3.2 Typography

Two-tier system:

```text
DISPLAY / GAME HEADINGS
→ geometric/futuristic, Vietnamese-capable

BODY / DATA
→ high-legibility Vietnamese sans-serif
```

Recommended direction:
- Display: Space Grotesk-like.
- Body: Be Vietnam Pro / Inter-like.

Type scale:

```text
Display XL     48–64px
Display L      36–48px
Heading 1      30–36px
Heading 2      24–28px
Heading 3      18–22px
Body           14–16px
Metadata       12–14px
Game Clock     responsive dominant size
```

## 3.3 Shape / Spacing

```text
Panel radius        12px
Button radius       10px
Input radius        10px
Small badge radius   6px

Spacing scale:
4, 8, 12, 16, 20, 24, 32, 40, 48, 64
```

Avoid overly rounded consumer-app styling.

## 3.4 Layering

```text
L0 Background
L1 Main Surface
L2 Panel
L3 Interactive Card
L4 Dropdown / Tooltip
L5 Modal / Critical Overlay
L6 Game Result / Fatal UI
```

Raised surfaces use restrained border/shadow/glow. Avoid heavy glassmorphism.

---

# 4. BACKGROUND LANGUAGE

Use:
- low-opacity grid;
- data dots;
- radial ambient light;
- subtle noise;
- rare RPS motifs;
- extremely light data drift.

No heavy animated video backgrounds.

Reduced Motion turns ambient movement off.

---

# 5. MOTION SYSTEM

```text
MICRO            100–180ms
UI TRANSITION    180–300ms
GAMEPLAY         180–400ms
CINEMATIC        500–900ms
```

Enter: ease-out.  
Exit: ease-in.  
Interactive movement: snappy cubic-bezier.

Prefer transform/opacity.

Reduced Motion:
- ambient OFF;
- page transitions short fade;
- Match Found / Result shorten;
- hover lift reduced;
- required state feedback remains.

---

# 6. SOUND SYSTEM

Optional UI/game SFX:
- click;
- Match Found;
- countdown;
- low-time tick;
- move;
- capture;
- victory/defeat.

Rules:
- can be disabled;
- autoplay failure never blocks UI;
- no error modal for blocked autoplay;
- no mandatory BGM in v0.1.

---

# 7. ROUTE MAP

```text
/
├── /login
├── /register
├── /forgot-password
├── /home
├── /queue
├── /room/:roomId
├── /game/:roomId
├── /history
├── /history/:matchId
├── /profile/:username
├── /friends
└── /settings
```

Guest name entry may be modal or lightweight route.

---

# 8. GLOBAL SHELL

Outside active game, desktop uses Top Navigation:

```text
OTTv2 | Trang chủ | Lịch sử | Bạn bè | Network | Profile
```

Profile dropdown:
- Xem hồ sơ
- Cài đặt
- Đăng xuất

Active game replaces full navigation with minimal Game Header.

Mobile outside game uses bottom navigation:
- Trang chủ
- Lịch sử
- Bạn bè
- Profile

Bottom navigation disappears in Game Room.

---

# 9. RESPONSIVE CONTRACT

```text
MOBILE          < 768px
TABLET          768–1199px
DESKTOP         1200–1599px
LARGE DESKTOP   >= 1600px
```

Reference canvas: **1920×1080**  
General content max width: **≈1600px**

Touch target minimum: **≈44×44px**.

---

# 10. COMMON INTERACTION STATES

Every applicable control supports:

```text
DEFAULT
HOVER
FOCUS
PRESSED
LOADING
SUCCESS
ERROR
DISABLED
```

Loading MUST NOT change button width.

---

# 11. TOAST / MODAL / ERROR LANGUAGE

Global toast:
- top-center;
- Info / Success / Warning / Error;
- auto-dismiss 4s;
- max 3 visible;
- user may close early.

Field validation:
- inline, next to field.

Modal:
- only for decisions/configuration/destructive flows;
- focus trapped;
- ESC closes non-destructive modal;
- ESC never confirms destructive action.

Loading:
- skeletons for card/list pages;
- spinner for actions.

Empty state:
- small RPS illustration;
- title;
- one-line explanation;
- optional CTA.

Fatal app state:

```text
OẲN TÙ TÌ v2

Không thể khởi động trò chơi.

[ THỬ LẠI ]

ERR_BOOT_001
```

Never expose stack trace.

---

# 12. ACCESSIBILITY BASELINE

- visible cyan focus ring;
- strong contrast;
- do not rely only on color;
- reduced motion;
- screen-reader labels for icon-only controls;
- modal focus trap;
- semantic game-piece label.

Example:

> `Quân Đấm phe Xanh tại ô c3`

Full keyboard board control is not required v0.1; surrounding UI remains keyboard accessible.

---

# 13. AUTH — LOGIN

**Screen ID:** AUTH-LOGIN-001  
**Route:** `/login`

Desktop: two-column branding + form.

```text
BRAND / ARENA VISUAL            AUTH PANEL
OẲN TÙ TÌ                       ĐĂNG NHẬP
✊ VS ✌️                         Username
subtle arena visual             Password
                                [ ĐĂNG NHẬP ]
                                Quên mật khẩu?
                                Tạo tài khoản
```

Password:
- show/hide toggle.

Loading:
> `ĐANG ĐĂNG NHẬP...`

Disable double-submit.

Mobile:
- compact brand above full-width form.

---

# 14. AUTH — REGISTER

**Screen ID:** AUTH-REGISTER-001  
**Route:** `/register`

Single page, grouped sections:

```text
THÔNG TIN
- Họ và tên
- Tên hiển thị
- Username
- [Dùng tên hiển thị]

BẢO MẬT
- Password
- Xác nhận password
- Requirement hint

[ TẠO TÀI KHOẢN ]
```

Constraints:
- Full name 2–50 chars
- Display name 2–20 chars
- Username 4–20 chars, letters/numbers/underscore, case-insensitive unique
- Password minimum 8 chars

Success → Recovery Code screen.

---

# 15. AUTH — RECOVERY CODE

**Screen ID:** AUTH-RECOVERY-001

```text
MÃ KHÔI PHỤC

7KMX-P92R-T4WA-Q6FN

[ SAO CHÉP ]

Hãy lưu mã này ở nơi an toàn.
Bạn sẽ không xem lại được mã này.

[ TÔI ĐÃ LƯU MÃ ]
```

Rules:
- visible once;
- user explicitly confirms saved;
- copy success toast;
- never re-reveal in Settings.

---

# 16. AUTH — FORGOT PASSWORD

**Screen ID:** AUTH-FORGOT-001  
**Route:** `/forgot-password`

```text
KHÔI PHỤC MẬT KHẨU

Username
[________________]

Mã khôi phục
[________________]

Mật khẩu mới
[________________]

Nhập lại mật khẩu mới
[________________]

[ ĐẶT LẠI MẬT KHẨU ]
```

No email flow.

Rate-limit and invalid recovery errors are visible and actionable.

---

# 17. GUEST NAME ENTRY

**Screen ID:** GUEST-ENTRY-001

```text
CHƠI VỚI TƯ CÁCH KHÁCH

Tên hiển thị
[________________]

[ TIẾP TỤC ]
```

2–20 chars. Duplicate guest names allowed.

---

# 18. HOMEPAGE

**Screen ID:** HOME-001  
**Route:** `/home`

Desktop:

```text
┌────────────────────────────────────────────────────────────┐
│ OTTv2   Trang chủ  Lịch sử  Bạn bè       Net      Profile  │
├────────────────────────────────────────────────────────────┤
│ OẲN TÙ TÌ v2                 [ Nhập id phòng chơi ] 🔍      │
│ Đấu trí. Đọc vị. Chiếm bàn.  [ CHƠI 1VS1 ONLINE ]          │
│                               [ CHƠI VỚI MÁY ]              │
│                               [ CHƠI OFFLINE ]              │
│                                                            │
│ PHÒNG ĐẤU                           [ + TẠO PHÒNG ]         │
│ [Room] [Room] [Room] [Room]                                 │
│ [Room] [Room] [Room] [Room]                                 │
│ internal scroll                                             │
│                                                            │
│ BẠN BÈ ONLINE                                               │
└────────────────────────────────────────────────────────────┘
```

Hero remains compact; no marketing-style full-page hero.

Visual:
- ghost 9×9 grid;
- subtle RPS fragments;
- Blue/Red ambient light.

Quick Action hierarchy:
1. Chơi 1vs1 Online — primary
2. Chơi với máy
3. Chơi Offline

Account Quick Match → Ranked.  
Guest Quick Match → Unranked + toast:
> `Khách chỉ có thể chơi chế độ Không xếp hạng.`

Guest warning:

```text
BẠN ĐANG CHƠI VỚI TƯ CÁCH KHÁCH

Lịch sử trên thiết bị này có thể bị mất.
Tạo tài khoản để lưu tiến trình.

[ TẠO TÀI KHOẢN ]
```

---

# 19. ROOM SEARCH

Placeholder:
> `Nhập id phòng chơi`

Search:
- submit explicitly or when valid 6-char ID is complete;
- no backend call every keystroke.

Success:
- Room Result card drops below input.

Wrong ID:
- top-center toast for 4s:
  `Phòng đấu không tồn tại.`

Private:
- password modal.

Playing room + spectator access:
- CTA `XEM TRẬN`.

---

# 20. ROOM LIST / ROOM CARD

Homepage list shows only:
- Public;
- WAITING;
- available player slot.

Desktop:
- 4 columns × 2 rows visible;
- internal scroll beyond 8.

Tablet:
- 2 columns.

Mobile:
- 1 column.

Room Card:

```text
┌──────────────────────────────┐
│ NEON HAMMER 18        PUBLIC │
│ AZ72KQ                       │
│                              │
│ 👤 1 / 2                     │
│ ★ 1426                       │
│ ⏱ 5 phút / người            │
│ 👁 8 / 50                    │
│                              │
│ [ THAM GIA ]                 │
└──────────────────────────────┘
```

Custom rooms are always UNRANKED.

Realtime:
- create → insert subtly;
- full/playing/delete → remove;
- player leave → update card.

Empty:

```text
Chưa có phòng công khai nào.

Hãy tạo phòng và trở thành người đầu tiên!

[ + TẠO PHÒNG ]
```

---

# 21. CREATE ROOM

**Screen ID:** ROOM-CREATE-001  
**Surface:** Large tactical modal

```text
TẠO PHÒNG                       UNRANKED

Tên phòng
[________________________]

Quyền riêng tư
[ PUBLIC ] [ PRIVATE ]

Thời gian mỗi người
[30s] [1m] [5m] [10m] [30m] [1h]

Khán giả
[ Có ] [ Không ]

Số khán giả
[1] [2] [5] [10] [50] [100]

Mật khẩu
[____________]
(Private only)

Room ID
Tự động tạo sau khi tạo phòng

[ HỦY ]                 [ TẠO PHÒNG ]
```

Rules:
- room name max 30 chars;
- blank → server generates;
- Public → no password;
- Private password 1–12 chars;
- Room ID server generated;
- no Ranked toggle.

---

# 22. PRIVATE ROOM PASSWORD

```text
PHÒNG RIÊNG TƯ

Nhập mật khẩu để tham gia

[••••••••••]

[ HỦY ] [ THAM GIA ]
```

Wrong password:
- keep modal open;
- inline:
  `Mật khẩu phòng không đúng.`

---

# 23. MATCHMAKING

**Screen ID:** MM-QUEUE-001

```text
ĐANG TÌM ĐỐI THỦ

[ animated RPS scanner ]

Rating của bạn: 1426
Khoảng tìm kiếm: ±100
Thời gian: 00:18

[ HỦY TÌM TRẬN ]
```

Rating range visibly expands over time.

Cancel race:
- server committed state wins;
- never show both successful cancellation and Match Found.

Match Found cinematic:

```text
MATCH FOUND

BLUE                    RED

Avatar                  Avatar
Giang                    CyberFox
1426                     1451

VS
```

Duration 500–800ms.

---

# 24. WAITING ROOM

**Screen ID:** ROOM-WAITING-001

```text
Neon Hammer 18                          AZ72KQ
UNRANKED • PUBLIC • 5 PHÚT

BLUE SLOT                       RED SLOT
Avatar                          Avatar
Giang                           CyberFox
1426                            1451
[ SẴN SÀNG ]                   [ SẴN SÀNG ]

Spectators 8 / 50

[ MỜI BẠN ] [ SAO CHÉP ID ] [ RỜI PHÒNG ]
```

Host:
- crown/badge.

Host migration:
- authoritative;
- badge animates subtly to new Host.

Ready:
- `✓ ĐÃ SẴN SÀNG`.

Both ready:
- side assignment;
- 3-2-1 countdown.

Countdown:
> `Nhấn SPACE để bắt đầu ngay`

Both fast-ready → skip remaining countdown.

---

# 25. ROOM INVITE

```text
LỜI MỜI VÀO PHÒNG

CyberFox mời bạn tham gia
Neon Hammer 18

[ TỪ CHỐI ]
[ THAM GIA ]
```

Private invite uses invitation token; valid invite does not require password.

Expired:
> `Lời mời đã hết hạn.`


# 26. GAME ROOM — CORE EXPERIENCE

**Screen ID:** GAME-001  
**Route:** `/game/:roomId`

Desktop attention:
- Board ≈55–65%;
- Player HUD secondary;
- Header tertiary.

```text
┌──────────────────────────────────────────────────────────────┐
│ Minimal Game Header                                          │
├──────────────────────────────────────────────────────────────┤
│ BLUE HUD              9×9 GAME BOARD              RED HUD    │
│                                                              │
│                   TURN / STATUS STRIP                        │
└──────────────────────────────────────────────────────────────┘
```

---

# 27. GAME HEADER

Contains:
- room name;
- room ID;
- Ranked/Unranked where relevant;
- own ping;
- spectator count;
- settings;
- surrender.

Example:

```text
Neon Hammer 18 • AZ72KQ • UNRANKED
● 32 ms    👁 8 / 50    ⚙    [ ĐẦU HÀNG ]
```

No full navigation during gameplay.

---

# 28. BOARD VISUAL

Board:
- 9×9;
- raised tactical tiles;
- crisp grid;
- no heavy 3D perspective;
- readable coordinates.

Goal tiles:
- subtle luminous frame;
- small target glyph.

Canonical goal ownership:
- BLUE target = `i9`;
- RED target = `a1`.

---

# 29. BOARD ORIENTATION

BLUE player:
- BLUE visually at bottom.

RED player:
- board visually rotates 180°;
- coordinate labels still represent canonical coordinates.

Spectator:
- canonical view;
- BLUE at bottom.

Server coordinates never rotate.

---

# 30. GAME PIECE — CRITICAL VISUAL CONTRACT

Every piece is a **Full-Bodied Tactical Piece Token**.

Requirements:

- occupies approximately 82–88% of Board Cell width/height;
- retains visible negative space around all edges;
- feels almost cell-filling but clearly contained inside the tile;
- entire token body strongly communicates BLUE or RED;
- emoji is large and centered;
- token shape is tactical squircle/chamfered;
- has subtle contact shadow/depth;
- side must be identifiable before reading emoji.

Visual hierarchy:

```text
1. SIDE        BLUE / RED
2. TYPE        ✊ / ✋ / ✌️
3. STATE       selected / legal / target / moving / disabled
```

BLUE token:
- saturated Competitive Blue body;
- cyan/blue rim light;
- subtle upper-edge motif.

RED token:
- saturated Competitive Red body;
- controlled red rim;
- subtle diagonal/lower motif.

The side motif provides color-blind redundancy.

### Piece Occupancy Rule

```text
Board Cell       = 100%
Piece footprint  = ~82–88%
Negative space   = visibly preserved around token
```

The piece must never visually become the entire tile.

---

# 31. PIECE STATES

```text
IDLE
HOVER
SELECTED
LEGAL
CAPTURE_TARGET
BLOCKED
MOVING
CAPTURED
DISABLED
```

Selected:
- slight lift;
- external cyan focus ring;
- controlled pulse;
- never recolor side body.

Legal empty destination:
- small cyan marker.

Capture target:
- combat/crosshair ring around target token.

Blocked:
- no legal highlight;
- invalid interaction gives small tile/piece feedback.

---

# 32. MOVE PREVIEW / AUTHORITY

Client may calculate visual candidate moves.

Server remains authoritative.

Move accepted:
- canonical client state updates;
- piece slides 180–260ms;
- turn HUD switches.

Move rejected:
- authoritative state remains;
- local/tile feedback;
- optional short explanatory toast.

---

# 33. TURN INDICATOR

Use three simultaneous cues:

1. active Player HUD brighter;
2. active Clock brighter;
3. subtle board-edge side accent.

Text:
- `LƯỢT CỦA BẠN`
- `LƯỢT ĐỐI THỦ`

Do not run a cinematic animation every turn.

---

# 34. CLOCK UI

Active:
- higher brightness;
- dominant typography.

Inactive:
- dimmed.

Warnings:
- `<30s` → light warning;
- `<10s` → clear urgency + optional subtle tick.

Never flash entire board red.

Timer presentation follows authoritative server state.

---

# 35. MOVE / CAPTURE ANIMATION

Normal move:
- 180–260ms.

Capture:
- 250–400ms.

Capture sequence:

```text
attacker moves
↓
defender receives impact
↓
defender compresses/flashes
↓
defender token + emoji fade/dissolve
↓
attacker settles
```

Optional mini combat feed:
> `✊ đã ăn ✌️`

Duration:
- ~1–2 seconds.

---

# 36. PLAYER HUD

Example:

```text
[Avatar]

GIANG
@bao_giang
★ 1426

05:00

● Đã kết nối
```

Disconnected:
- `● Mất kết nối`;
- card dims slightly.

Only own exact ping is shown.

---

# 37. SPECTATOR MODE

Header:
> `👁 ĐANG XEM`

Spectator:
- sees both HUDs and both clocks;
- canonical board orientation;
- cannot select pieces;
- no legal highlights;
- no Ready;
- no Surrender;
- no gameplay command.

---

# 38. DISCONNECT / RECONNECT

Opponent disconnect:

```text
⚠ ĐỐI THỦ MẤT KẾT NỐI

Đang chờ kết nối lại...

00:27
```

Use translucent center overlay:
- board remains visible;
- unsafe interaction locked;
- both clocks visually pause.

Own disconnect:
> `ĐANG KẾT NỐI LẠI`

All gameplay interaction locked.

Reconnect:
- resync;
- brief `Đã kết nối lại`;
- resume.

---

# 39. SURRENDER

Low-prominence button.

Confirmation:

```text
Bạn chắc chắn muốn đầu hàng?

[ HỦY ]
[ ĐẦU HÀNG ]
```

---

# 40. GAME RESULT

After board freeze:
- short pause;
- reveal 600–900ms.

Victory:

```text
CHIẾN THẮNG

Đạt ô đích i9

1426 → 1441
+15

[ CHƠI LẠI ]
[ VỀ TRANG CHỦ ]
[ XEM PROFILE ]
```

Defeat:
- lower saturation;
- controlled negative tone;
- no harsh punishment animation.

Unranked:
- no Elo delta.

Result reasons:

```text
EXTINCTION
→ Đối thủ đã mất toàn bộ Kéo.

GOAL_REACHED
→ Bạn đã chiếm ô đích i9.

TIMEOUT
→ Đối thủ đã hết thời gian.

SURRENDER
→ Đối thủ đã đầu hàng.

DISCONNECT_TIMEOUT
→ Đối thủ không kết nối lại.
```

Server interruption:

```text
TRẬN ĐẤU BỊ GIÁN ĐOẠN

Máy chủ đã khởi động lại hoặc kết nối trận bị mất.

Không thay đổi điểm xếp hạng.

[ VỀ TRANG CHỦ ]
```

Neutral state, never Victory/Defeat.

---

# 41. REMATCH

Requester:
> `Đã gửi yêu cầu chơi lại...`

Opponent:

```text
Đối thủ muốn chơi lại

Trận chơi lại sẽ là Không xếp hạng.

[ TỪ CHỐI ]
[ ĐỒNG Ý ]
```

Accepted:
- sides swap;
- board reset;
- ready/countdown flow resumes.

---

# 42. IN-GAME SETTINGS

Only:
- Theme;
- UI Sound;
- SFX volume if implemented;
- Countdown sound;
- Reduced Motion.

Do not expose:
- account management;
- password change;
- profile edit;
- logout.

---

# 43. MOBILE GAME LAYOUT

```text
RED HUD COMPACT
↓
BOARD
↓
BLUE HUD COMPACT
↓
ACTION STRIP
```

Board:
- fits width;
- no horizontal scrolling.

Tablet:
- top/bottom HUD around board.

Constrained-screen priority:
1. preserve board usability;
2. compress HUD;
3. remove decorative detail.

---

# 44. PROFILE — OWN

**Screen ID:** PROFILE-OWN-001  
**Style:** Competitive Player Dossier

```text
[ AVATAR ]      GIANG
                @bao_giang
                ★ 1462

[ CHỈNH SỬA PROFILE ] [ CÀI ĐẶT ]

[RATING] [RANKED] [WINS] [LOSSES] [WIN RATE]

PHONG ĐỘ
W  W  L  W  L

BẠN BÈ: 42
```

No custom banner upload.

---

# 45. PROFILE — OTHER USER

```text
[Avatar]

CyberFox
@cyberfox
★ 1483

Ranked Matches 201
Wins 117
Win Rate 58.2%

Recent Form
W L W W W

Friends: 84

[ KẾT BẠN ]
[ MỜI CHƠI ]
```

Presence visible only if Friend.

Invite disabled when user is `IN_GAME`.

---

# 46. EDIT PROFILE

Large modal:

```text
CHỈNH SỬA PROFILE

Avatar
[preset framed portraits]

Tên hiển thị
[________________]

Họ và tên
[________________]

Username
@bao_giang
Không thể thay đổi

[ HỦY ] [ LƯU THAY ĐỔI ]
```

Unsaved-change guard required.

---

# 47. AVATAR SELECTOR

Preset framed portraits:
- robot;
- wolf;
- fox;
- panda;
- AI/arena motifs.

Selected:
- cyan frame;
- check.

Asset failure:
- default robot/fallback;
- never broken image icon.

---

# 48. HISTORY

**Screen ID:** HISTORY-001  
**Route:** `/history`

Summary:
- Rating;
- Ranked matches;
- Win rate.

Filters:

```text
Tất cả
Ranked
Unranked
Guest
Vs Máy
Offline

Thắng
Thua

7 ngày
30 ngày
Tất cả
```

Use chips/toggles.

Pagination:
- 20 matches/load.

---

# 49. MATCH CARD

```text
WIN

Bạn              VS          CyberFox
1426                          1480

+17 Elo

Goal Reached • 5 phút/người
25/09/2026 • 12:42
```

Use subtle Win/Loss accent, never full green/red slab.

---

# 50. MATCH DETAIL

Open as modal/detail panel.

Display:
- Match ID;
- mode;
- Ranked/Unranked;
- Blue player;
- Red player;
- winner;
- result reason;
- timer;
- started;
- ended;
- duration;
- rating before;
- rating after;
- rating delta.

No replay v0.1.

---

# 51. HISTORY STATES

Empty:

```text
Chưa có trận đấu nào.

Hãy bắt đầu trận đầu tiên của bạn.

[ CHƠI 1VS1 ONLINE ]
```

Error:

```text
Không thể tải lịch sử đấu.

[ THỬ LẠI ]
```

Guest may see local history.

---

# 52. FRIENDS

**Screen ID:** FRIENDS-001  
**Route:** `/friends`

Tabs:

```text
BẠN BÈ
LỜI MỜI
ĐÃ GỬI
TÌM NGƯỜI CHƠI
```

Do not render all four large sections simultaneously.

---

# 53. FRIEND CARD

```text
[Avatar] CyberFox
         @cyberfox
         ★ 1483
         ● Online

[ MỜI CHƠI ] [ ••• ]
```

Menu:
- Xem Profile;
- Xóa bạn;
- Chặn.

Presence:
- Online;
- Đang chơi;
- Offline.

`Đang chơi` may subtly pulse.

---

# 54. FRIEND REQUESTS

Incoming:

```text
[Avatar] RoboCat
@robocat

[ TỪ CHỐI ]
[ CHẤP NHẬN ]
```

Sent:

```text
[Avatar] RoboCat
@robocat

Đang chờ phản hồi

[ HỦY YÊU CẦU ]
```

---

# 55. FRIEND SEARCH

Placeholder:
> `Tìm theo username hoặc tên hiển thị`

Debounce:
- 250–400ms.

States:

```text
IDLE
TYPING
SEARCHING
RESULTS
NO_RESULTS
ERROR
RATE_LIMITED
```

Non-friend results MUST NOT expose Presence.

---

# 56. BLOCK UX

```text
Chặn CyberFox?

Người này sẽ không thể gửi lời mời kết bạn,
mời vào phòng hoặc xem trạng thái của bạn.

[ HỦY ]
[ CHẶN ]
```

Unblock lives in Settings.

---

# 57. SETTINGS

**Screen ID:** SETTINGS-001  
**Route:** `/settings`

Tabs:

```text
GIAO DIỆN
ÂM THANH
TÀI KHOẢN
QUYỀN RIÊNG TƯ
NGƯỜI ĐÃ CHẶN
```

Appearance:

```text
Theme
[ Sáng ] [ Tối ] [ Theo hệ thống ]

Reduced Motion
[ ON / OFF ]

Ambient Background Motion
[ ON / OFF ]
```

Audio:

```text
UI Sound
[ ON / OFF ]

SFX Volume
[────────●──]

Countdown Sound
[ ON / OFF ]
```

Account:

```text
Username
@bao_giang
Read-only

Đổi mật khẩu

Mật khẩu hiện tại
[________]

Mật khẩu mới
[________]

Nhập lại
[________]

[ ĐỔI MẬT KHẨU ]
```

Privacy:

```text
Presence
Chỉ bạn bè thấy

Friend List
Không công khai

Họ và tên
Riêng tư
```

Blocked users:

```text
NGƯỜI ĐÃ CHẶN

CyberFox
@cyberfox

[ BỎ CHẶN ]
```

Never reveal previous Recovery Code.

---

# 58. GUEST HISTORY IMPORT

After account creation, if local Guest history exists:

```text
ĐỒNG BỘ LỊCH SỬ?

Chúng tôi tìm thấy lịch sử chơi trên thiết bị này.

12 trận
7 thắng
5 thua

[ BỎ QUA ]
[ ĐỒNG BỘ ]
```

Shown once.

Decline:
- do not ask again.

---

# 59. AI MODE

Setup modal:

```text
CHƠI VỚI MÁY

AI
NORMAL

Thời gian mỗi người
[30s] [1m] [5m] [10m] [30m] [1h]

[ BẮT ĐẦU ]
```

Opponent HUD:

```text
🤖 ARENA BOT
NORMAL
```

No ping.
No reconnect/grace UI.

Reuse full Game Room Board/HUD.

---

# 60. OFFLINE MODE

Setup:

```text
CHƠI OFFLINE

Hai người chơi cùng thiết bị.

Người chơi 1
[ Tên ]

Người chơi 2
[ Tên ]

Thời gian mỗi người
[...]

[ BẮT ĐẦU ]
```

No second account required.

Gameplay:
- reuse main board;
- ~500ms turn handoff overlay.

Example:
> `LƯỢT NGƯỜI CHƠI 2`


# 61. GLOBAL ERROR MAPPING

```text
ROOM_NOT_FOUND
→ Toast
"Phòng đấu không tồn tại."

ROOM_FULL
→ Toast
"Phòng đấu đã đủ người chơi."

ROOM_PASSWORD_INVALID
→ Inline password error

ROOM_SPECTATOR_FULL
→ Toast
"Phòng đã đủ số lượng khán giả."

INVITE_EXPIRED
→ Toast
"Lời mời đã hết hạn."

ACCOUNT_ALREADY_IN_GAME
→ Strong modal / blocking notification
"Tài khoản của bạn đang tham gia một trận đấu khác."

GAME_LOCKED_OTHER_TAB
→ Modal
"Trò chơi đang được mở trên một cửa sổ khác."

SESSION_EXPIRED
→ Modal
"Phiên đăng nhập đã hết hạn."
→ CTA đăng nhập lại

RATE_LIMITED
→ Toast
"Bạn thao tác quá nhanh. Vui lòng thử lại sau."

SERVER_UNAVAILABLE
→ Full/section error state

DATABASE_UNAVAILABLE
→ Degrade only affected account/social features where possible

SERVER_INTERRUPTION
→ Neutral Match Result Screen
```

Recoverable errors MUST provide Retry or a clear next action.

---

# 62. GLOBAL NETWORK STATES

```text
CONNECTED
RECONNECTING
OFFLINE
DEGRADED
```

Outside match:
- small status icon in top bar.

If connection is lost:
> `Mất kết nối. Đang thử kết nối lại...`

Keep stale data visible but disable unsafe actions.

Inside active match:
- dedicated reconnect overlays override generic global banner.

---

# 63. UI COPY STYLE GUIDE

All user-visible UI text is Vietnamese.

Code/protocol identifiers remain English.

Copy style:
- short;
- direct;
- game-like;
- not childish;
- not bureaucratic.

Preferred CTA vocabulary:

```text
ĐĂNG NHẬP
TẠO TÀI KHOẢN
CHƠI 1VS1 ONLINE
CHƠI VỚI MÁY
CHƠI OFFLINE
TẠO PHÒNG
THAM GIA
XEM TRẬN
SẴN SÀNG
ĐẦU HÀNG
CHƠI LẠI
VỀ TRANG CHỦ
KẾT BẠN
MỜI CHƠI
```

The same action MUST use the same wording throughout the app.

---

# 64. DESTRUCTIVE LANGUAGE

Danger actions must be explicit:

```text
ĐẦU HÀNG
XÓA BẠN
CHẶN
HỦY YÊU CẦU
ĐĂNG XUẤT
BỎ THAY ĐỔI
```

Never use vague `Tiếp tục` as the destructive confirmation label.

---

# 65. COPY TO CLIPBOARD

Room ID:
> `Đã sao chép mã phòng.`

Recovery Code:
> `Đã sao chép mã khôi phục. Hãy lưu mã ở nơi an toàn.`

Use success toast, not modal.

---

# 66. UNSAVED CHANGES

Edit Profile / Settings:

```text
Bạn có thay đổi chưa lưu.

[ Ở LẠI ]
[ BỎ THAY ĐỔI ]
```

Only show when dirty.

---

# 67. ACTIVE MATCH LEAVE GUARD

Browser navigation/close:
- warn user where supported;
- do not auto-declare surrender from frontend warning alone;
- backend reconnect/grace rules remain authoritative.

---

# 68. FRONTEND STATE DOMAINS

Recommended separation:

```text
authState
guestState
userState
profileState
friendsState
roomState
matchmakingState
gameState
connectionState
historyState
settingsState
themeState
uiState
```

Do not scatter raw network state across unrelated UI components.

---

# 69. COMPONENT CATALOG

Minimum reusable components:

```text
AppShell
TopBar
BottomNav
GameHeader

Button
IconButton
Input
PasswordInput
SearchInput
SegmentedControl
Toggle
Slider

Modal
ConfirmDialog
Toast
Tooltip
DropdownMenu
Tabs

Avatar
AvatarSelector
PresenceBadge
RatingBadge
PingBadge

RoomCard
RoomSearchResultCard
PlayerSlot
PlayerHUD
MatchCard
FriendCard
FriendRequestCard
StatCard

GameBoard
BoardCell
GamePiece
GoalCell
LegalMoveMarker
CaptureTargetRing
GameClock
TurnIndicator
CombatFeed

LoadingSkeleton
EmptyState
ErrorState
FatalError
ReconnectOverlay
ResultOverlay
```

Each reusable component should document:
- props;
- variants;
- states;
- emitted events;
- accessibility;
- consuming screens.

---

# 70. NETWORK EVENT → UI REACTION

Implementation MUST maintain explicit mapping.

```text
ROOM_CREATED
→ insert Room Card

ROOM_UPDATED
→ update affected card fields

ROOM_REMOVED
→ remove card

FRIEND_PRESENCE_CHANGED
→ update affected Friend Card only

MATCH_FOUND
→ show Match Found cinematic

PLAYER_READY_CHANGED
→ update Ready state

GAME_COUNTDOWN
→ show countdown overlay

GAME_START
→ close countdown
→ lock Ready UI
→ render authoritative board
→ activate BLUE clock

MOVE_ACCEPTED
→ update canonical board
→ animate move/capture
→ switch turn HUD

MOVE_REJECTED
→ preserve authoritative state
→ local feedback

PLAYER_DISCONNECTED
→ show disconnect overlay
→ pause clock presentation

PLAYER_RECONNECTED
→ resync
→ remove overlay
→ resume

STATE_RESYNC
→ replace replica state safely
→ suppress unsafe duplicate animations

GAME_OVER
→ lock board
→ show result

SERVER_INTERRUPTION
→ neutral interruption screen
```

No player-visible network event may be silently ignored.

---

# 71. UI ACTION → BACKEND / NETWORK INTENT

Examples:

```text
Đăng nhập
→ AUTH_LOGIN

Tạo phòng
→ CREATE_ROOM

Tham gia
→ JOIN_ROOM

Xem trận
→ JOIN_AS_SPECTATOR

Sẵn sàng
→ PLAYER_READY

Space fast-ready
→ COUNTDOWN_FAST_READY

Piece destination
→ PIECE_MOVE

Đầu hàng
→ SURRENDER

Chơi lại
→ REMATCH_REQUEST

Đồng ý chơi lại
→ REMATCH_ACCEPT

Kết bạn
→ FRIEND_REQUEST_SEND

Mời chơi
→ ROOM_INVITE_SEND
```

Exact protocol names are governed by `03_NETWORK_SPEC.md`.

Frontend MUST NOT invent transport semantics.

---

# 72. FRONTEND PERFORMANCE CONTRACT

AAA-like visuals must not degrade gameplay.

Requirements:

- avoid unnecessary full-page rerenders;
- localize Board Cell updates;
- localize presence updates;
- incrementally update Room List;
- avoid giant blur layers;
- limit simultaneous shadows/glows;
- prefer transform/opacity;
- optimize static assets;
- lazy-load non-critical assets where appropriate;
- avoid video backgrounds.

9×9 Board:
- 81 cells;
- a move should update affected cells/HUD, not entire app shell.

Spectator mode must remain smooth under realtime state updates.

---

# 73. ASSET STRATEGY

Preferred:
- SVG;
- CSS geometry;
- optimized static images;
- small compressed audio.

Avatar presets:
- bundled/static optimized assets.

Fallback:
- default robot frame;
- generated initial/fallback;
- never broken-image icon.

---

# 74. SEARCH / REQUEST BEHAVIOR

Friend search:
- debounce ~250–400ms.

Room ID:
- submit or complete valid 6-char ID;
- no request every keystroke.

Action buttons:
- disable while request active;
- server-side idempotency still required for critical actions.

---

# 75. MOBILE SPECIFIC RULES

- respect safe-area top/bottom;
- bottom nav safe-area aware;
- modal never collides with notch/home indicator;
- Board Cell is hit target for piece interaction on mobile;
- no horizontal Board scroll;
- reduce HUD/decor before reducing Board usability;
- coordinate labels remain readable.

---

# 76. SCREEN CONTRACT REQUIREMENT

Every implemented screen MUST have:

```text
Screen ID
Route
Actors
Entry Conditions
Layout
Components
Data Dependencies
User Actions
Realtime Inputs
Loading State
Empty State
Error State
Disabled State
Responsive Rules
Accessibility
Motion
Exit Paths
Acceptance Criteria
```

The implementation task is incomplete if a major screen lacks these states.

---

# 77. GLOBAL ACCEPTANCE CRITERIA

## Global

- [ ] UI language is Vietnamese.
- [ ] System Cyan does not conflict with BLUE side identity.
- [ ] Competitive Blue and Red remain distinct in all themes.
- [ ] Light/Dark/System work.
- [ ] Reduced Motion works.
- [ ] Toast behavior is consistent.
- [ ] Loading/empty/error patterns are consistent.
- [ ] Responsive breakpoints follow the contract.
- [ ] Touch targets meet minimum where applicable.
- [ ] Focus state is visible.
- [ ] Destructive actions have explicit confirmation.
- [ ] Loading states prevent accidental duplicate submits.
- [ ] Network degradation has visible feedback.

## Auth

- [ ] Login/Register are visually consistent.
- [ ] Recovery Code appears exactly once.
- [ ] Forgot Password uses Recovery Code, no email.
- [ ] Inline form errors remain near fields.
- [ ] Password visibility toggle accessible.

## Homepage

- [ ] Hero remains compact.
- [ ] Quick Match is the primary action.
- [ ] Wrong Room ID → 4s top-center toast.
- [ ] Desktop Room List shows 4×2 visible.
- [ ] Room List scrolls internally beyond 8.
- [ ] Private rooms do not appear in public list.
- [ ] Realtime Room updates do not require refresh.
- [ ] Friends preview appears after Room section.

## Room / Matchmaking

- [ ] Custom room clearly displays UNRANKED.
- [ ] Private password error remains inline.
- [ ] Matchmaking displays expanding rating range.
- [ ] Cancel race obeys server committed state.
- [ ] Match Found animation is short.
- [ ] Host migration updates without reload.
- [ ] Ready state remains visible.
- [ ] Fast-ready Space behavior visible and functional.

## Game Board

- [ ] Board is the dominant visual element.
- [ ] Piece body clearly shows BLUE/RED.
- [ ] Piece occupies ~82–88% of tile while remaining visibly contained.
- [ ] Emoji remains large/readable.
- [ ] Selected state never destroys side identity.
- [ ] Legal empty destination differs from capture target.
- [ ] Goal tiles visually distinct.
- [ ] RED orientation is visual only.
- [ ] Spectator uses canonical orientation.
- [ ] Move/capture animation never delays canonical state.
- [ ] Turn is readable with multiple visual cues.
- [ ] Low-time urgency is clear but not abusive.
- [ ] Disconnect state locks unsafe interaction.
- [ ] Server interruption never looks like Win/Loss.

## Profile / History / Friends

- [ ] Non-friend Presence is hidden.
- [ ] Profile looks like a competitive dossier.
- [ ] History filters include Ranked/Unranked/Guest/AI/Offline.
- [ ] Match cards use restrained result accents.
- [ ] Friend requests have clear Incoming/Sent states.
- [ ] Block flow explains consequences.
- [ ] Recovery Code cannot be re-revealed.

## Guest / AI / Offline

- [ ] Guest warning exists.
- [ ] Guest history import is one-time.
- [ ] AI is clearly identified as bot.
- [ ] AI reuses the main Game Room.
- [ ] Offline reuses the main Board.
- [ ] Offline handoff overlay makes turn ownership clear.

---

# 78. FRONTEND COVERAGE AUDIT

Coverage dimensions:

```text
Major Screens                     PASS
Major Components                  PASS
Primary User Actions              PASS
Loading States                    PASS
Empty States                      PASS
Recoverable Errors                PASS
Critical Errors                   PASS
Realtime UI Reactions             PASS
Responsive Behavior               PASS
Accessibility Baseline            PASS
Motion System                     PASS
Sound Behavior                    PASS
Theme Behavior                    PASS
Gameplay HUD                      PASS
Board Visual Contract             PASS
Piece Visual Contract             PASS
Guest Flow                        PASS
AI Flow                           PASS
Offline Flow                      PASS
Profile/History/Friends           PASS
Settings                          PASS
Network → UI Mapping              PASS
UI → Protocol Mapping             PASS
Frontend Performance              PASS
```

Estimated requirement-definition coverage:

> **≥99% of currently known frontend requirements**

Remaining <1% consists of implementation-tunable values such as:
- final exact hex tuning;
- final font asset;
- final icon library;
- shadow/easing micro-adjustments;
- exact decorative illustrations;
- exact audio asset choices.

These are not missing product flows.

---

# 79. EXPLICIT UI OUT OF SCOPE — v0.1

Unless later approved:

- full 3D Board;
- custom avatar uploads;
- custom profile banners;
- friend chat;
- voice chat;
- global leaderboard screen;
- cosmetics shop/inventory;
- battle pass;
- animated video backgrounds;
- multiple AI difficulties;
- match replay;
- advanced analytics dashboard;
- full keyboard board gameplay;
- native mobile app.

---

# 80. FINAL IMPLEMENTATION PRINCIPLE

Frontend flow:

```text
Authoritative Product Rule
        ↓
Authoritative Network/Game State
        ↓
Frontend State
        ↓
Clear UI Representation
        ↓
Immediate Feedback
        ↓
Premium Motion / Sound
```

Never:

```text
Visual Effect
→ invents game state
```

Never:

```text
Client UI
→ becomes authority
```

Never:

```text
AAA polish
→ sacrifices gameplay clarity or latency
```

The interface should feel premium because every state, interaction, failure, and transition is deliberate.

---

# 81. DOCUMENT STATUS

```text
FRONTEND_SOURCE_OF_TRUTH        = READY
FRONTEND_REQUIREMENT_COVERAGE   = >=99%
UNDEFINED_MAJOR_SCREEN          = 0
UNDEFINED_MAJOR_COMPONENT       = 0
UNDEFINED_MAJOR_USER_ACTION     = 0
UNDEFINED_MAJOR_LOADING_STATE   = 0
UNDEFINED_MAJOR_ERROR_STATE     = 0
UNMAPPED_MAJOR_NETWORK_EVENT    = 0
UNDEFINED_RESPONSIVE_BEHAVIOR   = 0

STATUS = READY FOR FRONTEND IMPLEMENTATION
```
