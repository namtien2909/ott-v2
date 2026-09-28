# B0 — Frontend foundation contract, fixtures và state matrix

**Status:** Implementing / foundation gate  
**Scope:** không thay đổi visual runtime; khóa contract để các Wave B1–B14 triển khai không suy luận lại.  
**Source:** `docs/06_FRONTEND_UI_SPEC.md`, `docs/06B_GAME_FEEL_SPEC.md`, `docs/implementation_plan_frontend_v0.2.md`, kết quả BA review và 120 lựa chọn discovery đã chốt.

## 1. B0 decision lock

Các quyết định dưới đây là acceptance contract, không phải gợi ý:

| ID | Contract đã khóa | Evidence bắt buộc |
|---|---|---|
| D-01 | Neon Esports Arena; density ở overlay, clarity trong nội dung; góc sắc; không bounce/elastic | token snapshot + visual review B1 |
| D-02 | Blue/Red chỉ là side identity; Cyan là system; Violet/Magenta/Amber là semantic role | raw-color scan + token snapshot |
| D-03 | Space Grotesk display, Be Vietnam Pro body, monospace tabular cho clock/Elo/ping | font loading + 375px Vietnamese glyph test |
| D-04 | a1 và i9 là ô thi đấu bình thường, quân khởi đầu nằm đúng trên hai ô này | `b0-frontend-fixtures.unit.test.ts` |
| D-05 | Online cố định theo viewer side; Red viewer rotate một lần; AI/Offline không rotate theo turn; Spectator Blue canonical | orientation fixture test + E2E |
| D-06 | Semantic event bus + shared 2D canvas + DOM semantic layer | B1 event-bus contract test |
| D-07 | Event dedupe/coalesce theo eventId/stateVersion; pause khi tab hidden; cleanup unmount | B1 unit/performance test |
| D-08 | Một AudioContext; SFX synthesized; BGM lazy-load, OFF mặc định, crossfade 800ms, duck 6dB | B1 audio test |
| D-09 | Landscape ưu tiên; portrait full-width board + bottom sheet + hint xoay ngang | B5/B11 device matrix |
| D-10 | Keyboard roving focus; Arrow navigate; Enter/Space select/commit; Escape clear; live region | B5/B13 a11y test |
| D-11 | Rank derive từ một config; shield + chevrons; non-ranked không badge/Elo | B1/B6/B8 contract test |
| D-12 | Goal Tension helper thuộc game-rules; UI không heuristic | contract gap C-04 |
| D-13 | Server state machine WAITING_READY → COUNTDOWN → PLAYING | contract gap C-02 |
| D-14 | Result tách FINISHED/ABORTED/SERVER_INTERRUPTION/TIMEOUT/SURRENDER/DISCONNECT_TIMEOUT | contract gap C-03 |
| D-15 | 06B là visual token/motion/audio authority duy nhất | source-of-truth audit |

## 2. Route/state matrix skeleton

Matrix này là skeleton bắt buộc. Mỗi Wave phải điền acceptance evidence cụ thể; không được bỏ qua state vì route đang “đơn giản”. Alias của cùng một screen dùng cùng state contract.

