# Wave B11 — Guest / AI / Offline

## Delivered

- Guest setup keeps the local-only warning, validates the display name, and stores the guest identity without creating a server account.
- Guest history remains IndexedDB-first with localStorage fallback; the existing one-time import modal supports explicit `Đồng bộ` / `Để sau`, retryable failures, deduplication, and deferred import.
- AI uses the shared `GameBoard` and rules engine with a deterministic Normal bot, local timer, fixed Blue orientation, and no realtime/reconnect path.
- Offline two-player uses the shared board, local timers, fixed canonical orientation, a visible handoff overlay, and no fake network status.
- In-progress Guest/AI/Offline sessions are now persisted locally and restored after reload. Leaving or finishing clears the active session; storage failures expose a recoverable error state.
- Local results stay local and do not render ranked Elo cards.

## Acceptance evidence

- `corepack pnpm --filter @ottv2/web typecheck` ✅
- `corepack pnpm --dir apps/web exec vitest run src/services/local/localGameStorage.test.ts` ✅
- `corepack pnpm --filter @ottv2/web test` ✅ (50 tests)
- `corepack pnpm test` ✅ (53 tests)
- Web typecheck/lint/build ✅

## Files

- `apps/web/src/pages/GuestSetupPage.tsx`
- `apps/web/src/pages/LocalGamePage.tsx`
- `apps/web/src/services/local/localGameStorage.ts`
- `apps/web/src/services/local/localGameStorage.test.ts`
- `apps/web/src/styles/globals.css`

