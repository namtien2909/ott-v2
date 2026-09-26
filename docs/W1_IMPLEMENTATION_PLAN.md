# W1 Implementation Plan — Game Rule Engine

> **Status:** IMPLEMENTED / VERIFIED (2026-09-25)  
> **Wave:** W1  
> **Included work:** Phase 1 — Game Rule Engine  
> **Execution model:** Three coordinated lanes sharing one workspace  
> **Authority:** `task-div.md` → `01_PROJECT_SPEC.md` → `SRS.md` → `02_ARCHITECTURE.md` → `03_NETWORK_SPEC.md` → `04_TEST_PLAN.md` → `05_TEAM_TASKS.md` → `W0_IMPLEMENTATION_PLAN.md`

---

# 1. W1 OUTCOME

W1 turns the W0 `packages/game-rules` boundary into a deterministic, pure and testable OTTv2 rules engine. It also puts a fixture-driven 9×9 board on the web shell so the rules can be visually inspected without pretending that realtime gameplay already exists.

At completion:

- the canonical 9×9 board and coordinate system are implemented;
- the exact BLUE and RED initial setups are deterministic;
- all eight one-square movement directions are validated;
- friendly blocks, same-type blocks and losing captures are rejected;
- the three winning capture relations are applied correctly;
- extinction and goal wins are deterministic;
- BLUE starts, accepted non-terminal moves switch turn, and rejected moves do not;
- rule transitions are immutable and contain no HTTP, Prisma, PlayHTML or timer behavior;
- the web board renders a typed fixture state with canonical labels;
- RED visual orientation can rotate 180° without changing canonical coordinates;
- local selection and legal-destination highlights are demonstrable only;
- exhaustive W1 rule tests pass before realtime/network code is attached.

W1 is complete only when the rule package, board fixture and deterministic tests pass together from the documented commands.

---

# 2. W1 SCOPE BOUNDARY

## 2.1 In scope

- `packages/game-rules/**` domain model and pure transition functions;
- stable coordinate, side, piece and rule-result types;
- canonical setup and board utilities;
- movement and capture validation;
- extinction and goal evaluation;
- turn progression for accepted/rejected moves;
- fixture-driven board rendering in `apps/web/**`;
- RED 180° visual orientation helpers;
- local selection/legal-destination presentation;
- deterministic unit/contract tests for all W1 rules;
- package/root build and test wiring required to execute the above.

## 2.2 Explicitly out of scope

W1 MUST NOT implement or imply completion of:

- HTTP `PIECE_MOVE` endpoints;
- WebSocket/PlayHTML transport;
- authentication, sessions or account identity;
- rooms, matchmaking, ready/countdown or spectators;
- authoritative clocks, timeout or disconnect results;
- persistence, Prisma schema tables or match history;
- Elo/rating;
- rematch, surrender or reconnect;
- AI or Offline mode;
- client authority over online state;
- random side assignment. The future match coordinator assigns sides; the rule state always starts with BLUE as the first turn;
- deployment or Render configuration.

If a task appears to require one of these items, stop at the W1 boundary and report it to the coordinator instead of adding a placeholder API that changes ownership.

## 2.3 Mandatory task-div Wave 1 mapping

The task IDs below are the authoritative Wave 1 assignment from `docs/task-div.md`; this plan must not introduce alternate W1 IDs:

| Person | Exact Wave 1 tasks | Dependency from `task-div.md` |
|---|---|---|
| A — Game Experience Builder | `A02`, `A03`, `A04` | A02 → A03; A04 depends on A02 and rule helpers |
| B — Backend / Network / Data | `B04`, `B05` | B04 → B05; B04 uses shared game types |
| C — Integration / QA / Performance | `C03`, `C04` | C03 depends on B04/B05; C04 depends on B05 |

Wave 1 completion gate: **critical game-rule tests pass before realtime networking is attached**.

---

# 3. LOCKED W1 RULE BASELINE

The following rules are copied from the frozen SRS and are implementation constraints, not suggestions.

## 3.1 Board and coordinates

- Board size is exactly 9×9 = 81 squares.
- Canonical coordinates are `a1` through `i9`.
- Files are `a..i`; ranks are `1..9`.
- `a1` and `i9` are initially empty goal squares.
- Canonical coordinates never rotate in the domain state.
- A RED client view may rotate the visual grid 180°, but every label still names the canonical square shown there.

