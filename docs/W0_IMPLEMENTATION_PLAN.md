# W0 Implementation Plan — Project Bootstrap

> **Status:** IMPLEMENTED / VERIFIED (2026-09-25)  
> **Wave:** W0  
> **Included tasks:** A00–A01, B00–B03, C00–C02  
> **Execution model:** Three coordinated subagents sharing one workspace  
> **Authority:** `01_PROJECT_SPEC.md` → `SRS.md` → `02_ARCHITECTURE.md` → `03_NETWORK_SPEC.md` → `04_TEST_PLAN.md` → `05_TEAM_TASKS.md`

---

# 1. W0 OUTCOME

W0 creates the smallest runnable, testable foundation for OTTv2. It does not implement product features. At completion:

- the monorepo installs through one package-manager command;
- the web application starts and renders the Vietnamese application shell;
- the server starts, validates configuration and exposes a versioned health endpoint;
- Prisma can validate the schema and run the initial PostgreSQL migration workflow;
- shared contracts can be imported by web, server and tests;
- the realtime boundary exists as an interface/adapter skeleton without game authority;
- unit and server integration tests run locally and in CI;
- an initial multi-client test harness can create isolated logical clients without inventing unfinished game behavior.

W0 is complete only when all W0 gates pass from a clean checkout using documented commands.

---

# 2. LOCKED TECHNICAL BASELINE

| Concern | W0 decision |
|---|---|
| Workspace | pnpm workspace |
| Runtime | Current Node.js LTS, pinned in repository metadata |
| Language | TypeScript with strict mode |
| Web | React + Vite |
| Styling | Tailwind CSS |
| Server | Fastify |
| Runtime validation | Zod |
| Database | PostgreSQL + Prisma |
| Unit/integration tests | Vitest |
| Browser E2E foundation | Playwright |
| Load-test foundation | k6; configuration only when executable availability is not guaranteed |
| CI | GitHub Actions |
| Package boundaries | `apps/web`, `apps/server`, `packages/contracts`, `packages/game-rules`, `packages/test-utils` |

Changing this table during W0 requires Leader approval and an update to this plan before implementation continues.

---

# 3. REPOSITORY TARGET

```text
/
├─ apps/
│  ├─ web/
│  └─ server/
├─ packages/
│  ├─ contracts/
│  ├─ game-rules/
│  └─ test-utils/
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/
├─ tests/
│  ├─ contract/
│  ├─ integration/
│  ├─ e2e/
│  └─ load/
├─ docs/
├─ .github/workflows/
├─ .env.example
├─ package.json
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
└─ README.md
```

Equivalent generated support files are allowed, but domain code must remain inside the declared boundaries.

---

# 4. SHARED RULES FOR ALL W0 AGENTS

1. Read this plan and all parent documents before editing.
2. Do not change locked product behavior or invent W1+ domain semantics.
3. Preserve changes already made by another agent; never reset or overwrite unrelated files.
4. Before editing a shared root file, inspect its latest contents.
5. Shared root files are integrated by the W0 coordinator unless ownership below explicitly assigns them.
6. Use workspace package imports rather than deep relative imports across package boundaries.
7. Do not commit secrets. Only environment-variable names and safe examples go into `.env.example`.
8. Every agent must run its lane checks and report exact commands, results and remaining limitations.
9. A skeleton must compile and express its boundary; it must not contain fake production behavior.
10. Any contract conflict stops the affected work and is escalated to the coordinator.

---

# 5. OWNERSHIP AND SHARED-FILE CONTROL

| Area | Primary agent | Notes |
|---|---|---|
| `apps/web/**` | Agent A | Exclusive in W0 except coordinator fixes |
| `apps/server/**` | Agent B | Exclusive in W0 except coordinator fixes |
| `prisma/**` | Agent B | Initial migration and validation |
| `packages/contracts/**` | Agent B proposes, coordinator integrates | Agent C consumes for tests |
| `packages/game-rules/**` | Coordinator skeleton only | No game rules implemented in W0 |
| `packages/test-utils/**` | Agent C | Test-only helpers and logical client harness |
| `tests/**` | Agent C | Cross-package test foundation |
| `.github/workflows/**` | Agent C | CI workflow |
| Root workspace/config files | Coordinator | Prevents concurrent conflicts |
| `README.md`, `.env.example` | Coordinator integrates | Inputs supplied by all lanes |