| Screen contract | Route/alias | Actor/entry | Ready/empty | Loading/pending | Recoverable/fatal | Realtime/offline | Keyboard/focus | Owner |
|---|---|---|---|---|---|---|---|
| Home/Auth gate | `/`, `/home` | guest hoặc authenticated | lobby shell / room empty | session resolve | retry session / app error | reconnect banner | CTA first focus | B3 |
| Login | `/dang-nhap`, `/login` | guest | blank form | submit locked | field error / auth error | degraded auth notice | label→field→submit | B2 |
| Register | `/dang-ky`, `/register` | guest | blank form | submit locked | duplicate username / fatal auth | reconnect-safe retry | same auth order | B2 |
| Forgot password | `/quen-mat-khau`, `/forgot-password` | guest | username + recovery code | verify pending | invalid/expired code | retry without data loss | code input focus | B2 |
| Recovery result | auth continuation | newly registered user | code shown once | copy pending | clipboard fallback | no re-fetch reveal | copy/checkbox order | B2 |
| Lobby | `/`, `/home` authenticated | player | room list/friends | room list skeleton | retry/private room | live room update | search→create→rooms | B3 |
| Room browser | embedded + room aliases | player | no public rooms | create/join pending | password/room full | live list resync | row action focus | B3 |
| Queue | `/queue`, matchmaking continuation | player | radar ready | cancel/queue pending | retry/timeout | reconnect/leave guard | cancel focus | B4 |
| Match found | queue continuation | matched players | VS card ready | accept pending | decline/expired | server deadline | accept→decline | B4 |
| Waiting room | `/waiting/:roomId` | two players | both not ready | ready pending | room error | ready/reconnect/resync | ready first | B4 |
| Online GameView | `/phong/:roomId`, `/room/:roomId`, `/game/:roomId` | player | canonical snapshot | snapshot/resync | move rejection / fatal | clock/events/reconnect | roving board/live region | B5 |
| Result | match continuation | player/spectator | finished/aborted variant | rating pending | retry rematch/history | no gameplay updates | rematch/history order | B6 |
| History list | `/lich-su`, `/history` | authenticated | empty history | page skeleton | retry/partial | stale indicator | filter→card focus | B7 |
| Match detail | `/history/:matchId` | authenticated | snapshot detail | detail pending | not found/retry | immutable view | back then content | B7 |
| Profile | `/ho-so`, `/profile/:username` | owner/viewer | dossier/stat empty | stats pending | private/not found | presence/rank refresh | tabs/relationship | B8 |
| Friends | `/ban-be`, `/friends` | authenticated | empty tab | action pending | invite/block error | presence updates | tab list/action | B9 |
| Settings | `/cai-dat`, `/settings` | authenticated | loaded defaults | save pending | validation/retry | device-local settings | grouped controls | B10 |
| Guest setup | `/guest`, `/guest/play` | guest | local setup | local start pending | invalid import/retry | offline only | setup→start | B11 |
| AI match | `/ai` | guest/authenticated | AI setup | start pending | AI fallback/error | stable orientation | board contract | B11 |
| Offline | `/offline` | any | offline setup | local start | invalid local state | no network expectation | board contract | B11 |
| Spectator | `/spectate/:roomId` | guest/authenticated | canonical read-only | snapshot pending | private/not-found | resync/ended stream | no move controls | B12 |
| Not found | `*` | any | recovery CTA | none | route fallback | offline-safe | CTA first focus | B12 |
| App error | global error boundary | any | error shell | retry pending | fatal diagnostics | degraded shell | retry/report order | B12 |

### State dimensions that every row must cover

1. Actor/permission/entry and exit/back/unsaved guard.
2. Ready, empty, loading, disabled, pending, duplicate-submit prevention.
3. Recoverable error, fatal error, retry and rollback behavior.
4. Offline, degraded, reconnecting, stale snapshot, resync.
5. Realtime update ordering and idempotency by `eventId`/`stateVersion`.
6. Keyboard, focus-visible, screen reader live region, reduced motion.
7. Desktop/tablet/mobile portrait/mobile landscape and safe-area behavior.
8. Light/Dark/System token behavior and analytics/performance evidence where applicable.

## 3. Canonical fixture contract

Source: [`tests/fixtures/frontend-fixtures.ts`](../tests/fixtures/frontend-fixtures.ts).

- `createCanonicalRuleFixture()` always calls the authoritative `createInitialState()`.
- Board is exactly 9×9 (81 cells), 18 pieces, Blue and Red each R/P/S = 3.
- `a1` contains the Blue S piece and `i9` contains the Red S piece; `a2` and `i8` remain empty.
- `createViewerOrientation()` encodes one-time online viewer rotation. It has no turn parameter, so a turn update cannot rotate the board.
- AI/Offline and Spectator use canonical orientation; Red online viewer maps viewport coordinates through one 180° transform.
- `createCanonicalMatchSnapshot()` is parsed by `MatchSnapshotSchema`, preventing UI fixtures from drifting from the transport contract.
- `createFinishedRankedSnapshot()` covers rating-bearing terminal state. `createAbortedSnapshot()` covers server interruption without rating.

