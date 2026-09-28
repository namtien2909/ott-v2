# B3 Frontend Evidence — Homepage / Lobby / Room Browser

## Scope

- Branch: `codex/b3-frontend-local2`
- Worktree: `D:\ott-v2\.worktrees\b3-frontend`
- Wave: B3 only — Homepage/Lobby/Room Browser.
- No server, contract, game-rule, database, or unrelated route files changed.

## Implementation

- Homepage now has the desktop 3-column lobby contract: player profile, ranked CTA/mode center, and room/friends rail.
- Auth loading, guest, and authenticated states are explicit. Guest converts the profile and primary CTA into a registration invite and never calls friends APIs.
- Authenticated profile shows avatar frame, client-derived rank badge, Elo, ranked W/L, and a profile handoff.
- Center CTA and AI/Offline/Guest mode cards are keyboard-focusable links; `SYSTEM-PULSE` keeps health feedback compact and retryable.
- Hero spotlight/tilt is pointer-only, capped at 6 degrees; the primary CTA magnetic offset is capped at 8px. Touch input and `prefers-reduced-motion` reset/disable both effects.
- Room Browser keeps its existing canonical room API flows for realtime refresh, search, create, private password join, and spectator entry; B3 CSS adds compact cards and an internal scroll region.
- Room creation controls are explicitly non-submit buttons and the shared modal focus trap no longer deactivates immediately under React StrictMode, preserving the private-room form state.
- Friends Preview mounts only after auth resolves, supports loading/empty/error/retry, displays friend-only presence, and updates presence events without exposing room/private data.
- Responsive CSS orders mobile content as CTA → mode → server → rooms → friends → profile and keeps the bottom navigation safe-area behavior from the shared shell.
- Rank thresholds are centralized in `apps/web/src/foundation/rankConfig.ts` so the profile badge has one deterministic client-side source.

## Changed files

- `apps/web/src/pages/HomePage.tsx`
- `apps/web/src/components/social/FriendsPreview.tsx`
- `apps/web/src/pages/HomePage.test.tsx`
- `apps/web/src/components/social/FriendsPreview.test.tsx`
- `apps/web/src/styles/b3-lobby.css`
- `apps/web/src/foundation/rankConfig.ts`
- `apps/web/src/components/rooms/RoomBrowser.tsx`
- `apps/web/src/components/ui/Modal.tsx`
- `apps/web/src/main.tsx`
- `tests/e2e/frontend.smoke.spec.ts`
- `apps/web/package.json`
- `package.json`
- `pnpm-lock.yaml`
- `docs/B3_FRONTEND_EVIDENCE.md`

## State and acceptance coverage

| Area | Evidence |
|---|---|
| Auth loading/guest/authenticated | `ProfilePanel` + `HomePage.test.tsx` |
| Guest ranked CTA and local-history warning | `HomePage.test.tsx` |
| Rank/Elo/W/L profile output | `ProfilePanel` and authenticated Home test |
| AI/Offline/Guest mode cards | Home lobby render and CSS responsive rules |
| Server loading/online/degraded/offline/retry | `SystemPulse` using existing health contract |
| Friends loading/empty/error/retry | `FriendsPreview` state contract |
| Friends realtime presence | `FriendsPreview.test.tsx` |
| Room realtime/search/create/private join | Existing `RoomBrowser` + room API preserved; B3 compact rail styles |
| Mobile order and bottom-safe layout | B3 responsive CSS at 850px and 560px breakpoints |

## Verification evidence

- `corepack pnpm --filter @ottv2/web exec vitest run src/pages/HomePage.test.tsx src/components/social/FriendsPreview.test.tsx` → 2 files, 4 tests passed.
- `corepack pnpm --filter @ottv2/web test` → 8 files, 19 tests passed.
- `corepack pnpm --filter @ottv2/web exec vitest run --testTimeout=10000 --pool=threads --poolOptions.threads.singleThread` → 8 files, 19 tests passed. The default parallel run had one cold-start timeout in the unchanged GameBoard test; the diagnostic rerun passed.
- `corepack pnpm --filter @ottv2/web typecheck` → passed.
- `corepack pnpm --filter @ottv2/web lint` → passed.
- `corepack pnpm run build:packages` → passed.
- `corepack pnpm typecheck` → passed after local `corepack pnpm --filter @ottv2/server db:generate`.
- `corepack pnpm lint` → passed.
- `corepack pnpm build` → passed; Vite emitted existing third-party Zod annotation warnings and completed the production bundle.
- `corepack pnpm exec vitest run tests/unit tests/contract tests/integration --testTimeout=60000` → 11 files, 47 tests passed.
- `$env:E2E_BASE_URL='http://127.0.0.1:4174'; corepack pnpm exec playwright test tests/e2e/frontend.smoke.spec.ts --grep "B3 lobby" --workers=1` → 3 tests passed, covering authenticated desktop at 1366px and 1920px, mobile at 375px, room search/private form states, keyboard focus, tilt/magnetic bounds, screenshot capture, and Axe accessibility scan.
- Playwright visual evidence was captured and manually inspected at `test-results/frontend.smoke-B3-lobby-*/b3-lobby-desktop.png`, `b3-lobby-wide.png`, and `b3-lobby-mobile.png`.
- `@axe-core/playwright` is test-only infrastructure for the B3 accessibility gate; no production dependency was added.

The first default-timeout root test run was `46/47`: the health integration test exceeded the configured 15-second cold-start timeout. The same test passed standalone in 3.65 seconds with a 60-second diagnostic timeout, and the full rerun passed 47/47. No B3 code change was made for that baseline timing issue.

## Boundaries / rollback

- The browser smoke uses deterministic API fixtures so the visual and interaction evidence is repeatable; it does not claim a live backend/database session. No server, contract, game-rule, database, or unrelated route files were changed.
- Rollback is limited to the B3 files listed above; no backend or shared contract rollback is required.
