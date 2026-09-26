# W11 UI-spec acceptance matrix

Nguồn contract: `docs/06_FRONTEND_UI_SPEC.md`. Evidence là route/component/test hiện có trong repository.

| Area | Acceptance | Evidence | Status |
| :--- | :--- | :--- | :--- |
| Shell/routes | Canonical + Vietnamese aliases load through one AppLayout | `apps/web/src/app/routes.ts`, `router.tsx` | PASS |
| Loading/empty/error | Lazy-route fallback, room/history/queue error + retry, modal error copy | `App.tsx`, `RoomBrowser`, `HistoryPage`, `QueuePage` | PASS |
| Network states | CONNECTED, RECONNECTING, OFFLINE, DEGRADED are distinct and announced | `AppLayout`, `httpClient`, HTTP degradation test | PASS |
| Board semantics | 81 cells, coordinate labels, goal markers, side orientation, semantic labels | `GameBoard.test.tsx`, `GameBoard.tsx` | PASS |
| Online safety | Unsafe actions disabled for reconnect, lock, spectator and non-turn state | `GameRoomPage`, `SpectatorPage` | PASS |
| Spectator | BLUE-bottom canonical board, both HUD/clocks, no legal highlight or commands | `SpectatorPage`, W10 spectator tests | PASS |
| Forms/auth | Inline validation, pending labels, password visibility and session-expired modal | Auth pages, `PasswordField`, `AppLayout` | PASS |
| Responsive | Grid collapse and mobile header/board/history/social/local/spectator variants | `globals.css` responsive rules | PASS |
| Accessibility | Focus ring, modal focus trap, semantic labels, live status and icon labels | `globals.css`, `Modal`, `GameBoard`, screen components | PASS |
| Motion/sound | Reduced-motion CSS guard and in-game sound/reduced-motion settings hooks | `globals.css`, `GameRoomPage`, `SettingsPage` | PASS |
| Telemetry | HTTP method/path/status/duration event available to diagnostics listeners | `uiTelemetry.ts`, `httpClient.test.ts` | PASS |
| Performance | Lazy pages, bounded telemetry, 1000 snapshot/delta iterations under local budget | `router.tsx`, `MetricsRegistry`, `w11-performance.unit.test.ts` | PASS |

## Known intentional v0.1 boundaries

- Full keyboard board navigation is not required by the UI spec v0.1; surrounding controls remain keyboard accessible.
- Spectator fan-out/load evidence is in-process/local. Public deployment and external network benchmark belong to W12.
- CSS build emits non-failing upstream Rollup annotation warnings from Zod; no application lint/type errors remain.
