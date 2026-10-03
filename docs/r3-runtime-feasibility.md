# R3 runtime feasibility record

Date: 2026-10-02 (local execution; final probes recorded in `r3-runtime-evidence.json`)

## Decision

The R3 free-only runtime work is **PROVEN FOR THE PINNED COMPATIBILITY FIXTURES**. The SDK/limit protocol and both runtime probes pass, including actual ABI/output/watchdog fixtures inside the cross-origin Offline compartment, independent per-turn Wasmtime timeout/reset checks, and a local four-guest Fastify-under-load capacity simulation. Independent fixture review passes; the aggregate Wave remains blocked only on provider free-class hardware/scheduler/restart evidence that cannot be inferred from local simulation. This is not production Bot readiness.

- Online candidate: Wasmtime 49.0.2 supervising CPython-WASI 3.14.7 (pre-execution hash pin, readonly ACL preopen, outside sentinel, whole-match, independent per-turn timeout/fuel reset, single-admission and API-under-four-guest-load fixtures pass).
- Offline candidate: self-hosted Pyodide 0.27.3 in a module Web Worker inside a sandboxed, distinct-origin (`localhost` versus the app's `127.0.0.1`) iframe with a narrow JSON bridge. ABI, deterministic output, output cap and compute watchdog run in that compartment (credential/DOM boundary is measured; browser resource limits are still weaker than server-side Wasmtime).

The probes execute fixed compatibility/security fixtures only. `playerCodeExecuted:false` is recorded in every report. This is feasibility evidence for later R9/R10/R11 integration, not production Bot readiness: no player upload, server scheduler, match commit, restart recovery, public replay/audit or user-facing Bot mode was enabled in R3.

## Candidates and evidence

| Surface | Candidate | Evidence | Boundary |
|---|---|---|---|
| Online | Trusted Node scheduler → separate Wasmtime supervisor → CPython-WASI guest | `PROVEN_FOR_WASMTIME_CPYTHON_WASI_PROBE`; pre-execution hash, ABI/environment, readonly preopen + outside sentinel, path traversal, network, CPU/sleep/memory/output, cancellation/reclaim, deterministic seeds, 12-run headroom, 120 fixture turns and single-admission checks pass | Fixture evidence uses a trusted supervisor and a disposable ACL-protected runtime directory; production scheduler/API/commit remains later scope |
| Offline | Pyodide in a sandboxed distinct-origin iframe + capability-denied module Web Worker | `PROVEN_FOR_PYODIDE_MODULE_WORKER_PROBE`: warm ABI, offline cold reload, deterministic seed, output budget, watchdog, renderer/storage/network denial, Python bridge import guard and cross-origin parent-DOM/cookie boundary | Browser resource limits remain softer than server-side Wasmtime; full shell/lazy-route/font/template cache and production worker lifecycle remain R11 scope |

Exact artifact versions, licenses, archive hashes and checked-in Pyodide asset hashes are in [`r3-runtime-artifacts.json`](./r3-runtime-artifacts.json). Attribution and packaging boundaries are in [`r3-runtime-notices.md`](./r3-runtime-notices.md). Exact metrics and commands are in [`r3-runtime-evidence.json`](./r3-runtime-evidence.json).

## Security boundary

The adapter contract in `packages/bot-sdk/src/runtime.ts` accepts only an explicitly isolated profile with an isolated parser. It rejects unknown isolation values, static-only parsers, missing/non-`false` network/filesystem/secrets/application-mount flags, and has no implementation that runs Python in the Node application process or an unrestricted native subprocess. The source lexer is deliberately labelled `STATIC_ONLY`; even a test adapter is reported as `TEST_ADAPTER_ONLY` and can never advertise production Ready.

The online harness is fail-closed before process start and accepts only the exact pinned artifact hashes. The latest run re-verified the archive/extracted binary and passed allowlisted environment, readonly preopen bound to the supplied outside sentinel, path traversal, network, cancellation, reclaim, 12-run startup headroom, two consecutive per-turn timeout/fuel failures followed by a successful reset turn, SDK-shaped `choose_move`/state/memory calls for 60 rounds per side and single-admission fixtures. A local capacity harness ran four pinned Wasmtime fixtures outside Fastify while 24 sequential and four concurrent `/health` requests remained 200 (p95 1 ms/max 41 ms). The disposable Fastify `/health` probe also passed 12 sequential and two concurrent requests under a 512 MiB Node heap cap. None of these fixtures claims a production server scheduler, durable restart policy, Render capacity or free-provider CPU quota.

The offline probe loads only self-hosted, pinned assets. After runtime bootstrap, the Worker denies `fetch`, IndexedDB, Cache Storage, cookie storage, WebSocket/XHR and renderer globals, rejects `js`, `pyodide_js`, `pyodide` and `builtins` imports, verifies that no original-import alias is left in the fixture globals, and runs ABI, deterministic output, output-budget and compute-watchdog fixtures in a distinct-origin sandboxed iframe that cannot read the parent DOM or cookie. The SDK validator applies NFKC normalization before its static denylist so compatibility-spelled reflection names cannot bypass that gate. A network-disabled browser reload reports zero runtime-asset requests. This remains a measured defense-in-depth boundary—not permission to expose private source, memory or logs—and production must keep the cross-origin compartment rather than falling back to a same-origin worker.

## Frozen protocol limits

The exact equal-budget preset is recorded in [`r3-bot-limit-manifest.json`](./r3-bot-limit-manifest.json) and exported as `DEFAULT_BOT_LIMITS`. The current measured preset is:

- source/upload: 64 KiB; output: 16 KiB including memory; memory: 8 KiB, depth 32;
- per-turn: 500 ms and 300,000,000 Wasm fuel; CPython-WASI bootstrap allowance: 2,000,000,000 fuel (bootstrap only, never player-turn budget); Wasm memory: 1,024 pages (64 MiB, including the CPython-WASI runtime);
- whole match: 30,000 ms active compute, 120 plies / 60 rounds;
- no network, secrets or application mounts; deterministic seed; one initial admitted Bot match.

These values are protocol inputs for later Waves. The latest online run measured 12-run startup p95 208 ms, a bounded Blue/Red SDK-shaped 120-turn fixture in 432 ms, and a loopback supervisor HTTP p95 of 281 ms with single-admission 200/429 behavior. A local capacity simulation measured four pinned Wasmtime guests (max 495 ms) while Fastify `/health` remained 200 (24-request p95 1 ms/max 41 ms; four concurrent 200). The disposable Fastify application `/health` probe measured p95 33 ms under a 512 MiB Node heap cap. These are fixture/runtime headroom, not proof of a provider's CPU quota, Render capacity or production scheduler. Host free memory is volatile and is not a capacity guarantee.

The scorer is canonical-rule based:

- `N`: remaining own pieces;
- `P`: `8 - min(Chebyshev distance to the side's enemy goal)`;
- `M`: distinct legal `(from,to)` pairs with that side to move;
- lexicographic `N/P/M`, with published RED priority only for an exact tie.

## Harness and test evidence

The R3 harness remains fail-closed: no adapter means `NOT_PROVEN`/`RuntimeNotProvenError`; test adapters are never advertised as production Ready; invalid source never reaches an adapter; cancellation and late-result fencing are fail-closed; legal moves, output/memory bytes, depth, non-finite values and cycles are checked. Focused SDK/scorer/runtime tests and the full safe workspace gates are recorded in the Wave report.

## Free-only boundary

No paid service, billing, trial credit, deployment or database migration was used. Render Free may sleep/restart and has ephemeral disk; it is not evidence of durable Bot execution or an always-on supervisor. Durable database/provider selection, quotas, backup/restore and production admission remain separately approved work.

## Sources

- [Wasmtime security](https://docs.wasmtime.dev/security.html) and [interrupting Wasm](https://docs.wasmtime.dev/examples-interrupting-wasm.html)
- [CPython WASI build](https://github.com/brettcannon/cpython-wasi-build)
- [Pyodide web worker](https://pyodide.org/en/stable/usage/webworker.html) and [self-hosted deployment](https://pyodide.org/en/stable/usage/downloading-and-deploying.html)
- [Render free-instance limitations](https://render.com/docs/free)