## 4. Contract-gap register

Gaps are tracked explicitly so a UI agent never silently invents backend behavior. A gap can be closed by implementation, contract change, or a written decision that the current contract is intentionally sufficient.

| ID | Gap / risk | Owner | Required change | Exit criteria | Target Wave |
|---|---|---|---|---|---|
| C-01 | Match snapshot lacks explicit `viewerSide`/orientation context | Frontend + API | derive from authenticated player context; add transport field only if reconnect requires it | reconnect preserves same orientation with no turn-driven rotate | B5 |
| C-02 | WAITING_READY/COUNTDOWN statuses exist in schema but server/UI transition evidence is incomplete | Backend | emit ordered ready/countdown/start events with sequence/stateVersion | contract test proves `WAITING_READY → COUNTDOWN → PLAYING` and stale event rejection | B4 |
| C-03 | `DISCONNECT_TIMEOUT` is a product result reason but not in `MatchResultReasonSchema` | Backend/contracts | add enum and event payload mapping, or document canonical fallback | result page renders distinct disconnect timeout and preserves rating policy | B6 |
| C-04 | Goal Tension is not exposed as a game-rules helper/event payload | Backend/game-rules | expose authoritative helper/event; UI consumes boolean/level only | UI has no threat heuristic; unit test covers boundary transitions | B5 |
| C-05 | Event envelope currently uses snapshot payload for every event | Backend/contracts | define typed payload union or document snapshot-on-event guarantee | event bus can safely render MOVE/TOAST/CLOCK without unsafe casts | B1/B5 |
| C-06 | Rank thresholds/config ownership is not yet explicit | Backend + shared config | publish versioned rank config or embed client-safe config | same input yields same rank badge in Profile/Result/Lobby | B1/B6/B8 |
| C-07 | Room/history/profile/friends API empty/error payload shapes need UI fixtures | Backend/contracts | add stable empty, pagination, not-found and privacy variants | route matrix tests parse all states without production mocks | B3/B7/B8/B9 |
| C-08 | Offline/AI/local result persistence contract is not documented | Frontend + Backend | define local schema/version and handoff behavior | refresh/back/reload preserves or safely clears local match by decision | B11 |
| C-09 | Spectator permission and ended-stream semantics need explicit event contract | Backend | read-only snapshot + terminal reason + reconnect policy | spectator cannot submit move and ended stream is deterministic | B12 |
| C-10 | Audio asset licensing/availability and autoplay fallback are not recorded | Frontend | add asset manifest + attribution + silent fallback | B1 audio test passes with assets unavailable and no gameplay impact | B1 |
| C-11 | History pagination/filter/sort fields are not unified across aliases | Backend/contracts | one query contract for `/lich-su` and `/history` | identical URL-independent list semantics and deep-link detail | B7 |
| C-12 | Social presence/invite/block conflict semantics need idempotency key | Backend | define command idempotency and stateVersion behavior | duplicate action yields one visible outcome and recoverable error | B9 |

## 5. B0 acceptance gate

- [x] Decision log is frozen in implementation plan and repeated here for implementation visibility.
- [x] All current route aliases have an owner and required state dimensions.
- [x] Canonical setup/orientation/result fixtures exist in one importable module.
- [x] Unit tests assert a1/i9 placement and no turn-based board rotation.
- [x] Contract gaps have owner, target Wave and measurable exit criteria.
- [x] B0 test command passes in the current environment (evidence recorded below).
- [ ] Backend contract gaps C-01–C-12 are closed or explicitly accepted before the dependent Wave exits.

## 6. Evidence log

Run from repository root:

```text
corepack pnpm test:unit -- tests/unit/b0-frontend-fixtures.unit.test.ts
```

Result (2026-09-28): `7` unit files passed, `40` tests passed in `3.14s`. A green B0 gate means the foundation is ready; it does **not** claim that B1–B14 visual/runtime work is complete.