## 3.2 Pieces and setup

Each side owns exactly 9 pieces:

- 3 Rock `R` / `✊`;
- 3 Paper `P` / `✋`;
- 3 Scissors `S` / `✌️`.

Canonical BLUE setup:

| Square | Piece |
|---|---|
| `b1` | BLUE R |
| `c1` | BLUE P |
| `d1` | BLUE S |
| `e1` | BLUE R |
| `f1` | BLUE P |
| `g1` | BLUE S |
| `h1` | BLUE R |
| `i1` | BLUE P |
| `a2` | BLUE S |

Canonical RED setup is the exact 180° rotation:

| Square | Piece |
|---|---|
| `a9` | RED P |
| `b9` | RED R |
| `c9` | RED S |
| `d9` | RED P |
| `e9` | RED R |
| `f9` | RED S |
| `g9` | RED P |
| `h9` | RED R |
| `i8` | RED S |

Piece identifiers MUST be deterministic and unique within a state. The exact naming convention may be `blue-r-1`/`red-p-1` or equivalent, but the same setup must always produce the same IDs and tests must not depend on random UUIDs.

## 3.3 Movement and capture

A move is legal only when:

```text
max(abs(to.file - from.file), abs(to.rank - from.rank)) == 1
```

The engine MUST reject:

- zero-step moves;
- two-step or non-adjacent moves;
- out-of-bounds coordinates;
- moving an empty square;
- moving a piece owned by the wrong side;
- moving while it is not that side's turn;
- moving after the state is finished;
- a friendly occupied destination;
- a same-type enemy destination;
- an enemy destination where the attacker loses.

Capture matrix:

| Attacker | Defender | Result |
|---|---|---|
| `R` | `S` | capture |
| `S` | `P` | capture |
| `P` | `R` | capture |
| `R` | `R` | reject/block |
| `P` | `P` | reject/block |
| `S` | `S` | reject/block |
| `R` | `P` | reject/losing attacker |
| `P` | `S` | reject/losing attacker |
| `S` | `R` | reject/losing attacker |

The losing-attacker rule is the transparent derived v0.1 rule recorded in the SRS. It is locked for W1 so client, server and tests cannot diverge; any teacher clarification must trigger an explicit specification change before code changes.

## 3.4 Turn and results

- Initial turn is `BLUE`.
- Accepted non-terminal move switches to the other side.
- Rejected move returns the unchanged rule state and does not switch turn.
- A successful capture removes the defender and updates counts.
- Extinction win occurs immediately when the opponent has zero pieces of any one type.
- BLUE wins by moving a surviving BLUE piece to `i9`.
- RED wins by moving a surviving RED piece to `a1`.
- `a1` is not a BLUE goal; `i9` is not a RED goal.
- A terminal accepted move sets `status=FINISHED`, `winner`, and a rule result reason. No later move is accepted.
- Timeout, surrender, disconnect and server interruption are deferred to later services. W1 result reasons are only `EXTINCTION` and `GOAL_REACHED`.

---

# 4. DOMAIN CONTRACT TO FREEZE BEFORE CODING

The coordinator and Agent B MUST agree on names before Agents A and C consume the package. The exact TypeScript syntax can vary, but the semantics below are locked.

```ts
type File = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i";
type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type Coordinate = `${File}${Rank}`;
type Side = "BLUE" | "RED";
type PieceType = "R" | "P" | "S";

type Piece = {
  id: string;
  side: Side;
  type: PieceType;
};

type RuleState = {
  board: Readonly<Record<Coordinate, Piece | null>>;
  pieceCounts: Readonly<Record<Side, Readonly<Record<PieceType, number>>>>;
  currentTurn: Side | null;
  status: "PLAYING" | "FINISHED";
  winner: Side | null;
  resultReason: "EXTINCTION" | "GOAL_REACHED" | null;
};

type MoveCommand = {
  side: Side;
  from: Coordinate;
  to: Coordinate;
};
```

The package MUST expose equivalent stable APIs:

