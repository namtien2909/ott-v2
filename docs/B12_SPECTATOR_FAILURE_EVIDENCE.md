# B12 — Spectator / Not Found / App Error evidence

## Scope

- Spectator entry: loading, private/password, recoverable error, ready, reconnecting and canonical resync.
- Spectator presentation: BLUE luôn ở phía dưới, RED HUD ở phía trên; board disabled và không tạo selection feedback.
- Spectator activity: nhật ký nước đi và combat feed chỉ đọc, lấy từ canonical match events.
- Not Found: branded logo, giải thích tiếng Việt và action `Về sảnh`.
- App Error Boundary: mã lỗi ổn định, retry, reload và không render stack trace.

## Implementation evidence

- `apps/web/src/pages/SpectatorPage.tsx`: chống snapshot lùi theo `matchId/roomId/stateVersion/sequence`, resync khi SSE lỗi, dedupe connect khi React StrictMode chạy effect hai lần, delayed leave lifecycle, read-only activity feeds.
- `apps/web/src/services/http/httpClient.ts`: không mở session-expired modal cho `401` của spectator/password flow.
- `apps/web/src/pages/NotFoundPage.tsx` và `apps/web/src/styles/globals.css`: branded 404 shell và responsive feed/error styles.
- `apps/web/src/app/AppErrorBoundary.tsx`: `ERR_APP_RENDER_001`, `Thử lại`, `Tải lại trang`, safe copy.

## Validation

| Command | Result |
|---|---|
| `corepack pnpm test` | PASS — 12 files, 50 tests |
| `corepack pnpm --filter @ottv2/web exec vitest run --config vite.config.ts src/app/AppErrorBoundary.test.tsx src/pages/NotFoundPage.test.tsx src/components/board/GameBoard.test.tsx` | PASS — 3 files, 9 tests |
| `corepack pnpm exec playwright test tests/e2e/frontend.smoke.spec.ts --grep "spectator\|not found" --workers=1` | PASS — 4 tests |
| `corepack pnpm typecheck` | PASS — contracts, game-rules, test-utils, server, web |
| `corepack pnpm lint` | PASS — contracts, game-rules, web |
| `corepack pnpm build` | PASS — contracts, game-rules, server, web |

Build emitted non-blocking Rollup warnings about annotation comments inside the installed Zod package; the production build completed successfully.