---

# 6. EXECUTION STAGES AND PARALLELISM

```text
W0.0 Coordinator foundation
  ├─ root package/workspace configuration
  ├─ shared TypeScript configuration
  ├─ package skeletons and shared scripts
  └─ ownership handoff
       ↓
W0.1 Parallel implementation
  ├─ Agent A: A00 → A01
  ├─ Agent B: B00 → B01 → B02 → B03
  └─ Agent C: C00 → C01; C02 after server bootstrap contract is visible
       ↓
W0.2 Cross-lane integration
  ├─ web → server health request
  ├─ web/server/tests import shared contracts
  ├─ database validation/migration check
  └─ multi-client harness smoke test
       ↓
W0.3 Coordinator verification
  ├─ install/build/typecheck/lint/test
  ├─ clean-start documentation check
  └─ W0 gate decision
```

Agent C may prepare its structure in parallel but must not hard-code an API shape before Agent B publishes the health contract.

---

# 7. AGENT A PLAN — A00 AND A01

## A00 — Web bootstrap

### Objective

Create a compilable React/Vite/TypeScript web application that consumes workspace contracts and provides route placeholders for the six primary product surfaces.

### In scope

- Vite React TypeScript application under `apps/web`;
- strict TypeScript configuration extending the root configuration;
- route shell/placeholders for Login/Register, Homepage, Game Room, History, Profile and Friends;
- typed HTTP client boundary with configurable API base URL;
- initial health-status read that can distinguish loading, success and failure;
- import smoke usage from `@ottv2/contracts`;
- Vietnamese visible placeholder text.

### Out of scope

- real authentication;
- complete page design;
- room/game state;
- PlayHTML connection;
- authoritative rule logic;
- production animations.

### Expected files

```text
apps/web/
├─ src/
│  ├─ app/
│  ├─ components/
│  ├─ lib/http/
│  ├─ routes/
│  ├─ styles/
│  ├─ main.tsx
│  └─ vite-env.d.ts
├─ index.html
├─ package.json
├─ tsconfig.json
└─ vite.config.ts
```

### Acceptance

- development server starts without TypeScript errors;
- production build succeeds;
- all required route placeholders can be reached;
- API URL comes from configuration and is not hard-coded to production;
- health loading/success/failure states are visibly distinguishable;
- no Online game decision is calculated by the client.

## A01 — UI foundation

### Objective

Provide a coherent reusable UI foundation without spending W0 time on final visual polish.

### In scope

- Tailwind integration;
- design tokens for BLUE, RED, neutral surface, success, warning and error;
- light/dark/system theme foundation;
- responsive application layout;
- accessible Button, LoadingIndicator, Toast and Modal primitives;
- focus visibility and keyboard dismissal for modal where applicable;
- a small component smoke test if the configured DOM test environment supports it.

### Acceptance

- primitives render in a development showcase or route;
- Modal exposes an accessible title and restores/controls focus reasonably;
- pending Button can be disabled and indicate loading;
- Toast supports at least success and error states;
- application remains usable at desktop and narrow viewport widths;
- theme tokens, not scattered raw colors, establish BLUE/RED identity.

## Agent A verification

Agent A must report the actual workspace commands for:

```text
web typecheck
web build
web tests, if configured
```

## Agent A handoff

- API configuration name and HTTP client entry point to Agent B/coordinator;
- route map and UI primitive exports for W1+;
- known accessibility or responsive limitations to the coordinator.

---

# 8. AGENT B PLAN — B00 THROUGH B03

## B00 — Server bootstrap

### Objective

Create a strict TypeScript Fastify service with explicit composition boundaries and fail-fast configuration validation.

### In scope

