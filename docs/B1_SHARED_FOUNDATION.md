# B1 — Shared Frontend Foundation

**Status:** Complete for the B1 scope  
**Date:** 2026-09-28  
**Depends on:** [B0_FRONTEND_FOUNDATION.md](B0_FRONTEND_FOUNDATION.md)

## Delivered

- `apps/web/src/foundation/tokens.ts` is the semantic token source for 06B dark/light surfaces, roles, gradients, typography, motion, radius, glow and z-index.
- `globals.css` consumes the same semantic variables and adds the Neon Esports Arena base, grid, aurora, scanline and low-tier fallbacks.
- `ThemeProvider` applies the token set after resolving Light/Dark/System; `main.tsx` applies a dark first-paint fallback and quality tier before render.
- `AmbientArena.tsx` is a pointer-transparent shared canvas layer. It uses High/Medium/Low particle budgets, DPR limits, `prefers-reduced-motion`, and stops its animation loop when the tab is hidden.
- `qualityTier.ts` detects `deviceMemory`, `hardwareConcurrency`, `saveData`, reduced motion and viewport; supports a persisted manual override and p95 frame fallback (`>24ms` downgrades one tier).
- `eventBus.ts` defines the semantic event envelope (`eventId`, `stateVersion`, `emittedAt`, `source`, `type`, `payload`), deduplicates event IDs and drops stale state versions.
- `GameRoomPage` forwards realtime match events to the semantic bus without changing server-authoritative state.
- `preferences.ts` now reuses one lazy `AudioContext`, keeps SFX optional, supports lazy BGM with 800ms crossfade and 6dB ducking, and never lets autoplay/audio failure block gameplay.
- `PieceGlyph.tsx` replaces emoji with 28px-capable SVG line-art for Đấm/Bao/Kéo; the board retains Vietnamese accessible labels and side-first color/motif treatment.

## B1 acceptance evidence

```text
corepack pnpm --filter @ottv2/web typecheck
corepack pnpm --filter @ottv2/web test -- --run
corepack pnpm --filter @ottv2/web build
corepack pnpm --filter @ottv2/web lint
```

- Typecheck: passed.
- Frontend tests: 7 files / 19 tests passed.
- Production build: passed. The build may emit third-party Zod annotation warnings; they are from the dependency bundle and do not fail the build.
- ESLint: passed with `--max-warnings 0`.
- Root full suite from B0 remains green: 12 files / 50 tests passed.

## Boundaries carried into later Waves

- Page-specific visual hierarchy and state matrices remain owned by B2–B12.
- Remaining legacy component declarations that use literal white/black contrast colors are safe contrast overlays, not side/system role colors; page-wave token cleanup must not introduce new literals.
- BGM asset files and attribution are intentionally deferred until the asset manifest is selected; the API already fails silently when no source is available.