- `BOARD_COORDINATES` in deterministic row/file order;
- `GOAL_COORDINATES` or equivalent goal constants;
- `createInitialState()`;
- `rotateCoordinate180(coordinate)`;
- `getLegalDestinations(state, side, from)`;
- `applyMove(state, command)`;
- capture relation and rule/rejection codes needed by tests and presentation;
- types for `Coordinate`, `Side`, `PieceType`, `Piece`, `RuleState`, `MoveCommand` and the transition result.

`applyMove` MUST be pure:

- never mutate the input state, board or nested piece-count objects;
- return a serializable accepted/rejected result;
- keep user-facing Vietnamese text out of the domain package;
- not import Fastify, React, Prisma, PlayHTML, timers or process environment.

The transition result MUST distinguish accepted and rejected moves. A rejected result MUST expose a stable machine-readable code such as `OUT_OF_BOUNDS`, `NOT_ONE_STEP`, `NO_PIECE`, `NOT_OWNER`, `WRONG_TURN`, `GAME_OVER`, `FRIENDLY_BLOCK`, `SAME_TYPE_BLOCK`, or `LOSING_ATTACKER`; UI text is mapped outside the domain package.

W1 MUST NOT add `sequence`, `stateVersion`, clock fields or transport envelopes to `RuleState`. Those belong to the later match/network layer and would make the pure engine responsible for transport concerns.

---

# 5. OWNERSHIP AND FILE BOUNDARIES

| Area | Primary lane | Boundary |
|---|---|---|
| `packages/game-rules/**` | Agent B | Exclusive W1 domain implementation |
| `apps/web/src/components/board/**` | Agent A | Board presentation and local selection only |
| `apps/web/src/pages/GameRoomPage.tsx` | Agent A | Fixture integration only; no network gameplay |
| `tests/unit/game-rules/**` | Agent C | Exhaustive deterministic rule tests |
| `apps/web/src/components/board/**.test.tsx` | Agent A | UI rendering tests, coordinated with C if needed |
| Root package/workspace files | Coordinator | Dependency/script integration only |
| `packages/contracts/**` | Coordinator/B proposal | Do not add network move envelopes in W1 |
| `apps/server/**` | Coordinator/B review | No runtime endpoint or transport implementation in W1 |
| `prisma/**` | Nobody in W1 | No schema/migration work |
| `docs/W1_IMPLEMENTATION_PLAN.md` | Coordinator | This plan and final evidence |

All lanes preserve W0 changes. No lane may reset, overwrite or reformat unrelated work.

---

# 6. EXECUTION STAGES AND PARALLELISM

```text
W1.0 Contract freeze (Coordinator + Agent B)
  ├─ domain names, state shape, result/rejection codes
  ├─ coordinate ordering and RED rotation mapping
  └─ fixture/test ownership handoff
       ↓
W1.1 Parallel implementation
  ├─ Agent B: B04 → B05
  ├─ Agent A: A02 → A03 → A04
  └─ Agent C: C03 → C04
       ↓
W1.2 Cross-lane integration
  ├─ game-rules exports consumed by web and tests
  ├─ fixture board rendered without network calls
  ├─ rejected/accepted semantics agree across package and tests
  └─ no W2+ transport/database behavior introduced
       ↓
W1.3 Verification gate
  ├─ package typecheck/build
  ├─ exhaustive rules tests
  ├─ board UI tests
  ├─ workspace regression suite
  └─ manual fixture smoke check
```

## Parallel execution map

| Work window | Agent B | Agent A | Agent C |
|---|---|---|---|
| After W1.0 | B04 pure authoritative engine boundary and public rule types | A02 fixture-driven 9×9 renderer after shared game types are frozen | Wait for B04/B05 public behavior before writing dependent assertions |
| Core implementation | B05 setup, movement, capture, victory and turn semantics | A03 BLUE/RED rotation and canonical coordinate labels after A02 | C03 setup and movement tests after B04/B05 behavior is available |
| Finalization | B05 package exports and handoff evidence | A04 local selection and legal-move highlighting after A02/rule helpers | C04 capture, victory and turn tests after B05 |
| Integration | Coordinator resolves contract conflicts and runs gates | All lanes stop feature work and fix only integration defects | All lanes stop feature work and fix only integration defects |