- application factory separated from process startup;
- Zod-based environment parsing;
- structured logging baseline;
- graceful startup/shutdown hooks;
- shared-contract import;
- no database connection required merely to import the app factory.

### Environment names

At minimum:

```text
NODE_ENV
HOST
PORT
DATABASE_URL
WEB_ORIGIN
LOG_LEVEL
REALTIME_ADAPTER
```

Safe examples may be documented; secrets must not be committed.

## B01 — Health and common errors

### Objective

Expose a stable W0 integration contract and a sanitized common error representation.

### Health contract

Use `GET /health` as the infrastructure health endpoint. Future business APIs use the `/api/v1` prefix. The response must separately represent:

- process/application status;
- database status (`ok` or `degraded`, with a sanitized reason such as `not_configured` where relevant);
- realtime adapter status;
- protocol/application version metadata safe for clients.

DB degradation must not be represented as an instruction to terminate healthy live matches.

### Error contract

The shared public error shape must include stable code, Vietnamese-safe message text, retryability and optional sanitized details. Stack traces and internal database information must never enter the public response.

### Acceptance

- integration test starts a Fastify instance through its app factory and calls the health route with `inject()` without binding a fixed TCP port;
- unknown route and validation errors use sanitized semantics;
- health can report a degraded dependency without crashing the process.

## B02 — Prisma/PostgreSQL foundation

### Objective

Establish a reproducible database workflow without prematurely implementing W2 account tables.

### In scope

- Prisma configuration targeting PostgreSQL;
- initial schema/migration baseline appropriate to an empty application domain;
- singleton/client lifecycle boundary owned by infrastructure code;
- scripts for generate, validate, migrate-development and migration deployment;
- documented clean-database workflow;
- DB readiness helper used by health reporting with bounded failure behavior.

### Out of scope

- Users, Profiles, Matches or social tables;
- database calls in a game loop;
- provider-specific business logic;
- automatic destructive reset.

### Acceptance

- Prisma schema validates;
- client generation succeeds;
- migration workflow can be executed against a configured disposable PostgreSQL database;
- missing/unreachable DB produces a controlled degraded state where applicable.

## B03 — HTTP/realtime adapter skeleton

### Objective

Express the realtime transport boundary while preserving application authority.

### In scope

- realtime port/interface for connect/disconnect, room-scoped publish/subscribe or equivalent semantic operations;
- no-op or in-memory development adapter sufficient for wiring tests;
- adapter selected explicitly through validated configuration;
- lifecycle start/stop hooks;
- clear separation between transport identity and authenticated application actor identity.

### Out of scope

- Game Engine;
- room membership rules;
- PlayHTML production implementation;
- presence, snapshots or game events;
- client claims treated as authorization.

### Acceptance

- adapter skeleton compiles and is injectable;
- application starts with the documented W0 adapter;
- unsupported adapter selection fails clearly;
- adapter contains no game or account business decisions.

## Agent B verification

Agent B must report actual commands and results for:

```text
server typecheck
server build
server integration test
Prisma validate/generate
migration check when DATABASE_URL is available
```

## Agent B handoff

- exact health request/response contract to Agents A and C;
- public error schema export to contracts;
- environment-variable names and startup commands to coordinator;
- DB/realtime degraded-state behavior and known limitations.

---

# 9. AGENT C PLAN — C00 THROUGH C02

## C00 — Test structure

### Objective

Create a deterministic test foundation that can grow into contract, integration, E2E and load suites.

### In scope

- Vitest workspace/configuration;
- test directories matching the project architecture;
- one pure unit smoke test against a shared package;
- one server integration test for health;
- stable test setup/cleanup helpers;
- test naming and timeout conventions.

### Out of scope

- fake game-rule tests before W1;
- fake authentication or match E2E;
- tests that require manual interaction;
- passing tests that merely assert `true` without a boundary under test.

## C01 — CI commands

### Objective

Make the deterministic W0 checks runnable in CI from a clean checkout.

### In scope

