# B14 — Final release gate

## Scope

B14 closes the final release risks left after B13: deterministic route/state/theme/motion coverage, vector-only UI decoration, complete synthesized SFX inventory, lazy opt-in BGM with attribution, and production bundle/audio budgets.

## Delivered

- Replaced platform emoji/symbol decoration in shell, lobby, room browser, profile/avatar, spectator, 404 and friends surfaces with small theme-safe SVG glyphs. Piece tokens remain the canonical SVG line-art glyphs.
- Added all 16 synthesized 06B SFX cues (`ui_hover`, `ui_click`, `ui_confirm`, `ui_error`, `select`, `move`, `capture`, `goal_warning`, `low_time_tick`, `match_found`, `countdown_tick`, `countdown_go`, `victory`, `defeat`, `elo_tick`, `rank_up`) while preserving existing call-site aliases.
- Added one shared `PresentationAudio` lifecycle: AudioContext/SFX are lazy, BGM is OFF by default, BGM starts only after a user gesture, route changes crossfade lobby/match loops, and preference changes are silent and non-blocking.
- Added original procedural `lobby_loop.wav` and `match_loop.wav` assets (under 5 MB total) with repository attribution.
- Added `scripts/b14-release-gate.mjs` and the `release:gate` package script. CI runs it immediately after the production build.
- Added release-matrix unit coverage and a Playwright B14 route/theme/motion/audio matrix.

## Acceptance evidence

| Gate | Evidence | Result |
| --- | --- | --- |
| Canonical setup/orientation | `packages/game-rules/src/setup.ts`, existing GameBoard/online/local/spectator E2E | PASS |
| Route inventory and aliases | `tests/unit/b14-release-matrix.unit.test.ts`, B14 Playwright route matrix | PASS |
| Theme/motion/viewport | B13 responsive/axe gate plus B14 theme × motion matrix | PASS |
| Vector-only decoration | B14 release script scans `apps/web/src` for emoji/symbol ranges | PASS |
| Event bus/canvas/quality | B13 semantic event, DPR/particle tier and tab-hidden evidence | PASS |
| Audio | 16 cue inventory, shared context, autoplay-safe behavior, BGM attribution | PASS |
| Bundle/performance | Initial JS 129.7 KB gzip; all JS 184.9 KB gzip; VFX/audio source 8.3 KB gzip | PASS |
| BGM budget | 689.1 KB total, lazy tracks, each file below 5 MB | PASS |
| Production build | `corepack pnpm build` | PASS |
| Full frontend E2E | B13 + smoke + B14 Playwright suites | 30/30 PASS |
| Unit/component/integration/server | 47 unit + 54 web + 1 root integration + 48 server | PASS |

The script prints the measured values and exits non-zero on any regression:

```text
corepack pnpm release:gate
B14 RELEASE GATE: PASS
- route inventory: 26 entries audited
- initial JS: 129.7 KB gzip; total JS: 184.9 KB gzip
- VFX/audio source budget: 8.3 KB gzip
- BGM assets: 689.1 KB total; lazy tracks attributed
```

## Verification commands

```text
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test:unit
corepack pnpm --filter @ottv2/web test
corepack pnpm exec playwright test tests/e2e/b14-release-gate.spec.ts --workers=1
corepack pnpm exec playwright test --workers=1
corepack pnpm build
corepack pnpm release:gate
```

## Deferred release-device activity

The repository gate is deterministic Chromium. Physical Safari iOS and Chrome Android trace capture still belongs to the release-device checklist; no product-flow or bundle blocker remains, and the Settings `Vừa`/`Thấp` fallback is available if a device reports a lower frame budget.

## QA verdict

**Automated B14 gate: PASS / READY FOR RELEASE.** A human BA/QA owner should attach the physical-device trace and final sign-off to the release ticket before public deployment.
