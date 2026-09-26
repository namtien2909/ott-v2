# W12 Demo Rehearsal

## Preconditions

1. PostgreSQL is running and `.env` points to the disposable local database.
2. `corepack pnpm db:status` reports no pending migration.
3. Backend is running on `http://127.0.0.1:3001`.
4. Frontend production preview is running on `http://127.0.0.1:4173`.

## Rehearsal order

| Step | Screen/state | Action | Evidence |
| :--- | :--- | :--- | :--- |
| 1 | Home / network CONNECTED | Open `/` and wait for health card | API status is visible |
| 2 | Auth | Open `/login`, `/register`, `/forgot-password` directly | Refresh returns SPA HTML |
| 3 | Room | Open `/home`, `/queue`, `/room/ABC234` | Route shell loads without 404 |
| 4 | Online match | Open `/game/:roomId` | HUD/board authority states are available from W4–W5 |
| 5 | History/social | Open `/history`, `/history/:matchId`, `/profile/demo`, `/friends`, `/settings` | Empty/loading/error states remain reachable |
| 6 | Guest/AI/offline | Open `/guest`, `/guest/play`, `/ai`, `/offline` | Local-mode warning/handoff is visible |
| 7 | Spectator | Open `/spectate/ABC234` | Read-only canonical orientation is preserved |
| 8 | Gate | Run `corepack pnpm smoke:production` | All route/API/CORS assertions pass |

## Public run

After Render deployment, export the three URLs and rerun the exact gate:

```powershell
$env:W12_WEB_URL="https://<static-service>.onrender.com"
$env:W12_API_URL="https://<api-service>.onrender.com"
$env:W12_WEB_ORIGIN=$env:W12_WEB_URL
corepack pnpm smoke:production
```

Do not put these values or database/PlayHTML secrets in tracked files.