- GitHub Actions workflow;
- dependency installation with lockfile enforcement;
- typecheck, build and deterministic tests;
- Prisma validate/generate without embedding secrets;
- cache only where it does not obscure correctness;
- clear failure output.

Database-backed migration execution may use a CI PostgreSQL service if adopted by the coordinator; otherwise migration execution is documented and Prisma validation remains mandatory in the base workflow.

## C02 — Multi-client harness skeleton

### Objective

Provide test utilities for future two-player/realtime scenarios without implementing unfinished domain behavior.

### In scope

- logical client identity isolated per instance;
- independent cookie/header/event state containers;
- create/dispose lifecycle;
- ability to issue HTTP requests to an injected server origin/instance;
- event inbox/transport seam suitable for a future realtime adapter;
- smoke test proving two clients do not share local state.

### Out of scope

- matchmaking;
- room join;
- PIECE_MOVE;
- reconnect semantics;
- real PlayHTML dependency.

### Acceptance

- two harness clients can be created concurrently;
- state written to one test client is not visible to the other;
- all resources are disposed after tests;
- harness consumes shared contracts where applicable;
- no W1+ business behavior is invented.

## Agent C verification

Agent C must report actual commands and results for:

```text
unit tests
integration tests
full deterministic W0 suite
CI-equivalent command
```

## Agent C handoff

- test utility API to later game/network phases;
- CI assumptions and any service dependencies;
- evidence that unit and integration layers both execute.

---

# 10. CROSS-LANE CONTRACTS

Before W0 integration, these minimal contracts must agree:

| Contract | Producer | Consumers |
|---|---|---|
| Protocol version constant | Agent B/contracts | Web, server, tests |
| Public error envelope | Agent B/contracts | Web, server, tests |
| Health response schema | Agent B/contracts | Web, server integration tests |
| API base URL environment name | Coordinator/A | Web documentation |
| Server origin/CORS setting | B | Web and E2E harness |
| Realtime port lifecycle | B | Future server modules and C harness seam |

W0 must not define room, match, piece-move or social messages early merely to populate the contracts package.

---

# 11. INTEGRATION AND VERIFICATION ORDER

The coordinator performs these checks after all lanes report completion:

1. Inspect all changed files and confirm ownership boundaries.
2. Install dependencies using the locked package manager and lockfile.
3. Run formatting/lint checks if configured.
4. Run workspace typecheck.
5. Run workspace build.
6. Run unit tests.
7. Run server integration tests.
8. Run the multi-client isolation smoke test.
9. Run Prisma validate and client generation.
10. Run the initial migration against a disposable configured PostgreSQL instance when available.
11. Start server and verify `GET /health`.
12. Start web and verify loading/success/failure health presentation.
13. Confirm README and `.env.example` are sufficient for a clean start.
14. Record limitations and decide PASS/FAIL for the W0 gate.

---

# 12. W0 DEFINITION OF DONE

```text
[x] Repository installs from a clean checkout with a present lockfile
[x] Web starts and builds
[x] Server starts and builds
[x] Web can call the health endpoint through configuration
[x] Shared contracts import from web, server and tests
[x] Health reports application, DB and realtime states separately
[x] Public errors are sanitized
[x] Prisma validate and generate pass
[x] Initial migration workflow is documented and verified against local PostgreSQL
[x] Realtime port/adapter skeleton compiles and owns no domain authority
[x] At least one meaningful unit test passes
[x] At least one meaningful server integration test passes
[x] Two logical harness clients have isolated state
[x] CI runs deterministic W0 checks
[x] No secrets are committed
[x] README contains exact local commands and environment names
[x] No W1+ product behavior was prematurely invented
```

W0 is **FAIL** if the code only starts on the original machine, if tests rely on undocumented manual setup, or if web/server/tests use incompatible duplicated contract definitions.

---

# 13. RISKS AND CONTROLS