Parallel work is allowed only after W1.0 contract freeze. If an export or semantic disagreement appears, the affected lane stops and reports it; it must not create a local duplicate type or rule.

---

# 7. AGENT B PLAN — B04 THROUGH B05

Agent B leads the authoritative domain implementation. The package is the only source of truth for rule transitions.

## B04 — Pure authoritative Game Engine boundary

### Objective

Replace the W0 placeholder with the pure authoritative Game Engine boundary and the minimal exported type/function surface described in Section 4.

### In scope

- coordinate, side, piece and rule-state types;
- stable result/rejection discriminated unions;
- `BOARD_COORDINATES`, goals and capture relation constants;
- `applyMove`/`getLegalDestinations` pure-engine boundary;
- package export surface;
- no dependencies on app/server/runtime modules.

### Acceptance

- `packages/game-rules` typechecks with strict TypeScript;
- web and root tests can import the public types through `@ottv2/game-rules`;
- transport fields are absent from the core state;
- no duplicate game-rule types are proposed in contracts or web.

## B05 — Board setup, moves, capture, victory and turns

### Objective

Implement the complete W1 rules required by the task division table.

### In scope

- deterministic coordinate utilities and exact initial state;
- `rotateCoordinate180` and goal constants;
- `createInitialState` with 18 total pieces and correct counts;
- deterministic piece IDs;
- all eight one-square directions and bounds validation;
- ownership, turn and occupancy validation;
- R→S, S→P, P→R capture;
- losing-attacker rejection;
- immutable board and count updates;
- extinction, goal results and terminal-state guard;
- package exports and declaration output;
- no random side assignment, timer, network or database behavior.

### Acceptance

- exactly 81 board entries are present;
- `a1` and `i9` are empty;
- each side has 3 R, 3 P and 3 S;
- RED setup equals the 180° rotation of BLUE setup;
- valid empty-square move changes only source/destination and turn;
- valid capture removes defender, moves attacker and decrements the correct count;
- rejected move leaves the supplied state observably unchanged;
- wrong-side and wrong-turn attempts are rejected;
- all six extinction directions/cases and both goal directions are deterministic;
- terminal moves reject later commands with `GAME_OVER`;
- no HTTP, realtime, database or timer imports.

### Agent B verification

Run and report:

```text
corepack pnpm --filter @ottv2/game-rules typecheck
corepack pnpm --filter @ottv2/game-rules build
corepack pnpm --filter @ottv2/game-rules lint
```

The package must also pass the root workspace gates after integration.

### Agent B handoff

- public game-rules exports;
- canonical setup fixture;
- result/rejection code catalog;
- immutability guarantee;
- explicit list of deferred timer/network/result reasons.

---

# 8. AGENT A PLAN — A02 THROUGH A04

Agent A owns the presentation-only board. The board may call pure helpers to show local legal destinations, but it must not claim an online move was accepted.

## A02 — Render board 9×9 from fixture

### Objective

Render the full 9×9 board from a typed game fixture without creating a fake network game.

### In scope

- `Board`/`BoardView` component contract;
- typed consumption of `@ottv2/game-rules` `RuleState` and coordinate constants;
- fixture state injection;
- documented side/view mode (`BLUE`, `RED`, or canonical spectator view);
- 9×9 grid with all 81 squares;
- R/P/S piece visual treatment and empty-square rendering;
- responsive layout and accessible square/piece names;
- no API client, websocket or local authority.

### Acceptance

- component accepts state as input rather than constructing hidden business state;
- state changes are presentation-only;
- no local move is treated as an authoritative transition.

## A03 — BLUE/RED rotation and coordinate labels

### Objective

Add canonical coordinate labels and the BLUE/RED visual orientation rules.

### In scope

- BLUE canonical orientation and RED 180° visual rotation;
- coordinate labels that remain canonical after rotation;
- corner/edge mapping tests for the shared rotation helper;
- BLUE/RED orientation control without changing the supplied rule state.

### Acceptance

- every coordinate appears exactly once after either supported visual orientation;
- the same canonical square keeps the same label after RED rotation;
- the `a1`/`i9` corner mapping is covered;
- orientation changes do not mutate the supplied fixture;
- no route requires auth or realtime to render the fixture.

## A04 — Selection and local legal-move highlight

