# B4 — Queue / Match Found / Waiting Room Evidence

## Scope

Implemented only Wave B4 from `docs/implementation_plan_frontend_v0.2.md` on branch `codex/b4-frontend` in worktree `D:\ott-v2-b4`.

## Implementation evidence

- Queue: concentric cyan radar, inline SVG fist glyph, tabular Elo/range/elapsed stats, pending cancel state, retry/error state.
- Match Found: Blue/Red diagonal split, avatar/name/rank/Elo cards, impact ring, 650ms transition into canonical `/room/:roomId` waiting room.
- Waiting Room: server-derived `WAITING_READY` state, two hologram slots, ready glow, host mark, room-code copy with manual clipboard fallback, leave action, `Space` fast-ready hint, and server-timestamp countdown.
- Event safety: queue sequence dedupe and committed Match Found precedence; match SSE dedupe by `messageId`, `stateVersion`, and `sequence`.
- Contract support: optional `hostUserId` is carried by match snapshots from the server so the host mark does not rely on display heuristics.

## State / acceptance coverage

- `WAITING_READY → COUNTDOWN → PLAYING` remains server-authoritative; the UI only renders snapshot/event state.
- Cancel race: a `409 MATCH_ALREADY_COMMITTED` re-fetches the queue and routes to Match Found if the server has committed pairing; it never reports successful cancellation.
- Duplicate/stale queue events are ignored; late queue updates cannot revert a committed Match Found state.
- Countdown is derived from `countdownEndsAt`; the server owns the three-second window.
- Loading, error/retry, reconnect/degraded overlay, pending/disabled actions, keyboard Space hint, reduced-motion CSS fallback, and mobile stacked slots are covered.

## Verification

| Command | Result |
|---|---|
| `corepack pnpm run build:packages` | PASS |
| `corepack pnpm --filter @ottv2/server db:generate` | PASS |
| `corepack pnpm typecheck` | PASS |
| `corepack pnpm vitest run tests/unit/b4-queue-state.unit.test.ts` | PASS — 1 file, 3 tests |
| `corepack pnpm --filter @ottv2/server exec vitest run --config vitest.config.ts test/unit/match.manager.unit.test.ts` | PASS — 1 file, 9 tests |
| `corepack pnpm lint` | PASS |
| `corepack pnpm build` | PASS — web/server/packages built |
| `corepack pnpm test` | PASS — 12 files, 50 tests |
| `git diff --check` | PASS |

## Changed files

- `apps/web/src/pages/QueuePage.tsx`
- `apps/web/src/pages/GameRoomPage.tsx`
- `apps/web/src/pages/queueState.ts`
- `apps/web/src/styles/globals.css`
- `packages/contracts/src/match.ts`
- `apps/server/src/modules/match/match.manager.ts`
- `tests/unit/b4-queue-state.unit.test.ts`

## Known limitation / rollback

- The first cold run timed out while bootstrapping the fresh worktree; after package/Prisma bootstrap and a warm rerun, the health integration test passes in 3s and the full suite is green.
- Rollback is limited to reverting the files above; no files outside the B4 dependency path were changed.

## Verdict

Implementation and verification for B4 are complete; the full automated suite is green.
