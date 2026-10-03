# Working agreement — OTT v2

## Authority and scope

- Product-facing copy is Vietnamese. Technical identifiers remain English.
- Follow the latest explicit human decisions and `docs/implementation_plan_ott_v0.2_robot_lab.md` for the new Robot Lab scope. Preserve `docs/implementation_plan_frontend_v0.2.md` and B0–B14 evidence as historical work, not proof that the new scope is complete.
- The user approved local execution with “Duyệt” on 2026-10-02. Root interpreted this as approval of recommended answers 79–86A as well as the previously accepted 1–78 decisions. Do not represent that interpretation as eight separate questionnaire submissions.
- Local approval does not authorize push, production deployment, paid services, enabling billing, destructive data operations, or migration of a shared/production database. Obtain separate human approval for those actions.
- Never execute player Python in the application process or a native unrestricted subprocess. Online and Offline runtime security gates in the plan are mandatory.

## Required workflow

`Plan → Harness → Dev → Test → Review → Clean Rubbish Code`

1. **Plan:** inspect the actual source, clarify material ambiguities with recommended multiple-choice questions, describe visible output and error/permission states, list dependencies and acceptance criteria. Do not create a supposed final plan while critical product choices are still open.
2. **Harness:** reproduce the defect or establish a failing regression/security test before fixing it. For runtime/security/performance feasibility, record the environment and measured outcome; a mock is not proof of a working production runtime.
3. **Dev:** implement the approved Wave and its dependencies only. Canonical rules belong to `@ottv2/game-rules`; payloads belong to `@ottv2/contracts`; permissions/clocks/results belong to the server. UI effects must not invent or delay state.
4. **Test:** run focused tests and proportionate full typecheck/lint/build/integration/browser gates. Use a disposable, explicitly identified test database; never assume the default DATABASE_URL is safe for mutation.
5. **Review:** check actor permissions, races, copy, accessibility, theme, viewport, motion and failure paths. Independent review must have actual evidence. Do not claim an independent pass if the reviewer is unavailable or its task failed.
6. **Clean Rubbish Code:** remove obsolete code/assets only after identifying their consumers and preserving compatibility/data migration. Do not delete user work, unrelated changes, old evidence or `.worktrees/` merely because it is untracked.

## Wave execution and collaboration

- A Wave is DONE only when its acceptance items have passing evidence. Build success alone is insufficient. Mark NOT RUN / BLOCKED / IN PROGRESS honestly.
- Each worker must read this file and the approved plan, then declare its Wave and exact file ownership. Parallel execution follows the plan's dependency and shared-file ownership tables.
- One writer owns contracts, router, shared styles, Prisma schema and shared match lifecycle at a time. A page worker requests a shared change instead of editing the same shared file concurrently.
- Preserve existing changes. Use small reversible edits; do not reset or clean the worktree to obtain a clean diff.
- Report the completed Wave, evidence, remaining gaps and next executable Wave. Do not describe prototypes, fixtures, skipped tests or unavailable device testing as 100% implementation.

## Product invariants

- A1/I9 are normal playable squares containing the initial pieces. Do not move pieces above the board or change canonical setup.
- Online players see their own side/HUD at the bottom, fixed for the match. AI/manual Offline/Bot Offline stay canonical. Referee/Spectator use canonical Blue at the bottom. Never rotate on turn changes.
- Guest is an unauthenticated principal, not a duplicate game mode. Its generated name persists per browser profile/device storage; do not promise physical-device identity across browsers or after storage deletion.
- Board/pieces use the approved Robot Lab design. White-glove gesture assets must be original and deterministic; do not ship OS emoji recoloring filters as the final white-glove asset.
- Referee is distinct from both a player side and the host management capability. No role is acquired by editing a URL/client payload.
- A stopped match is authoritatively locked, with clocks frozen. Only elapsed pause time and connectivity/UI information continue. Resume cannot clear unrelated infrastructure/disconnect blockers.
- Never expose private Python source, memory, logs or diagnostics through public room snapshots, SSE, spectators, referee views, replay or downloadable public audit records.
- Free-only means no paid service, automatic upgrade/billing or trial-credit dependency. Feasibility is measured, not promised.