### Objective

Provide the local board interaction required by Phase 1 without implementing gameplay transport.

### In scope

- selecting a local piece owned by the viewed side;
- highlighting `getLegalDestinations` results;
- clearing/replacing selection;
- rejected/disabled selection states for opponent pieces, finished state or no legal destinations.

### Acceptance

- BLUE and RED views show the same canonical state from different visual orientations;
- selection never mutates the supplied `RuleState`;
- hover/selection state is local and not emitted to server/realtime code;
- no click pretends to persist or broadcast a move.

### A04 verification and visual handoff

### Objective

Prove the board renders the locked fixture, orientation semantics and local selection behavior in the existing web test environment.

### Required tests

- 81 squares rendered;
- canonical labels present exactly once;
- initial piece count and representative setup positions;
- RED rotation maps corner/edge coordinates correctly;
- selection highlights only legal destinations;
- opponent piece cannot be selected as the viewed side;
- component has no network dependency.

### Agent A verification

```text
corepack pnpm --filter @ottv2/web typecheck
corepack pnpm --filter @ottv2/web lint
corepack pnpm --filter @ottv2/web test
corepack pnpm --filter @ottv2/web build
```

### Agent A handoff

- board component props and fixture usage;
- orientation mapping;
- stable test selectors/accessibility names;
- list of deliberately deferred online/game-room behavior.

---

# 9. AGENT C PLAN — C03 THROUGH C04

Agent C owns deterministic rule coverage and must test the domain contract rather than copy implementation details into a second engine.

## C03 — Game setup and movement tests

### Objective

Create deterministic tests for setup, coordinates and movement boundaries while keeping the production package pure.

### In scope

- root `tests/unit/game-rules/**` fixtures/helpers;
- minimal custom-state builder for focused move cases;
- board/count/state equality helpers;
- deterministic test naming and no wall-clock dependency;
- import only from `@ottv2/game-rules` public exports.

### Acceptance

- tests can construct edge/corner/interior scenarios without bypassing public behavior;
- no duplicate capture algorithm is written in test helpers;
- tests can assert rejected transitions leave state unchanged.

### Required coverage

- 81 squares and coordinate ordering;
- goals empty at setup;
- 9 pieces per side and 3 per type;
- RED = 180° BLUE setup;
- all eight directions from center/edge/corner where in bounds;
- zero-step, two-step, diagonal-too-far and out-of-bounds rejection;
- empty source, wrong owner, wrong turn;
- friendly block and same-type block.

## C04 — Capture, victory and turn tests

### Required coverage

- R captures S;
- S captures P;
- P captures R;
- all three same-type blocks;
- all three losing-attacker rejections;
- piece removal/count update;
- BLUE and RED extinction for each piece type;
- BLUE `i9` goal and non-goal `a1` case;
- RED `a1` goal and non-goal `i9` case;
- BLUE starts;
- accepted non-terminal move switches turn;
- rejected move preserves turn;
- terminal move prevents later moves.

### C04 immutability, regression and evidence

### Objective

Protect the W1 boundary and prove the full deterministic suite is runnable.

### Required checks

- input state is deeply unchanged after accepted move;
- input state is deeply unchanged after rejected move;
- two calls to `createInitialState` do not share mutable nested state;
- repeated identical command/state inputs produce equivalent results;
- no timer/network/database behavior is required by rule tests;
- root W0 tests remain green.

### Agent C verification

```text
corepack pnpm test:unit
corepack pnpm test:integration
corepack pnpm test
corepack pnpm -r --if-present test
```

The final report must include test count, command output summary and any intentionally deferred cases.

### Agent C handoff

- rule coverage matrix;
- evidence for derived losing-attacker semantics;
- mutation/immutability evidence;
- regression result for W0 contracts and harness.

---

# 10. CROSS-LANE CONTRACTS

Before W1.1 implementation proceeds, these points must agree:

| Contract | Producer | Consumers |
|---|---|---|
| Coordinate type/order | Agent B/coordinator | Agent A, Agent C |
| 180° rotation mapping | Agent B/coordinator | Agent A, Agent C |
| Initial setup and deterministic IDs | Agent B | Agent A fixtures, Agent C tests |
| Capture matrix | SRS + Agent B | Agent A legal highlights, Agent C tests |
| Rejection codes | Agent B | Agent C assertions, Agent A presentation mapping |
| Rule state/result shape | Agent B/coordinator | Agent A, Agent C |
| Pure transition guarantee | Agent B | All lanes |
| Deferred network/timer fields | Coordinator | All lanes |

