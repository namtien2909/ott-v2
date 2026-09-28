# Wave B5 — GameView / Online Room

## Delivered

- Online room keeps a fixed viewer perspective: the authenticated side stays at the near/bottom HUD and board view; turn changes never rotate the board.
- Realtime match events are monotonic and de-duplicated by `messageId`, `stateVersion`, and `sequence` before updating the board or presentation event bus.
- Board interaction now supports roving keyboard focus (one tabbable square), Arrow-key navigation, Enter/Space select/commit, Escape clear-selection, and an announced live status for turn/legal-destination changes.
- Move history is derived from authoritative snapshot diffs and rendered in a bounded right rail. Capture entries are surfaced separately in a combat feed; both collapse to compact rails on tablet/mobile.
- Existing reconnect, tab-lock, waiting-room, goal-cell, SVG glyph, semantic event-bus, and reduced-motion behavior remains intact.

## Acceptance evidence

- `corepack pnpm --filter @ottv2/web typecheck` ✅
- `corepack pnpm --dir apps/web exec vitest run src/components/board/GameBoard.test.tsx` ✅ (8 tests)
- `corepack pnpm --filter @ottv2/web test` ✅ (49 tests)
- `corepack pnpm test:unit` ✅ (43 tests)

## Files

- `apps/web/src/pages/GameRoomPage.tsx`
- `apps/web/src/components/board/GameBoard.tsx`
- `apps/web/src/components/board/GameBoard.test.tsx`
- `apps/web/src/styles/globals.css`