| Risk | Control |
|---|---|
| Agents modify the same root files | Coordinator owns root integration |
| Tooling setup consumes the entire day | Keep W0 skeleton minimal; defer polish |
| Database unavailable locally | Validate/generate first; clearly record migration as blocked rather than fake success |
| Premature protocol design | Limit contracts to health/error/version in W0 |
| Realtime skeleton becomes authority | Enforce port/adapter boundary and no domain logic |
| CI requires unavailable secrets | Base CI checks must not require production secrets |
| Placeholder tests give false confidence | Each smoke test must cross a real package/server boundary |
| Tailwind/plugin version mismatch | Pin compatible versions in the lockfile and verify production build |

---

# 14. AGENT DISPATCH PROMPTS

## Agent A

Implement only A00–A01 from this plan. Own `apps/web/**`. Do not change root workspace files, server, Prisma or tests unless the coordinator explicitly reassigns ownership. Consume shared contracts as published. Run and report web typecheck/build/tests. Stop and report any shared-contract conflict instead of inventing an incompatible local type.

## Agent B

Implement only B00–B03 from this plan. Own `apps/server/**` and `prisma/**`; propose the minimal health/error/version contents for `packages/contracts/**` and coordinate before overwriting shared files. Do not implement W1+ domain behavior. Run and report server checks and Prisma checks. Preserve backend authority and keep realtime as an adapter boundary.

## Agent C

Implement only C00–C02 from this plan. Own `packages/test-utils/**`, `tests/**` and `.github/workflows/**`. Consume Agent B's published health/error contract; do not invent room/game APIs. Build meaningful unit, health-integration and two-client-isolation tests. Run and report the CI-equivalent deterministic suite.

---

# 15. APPROVAL GATE

Implementation begins only after the Leader approves:

- the locked W0 technology baseline;
- the repository target structure;
- ownership of shared root files;
- the health/error minimal contract boundary;
- the W0 Definition of Done.

After approval, the coordinator creates the root foundation, dispatches Agents A/B/C, integrates their outputs and returns a single W0 verification report.

---

# 16. W0 EXECUTION RESULT

Implementation completed in the shared workspace. The three lanes were executed by coordinated subagents and integrated by the Leader/coordinator.

## Verified commands

```text
corepack pnpm install
corepack pnpm db:generate                 PASS (Prisma Client 6.19.3)
corepack pnpm exec prisma validate ...    PASS
corepack pnpm typecheck                   PASS
corepack pnpm build                       PASS
corepack pnpm lint                        PASS
corepack pnpm test                        PASS (5 tests)
corepack pnpm --filter @ottv2/server test PASS (7 tests)
corepack pnpm --filter @ottv2/web test    PASS (4 tests)
corepack pnpm -r --if-present test         PASS (11 package tests)
corepack pnpm db:deploy                    PASS (fresh local PostgreSQL database)
corepack pnpm db:status                    PASS (schema up to date)
```

The live server smoke check returned HTTP 200 from `GET /health`. With the local database configured, the response reported `application=ok`, `database=ok` (with measured latency), and `realtime=degraded/not_configured` because the W0 PlayHTML adapter is intentionally disabled.

The Vite development server also started successfully and returned HTTP 200 for the Vietnamese web shell at `http://localhost:8000/`.

## W0 gate

```text
W0 CODE / TYPECHECK / BUILD / LINT       = PASS
W0 UNIT + INTEGRATION TESTS              = PASS
W0 WEB ↔ SERVER HEALTH CONTRACT          = PASS
W0 MULTI-CLIENT ISOLATION SKELETON       = PASS
W0 PRISMA VALIDATE + CLIENT GENERATION   = PASS
W0 FRESH POSTGRES MIGRATION DEPLOY       = PASS
W0 PUBLIC DEPLOYMENT                     = OUT OF SCOPE FOR W0
```

The migration workflow was executed from an empty local PostgreSQL 17.7-compatible database (`ottv2_dev`) and is now up to date. The database role is local-only and its password is stored only in the ignored root `.env`. The PostgreSQL client tools are available on the user PATH.

## W0 handoff

The repository is ready to begin W1 Game Rule Engine. The next phase must preserve the existing shared contract, app factory, test harness and package boundaries. No W1 game behavior was added to the W0 skeleton.
