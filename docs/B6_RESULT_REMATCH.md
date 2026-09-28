# B6 — Result / Rematch

## Delivered

- Result state is explicit for `FINISHED` and `ABORTED`; `SERVER_INTERRUPTION` and `DISCONNECT_TIMEOUT` stay neutral and never render a false Victory/Defeat.
- Ranked results render server-authoritative Elo before/after/delta, a 1200ms count-up, shared rank badge config, and rank-up/down styling. Unranked, AI, Offline and Guest results never render an Elo card.
- Result stats expose moves, captures, pieces lost and elapsed match time. Online stats derive from the accepted move log; local stats persist with the B11 local session snapshot.
- Victory uses the amber/magenta VICTORY treatment and bounded fireworks; defeat uses the red-violet DEFEAT treatment, embers and board desaturation; reduced motion disables the cosmetic animation while retaining hierarchy.
- Reason copy is distinct for extinction, goal reached, timeout, surrender, disconnect timeout and server interruption.
- Rematch is server-authoritative: request/accept/reject endpoints, pending/disabled states, opponent prompt, board reset, side swap, and immediate rematch mode downgrade to Unranked.
- Disconnect grace expiry now reports `DISCONNECT_TIMEOUT`; server interruption remains a separate neutral result.

## Verification

- Web: 19 test files / 53 tests pass, including `ResultPanel.test.tsx`.
- Server: 13 test files / 48 tests pass, including rematch side swap, reject and disconnect-timeout coverage.
- Workspace typecheck, lint and production build pass.
