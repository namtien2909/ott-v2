# B7 — History / Match Detail Evidence

## Scope

Implemented only the B7 History/Match Detail wave from `implementation_plan_frontend_v0.2.md`.

- History cards expose result strip, mode, versus, duration, reason and Elo delta.
- Mode/result/range filters persist in the route query and survive reload/back navigation.
- Loading uses fixed-shape skeletons to avoid list layout shift.
- Match detail remains in the history context and renders a read-only canonical final-position thumbnail.
- The thumbnail uses the server snapshot board, SVG `PieceGlyph` assets, Blue-bottom canonical orientation, and no interactive controls.
- Guest import keeps confirmation, one-time import, error and deferred states.
- `Match.finalBoard` is nullable for existing rows; new completed/aborted snapshots persist the canonical final board.

## Changed files

- `apps/web/src/pages/HistoryPage.tsx`
- `apps/web/src/pages/HistoryPage.test.tsx`
- `apps/web/src/components/history/FinalPositionThumbnail.tsx`
- `apps/web/src/components/history/FinalPositionThumbnail.test.tsx`
- `apps/web/src/styles/globals.css`
- `packages/contracts/src/history.ts`
- `apps/server/src/modules/history/history.service.ts`
- `apps/server/test/unit/history.service.unit.test.ts`
- `tests/contract/match.contract.test.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260928170000_b7_history_final_board/migration.sql`

## State / acceptance coverage

| Acceptance | Evidence |
|---|---|
| Filter/query state persists in the correct scope | `HistoryPage.test.tsx` starts from `mode=RANKED&result=WIN&range=7D`, changes mode, and verifies the canonical API query. |
| Loading skeleton does not change card geometry | `HistoryLoadingSkeleton` renders fixed summary/card slots; CSS keeps the same grid dimensions on desktop/mobile. |
| Detail keeps list context | Detail is a route-backed modal; filter query is preserved when opening and closing it. |
| Final-position thumbnail is canonical and read-only | `FinalPositionThumbnail.test.tsx` verifies 81 squares, goal coordinates, SVG glyphs and zero buttons. |
| Older rows / missing dependency are recoverable | Nullable `finalBoard` renders a clear unavailable state instead of inventing a board. |
| Mobile cards do not overflow horizontally | B7 responsive CSS collapses card columns and makes the thumbnail full-width below 700px. |
| Guest import confirmation/error/deferred flow | Existing `HistoryPage` import flow retained; no production mock or duplicate persistence path added. |

## Automated evidence

- Frontend tests: **13 files / 38 tests passed** with Vitest single-worker execution.
- Server unit/integration suite: **13 files / 47 tests passed**.
- Contract suite: **4 files / 9 tests passed**.
- Root unit/contract/integration suite: **12 files / 50 tests passed**.
- Workspace lint: **passed**.
- Workspace typecheck: **passed**.
- Workspace production build: **passed**.
- Prisma client generation: **passed**.
- Frontend browser E2E: **18 tests passed**, including the B7 history/detail scenario.

## Browser / responsive evidence

The B7 browser scenario was verified at 375×812: filter query persistence, detail route context, 81-cell canonical thumbnail, zero thumbnail controls, and no horizontal overflow. The full frontend E2E suite passed 18/18. Older rows intentionally show the fallback state until their nullable snapshot is backfilled.

## Rollback / fallback

The schema field is nullable, so rows created before the migration remain readable. Removing the B7 history files and nullable migration restores the prior history projection; the existing list/detail API remains otherwise unchanged.

## Verdict

B7 implementation, acceptance coverage, browser evidence and workspace gates are complete: **B7 READY**.
