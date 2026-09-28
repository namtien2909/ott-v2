# Wave B9 — Friends/Invites evidence

## Scope

Implementation is limited to the Friends/Invites surface described in `implementation_plan_frontend_v0.2.md` §13. Existing changes outside B9 were preserved; no global reset or cleanup was performed.

Branch used: `codex/B12`.

## Files touched for B9

- `apps/web/src/pages/FriendsPage.tsx`
  - Header and accessible tabs for friends, incoming, sent, and player search.
  - Friend cards with policy-safe presence fallback, Elo, stats, invite, remove, block, and profile actions.
  - Incoming/sent request copy and action state are distinct.
  - Secondary menu supports Escape, click-outside close, focus restore, arrow/Home/End navigation, and menu semantics.
  - Invite composer exposes pending, error, expired, and success states with a one-time token.
  - Accept/reject expiry removes the stale invite card; pending actions prevent duplicate submits.
  - Presence updates remain event-driven; stale search responses are ignored.
- `apps/web/src/pages/FriendsPage.test.tsx`
  - Component coverage for B9 acceptance paths.
- `apps/web/src/components/ui/Modal.tsx`
  - Modal fallback focus keeps the focus trap valid while invite controls are temporarily disabled.
- `apps/web/src/styles/globals.css`
  - One-time invite token presentation.

## State/acceptance evidence

| B9 requirement | Evidence |
|---|---|
| Incoming/Sent actions are not confused | Test asserts incoming copy `Muốn kết nối với bạn` and sent copy `Đang chờ phản hồi`. |
| Invite pending/one-time token | Test asserts pending button lock and rendered token after success. |
| Invite expiry does not leave stale UI | Test rejects `INVITE_INVALID` and asserts the invite row is removed. |
| Accessible secondary menu | Test asserts first-item focus, ArrowDown navigation, Escape focus restore, and click-outside close. |
| Loading/ready/empty/error/retry | `FriendsPage` retains `LoadingState`, `EmptySocial`, recoverable error copy, and `Thử lại`. |
| Realtime presence | `subscribeToPresence` updates the matching friend card without replacing the list. |
| Presence privacy | UI treats omitted presence as `OFFLINE`; server/contract policy remains the source of truth. |

## Verification

Final standalone verification after implementation:

- `corepack pnpm --filter @ottv2/web exec vitest run src/pages/FriendsPage.test.tsx` — 1 file, 4 tests passed.
- `corepack pnpm --filter @ottv2/web test` — 14 files, 42 tests passed.
- `corepack pnpm --filter @ottv2/web lint` — passed.
- `corepack pnpm --filter @ottv2/web build` — passed; Vite emitted only existing third-party Zod annotation warnings.
- `corepack pnpm typecheck` — passed.
- `corepack pnpm test` — 12 files, 50 tests passed.
- `corepack pnpm lint` — passed.
- `corepack pnpm build` — passed.
- `git diff --check` — no whitespace errors; CRLF normalization warnings are from existing Windows worktree files.

## Deferred / not claimed by B9

Cross-browser visual snapshots, axe scans, and the full responsive/performance matrix remain Wave B13 evidence. Backend social endpoints/contracts were consumed as existing dependencies and were not changed in this B9 pass.

## Rollback

Revert only the B9 file changes above (or restore the B9 patch from Git) after accounting for pre-existing dirty worktree changes. Do not use a global reset because the worktree contains unrelated wave changes.

## Verdict

B9 functional and automated acceptance paths are implemented and green. Visual/accessibility matrix sign-off beyond the targeted keyboard coverage remains deferred to B13.