W1 must not add room, match, auth or social messages merely to make the board appear interactive.

---

# 11. INTEGRATION AND VERIFICATION ORDER

The coordinator performs these steps in order:

1. Re-read the W0 handoff and confirm no W0 file is being overwritten.
2. Freeze the Section 4 domain contract and rejection/result codes.
3. Integrate Agent B's `packages/game-rules` exports.
4. Add `@ottv2/game-rules` as a workspace dependency of the web only if the board consumes the package directly.
5. Integrate Agent C's deterministic rule tests.
6. Integrate Agent A's fixture board and UI tests.
7. Run package typecheck/build/lint and the web checks.
8. Run root unit, integration and workspace tests.
9. Inspect for forbidden imports/behavior: Prisma, Fastify, PlayHTML, timers, HTTP clients or environment access inside `packages/game-rules`.
10. Manually start the web shell and verify the fixture board can render without a server listener.
11. Confirm no database migration, realtime adapter, auth route or network contract changed during W1.
12. Record the exact gate result in this file and only then mark W1 complete.

Suggested final local sequence:

```powershell
corepack pnpm install
corepack pnpm --filter @ottv2/game-rules typecheck
corepack pnpm --filter @ottv2/game-rules build
corepack pnpm --filter @ottv2/web typecheck
corepack pnpm --filter @ottv2/web test
corepack pnpm test:unit
corepack pnpm test:integration
corepack pnpm typecheck
corepack pnpm build
corepack pnpm lint
corepack pnpm test
corepack pnpm -r --if-present test
```

The local PostgreSQL service is not required for W1 rule tests. Do not create a new migration just to validate W1.

---

# 12. W1 DEFINITION OF DONE

```text
[x] W0 remains green with no contract regression
[x] `packages/game-rules` exposes stable coordinate/side/piece/state types
[x] Board contains exactly 81 canonical coordinates
[x] Initial BLUE and RED setups match the frozen SRS
[x] Goals `a1` and `i9` are empty initially
[x] Each side has exactly 3 R, 3 P and 3 S
[x] RED setup is a 180° rotation of BLUE setup
[x] All legal one-square directions work
[x] Bounds, zero-step and non-adjacent moves reject safely
[x] Friendly, same-type and losing-attacker destinations reject safely
[x] R/S, S/P and P/R captures update board and counts
[x] Extinction results are deterministic for all piece types and sides
[x] BLUE `i9` and RED `a1` goal wins are deterministic
[x] BLUE starts; accepted/rejected turn semantics are correct
[x] Terminal states reject later moves
[x] Rule transitions do not mutate input state
[x] Rule package contains no HTTP, Prisma, Fastify, PlayHTML or timer dependency
[x] Web board renders fixture state without network dependency
[x] Canonical labels survive BLUE/RED visual orientation
[x] Local selection/legal destination highlighting works without authority claims
[x] Exhaustive W1 rule tests pass
[x] Web component tests pass
[x] Typecheck, build, lint and workspace regression suite pass
[x] No W2+ behavior was prematurely invented
```

W1 is **FAIL** if tests only cover happy paths, if the UI duplicates the capture/movement algorithm, if rule state is mutated in place, or if any realtime/database behavior is required for the board fixture to render.

---

# 13. RISKS AND CONTROLS

| Risk | Control |
|---|---|
| A, B and C invent different coordinate conventions | Freeze Section 4 before parallel work; use one exported coordinate utility |
| UI accidentally becomes authoritative | Board consumes fixture state and pure legal-destination helpers only; no network mutation |
| Losing-attacker rule is implemented inconsistently | Lock the SRS-derived rule and test all three losing matchups |
| RED rotation changes canonical coordinates | Test `rotateCoordinate180` and rendered labels at corners/edges |
| Rule state leaks mutable nested objects | Deep immutability tests and fresh-state tests |
| W1 grows into realtime/game-room work | Keep timer, sequence, stateVersion, transport and persistence explicitly deferred |
| Package exports point to stale `dist` | Run package build before root tests and verify declarations/exports |
| W0 regressions are hidden by focused tests | Run the full root and recursive workspace suite at the final gate |

