# B13 — Cross-cutting QA

## Delivered

- Board accessibility is now a semantic ARIA grid: nine `row` groups, 81 `gridcell` controls, one roving `tabindex`, Arrow navigation, Enter/Space selection/commit and Escape clear. Selection is exposed with `aria-selected`; the grid no longer uses prohibited `aria-pressed` on gridcells.
- Toast announcements use a labelled live region instead of an unlabeled `aria-label` on a generic `div`.
- Light-theme system cyan and muted text tokens were darkened to clear WCAG AA contrast on shell surfaces. Blue/red player labels and turn badges use contrast-safe ink/background tokens while preserving side motif and shape redundancy.
- Quality tiers now expose deterministic particle and DPR budgets. Automatic downgrade evaluates a rolling three-second p95 frame window and steps down only when p95 frame time exceeds 24ms; hidden tabs remain paused by `AmbientArena`.
- Added a Playwright B13 gate with axe scans, keyboard trace, reduced-motion assertion and responsive overflow matrix.

## Evidence matrix

| Gate | Coverage | Result |
| --- | --- | --- |
| Axe WCAG 2A/2AA | Home, login, not-found, history, friends, settings, guest setup, online game | 0 critical/serious violations |
| Keyboard | Roving board focus, Enter selection, Escape clear, one tab stop | Pass |
| Reduced motion | `prefers-reduced-motion`, low visual tier, shell overflow | Pass |
| Responsive | 375×812, 768×1024, 1366×768, 1920×1080 | No horizontal overflow |
| Regression E2E | Existing smoke suite plus B13 gate | 28/28 passed |

## Verification commands

```text
corepack pnpm --filter @ottv2/web test
corepack pnpm exec playwright test tests/e2e/b13-cross-cutting.spec.ts --workers=1
corepack pnpm exec playwright test --workers=1
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
```

## State and dependency status

- No backend or contract dependency was introduced by B13.
- Existing B3–B12 page/state tests remain green after the ARIA and token corrections.
- Audio remains optional and autoplay-safe; reduced motion disables animation while retaining hierarchy. Ambient canvas uses the tier DPR/particle budgets and pauses on hidden tabs.

## Known tunable item / fallback

Physical Safari iOS and Chrome Android trace capture remains a release-device activity; the deterministic Chromium matrix is the CI gate. If a device misses the frame budget, select `Vừa`/`Thấp` in Settings; if a future regression appears, revert the B13 commit without changing match authority or contracts.

## QA verdict

**PASS** — B13 cross-cutting accessibility, responsive, reduced-motion, contrast and deterministic performance guardrails are implemented and verified.