---

# 14. AGENT DISPATCH PROMPTS

## Agent B

Implement only B04–B05 from this plan. Own `packages/game-rules/**`. Build a pure, immutable, server-authoritative rule core from the locked SRS. Do not add HTTP, Fastify, Prisma, PlayHTML, timers, auth, rooms or network envelopes. Report exact exports, rejection/result codes, tests and deferred items.

## Agent A

Implement only A02–A04 from this plan. Own the fixture-driven board presentation in `apps/web/**`. Consume `@ottv2/game-rules`; do not duplicate movement/capture logic, add fake online APIs or claim that a local click is an accepted server move. Prove 9×9 rendering, canonical labels, RED rotation and local legal-destination highlights.

## Agent C

Implement only C03–C04 from this plan. Own `tests/unit/game-rules/**` and deterministic rule coverage. Consume public game-rules exports; do not implement a second rules engine in test helpers. Cover setup, movement boundaries, captures, goals, extinction, turn progression and immutability, then report exact commands and evidence.

---

# 15. APPROVAL GATE

W1 implementation begins only after the Leader approves:

- the Section 4 rule-state and transition contract;
- canonical coordinate ordering and RED rotation mapping;
- deterministic piece-ID convention;
- derived losing-attacker behavior;
- ownership boundaries for `packages/game-rules`, web board and tests;
- the W1 Definition of Done.

The current document is the approved execution plan only after this gate. Until then, no lane should implement beyond its W1.0 contract proposal.

---

# 16. W1 EXECUTION RESULT

Implementation completed in the shared local workspace according to the exact `task-div.md` Wave 1 mapping (`A02–A04`, `B04–B05`, `C03–C04`).

## Verified commands

```text
corepack pnpm --filter @ottv2/game-rules typecheck  PASS
corepack pnpm --filter @ottv2/game-rules build      PASS
corepack pnpm --filter @ottv2/game-rules lint       PASS
corepack pnpm --filter @ottv2/web typecheck         PASS
corepack pnpm --filter @ottv2/web lint              PASS
corepack pnpm --filter @ottv2/web test              PASS (10 tests)
corepack pnpm --filter @ottv2/web build             PASS
corepack pnpm test                                  PASS (31 tests)
corepack pnpm -r --if-present test                  PASS (server 17 + web 10 tests)
corepack pnpm typecheck                             PASS
corepack pnpm build                                 PASS
corepack pnpm lint                                  PASS
```

## Rule and UI evidence

- `tests/unit/game-rules.unit.test.ts`: 26 deterministic rule tests pass.
- Setup has 81 squares, 18 pieces, 3 R/P/S per side, empty `a1`/`i9`, and BLUE first.
- Movement, edge/corner bounds, all capture relations, same-type/losing blocks, both-side extinction, both goals, turn switching and immutability are covered.
- `GET http://localhost:3001/health` returned HTTP 200 with database `ok`.
- `GET http://localhost:8000/` returned HTTP 200.
- `GET http://localhost:8000/phong/w1-demo` returned HTTP 200.
- The board is fixture-driven and local-only; no realtime, timer, auth, room or persistence behavior was added.
- Post-gate UI hardening: tactical piece tokens now carry side/type contrast, both goal cells are visually marked, legal captures use a distinct danger ring, and every square exposes a canonical Vietnamese aria label describing goal/legal/capture state.

## W1 gate

```text
W1 GAME RULE ENGINE / SETUP / MOVE / CAPTURE / VICTORY / TURN = PASS
W1 BOARD FIXTURE / ROTATION / LABELS / LOCAL HIGHLIGHT       = PASS
W1 RULE TESTS BEFORE REALTIME ATTACHMENT                    = PASS
W1 W0 REGRESSION                                             = PASS
W1 PUBLIC DEPLOYMENT                                         = OUT OF SCOPE
```

## W1 handoff

The local project is ready for the next wave. The next implementation must attach auth/room/network behavior around this pure rules package without moving authority into the client or adding transport concerns to `packages/game-rules`.
