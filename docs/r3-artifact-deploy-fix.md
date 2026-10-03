# R3 — Render artifact hash correction

## Root cause

The Wasmtime Linux archive SHA-256 in the manifest contained 63 characters. It omitted the final `2`. The duplicated literal in the provider probe repeated that mistake. Render downloaded the correct artifact; previous cache-related explanations were unsupported and incorrect.

Correct archive digest:

`a4d6e9e3a5a60f527cf7793d674c48930c80c2e8977995b8a275cad3254b9322`

## Fix and regression evidence

- Correct the manifest and derive the provider pins from that single source.
- Reject malformed SHA-256 pins before downloading.
- Regression tests: 2 FAIL before correction, 2 PASS afterward. Run in the server build before the provider probe.
- Run the actual provider download/extraction/hash pipeline with `node scripts/r3-render-provider-probe.mjs --verify-artifacts-only`: PASS on Windows local, 2026-10-03. This mode executes no runtime or Python.
- Both release archives and extracted runtime binaries match their pins:
  - Wasmtime archive: `a4d6e9e3a5a60f527cf7793d674c48930c80c2e8977995b8a275cad3254b9322`
  - Wasmtime binary: `d0a014e0d5b0cf48dd3549c38e2e6ecd78ff09fb3e3f10d751b87b72bdfd8635`
  - CPython archive: `2e064d3fb8172471d39d741348efa722349c40b96301f69968dff714999c584b`
  - CPython WASM: `d24bd98d3071af6b17d51d53a08700b9acef59172a0afcb6adb733645c2a1715`
- Fix subprocess output capture so a complete JSON report is retained within the bounded buffer.
- A provider runtime failure now reports only failing check names, allowing diagnosis without raw runtime output or private payloads.

## Scope of evidence

This proves the artifact preparation defect is fixed locally. Render runtime checks and final deployment acceptance require actual provider evidence; that evidence is now recorded in `docs/r3-render-provider-evidence.json`. R3 feasibility is DONE. A build-stage probe alone would not measure the resources of the running Render Free service.

## Provider runtime follow-up

After the hash correction, Render passed artifact validation and reached the security probe. Most fixtures failed, including ABI. The log did not include startup errors, so it does not establish whether the failure is a loader problem, host compilation/startup timeout or a guest issue.

- Check `wasmtime --version` before fixture invocation.
- Limit the compiler host thread pool to one with `RAYON_NUM_THREADS=1`; this does not add that variable to the guest WASI environment.
- Record sanitized ABI startup cause, exit code, signal and host-timeout status. Print each failed check separately.
- Normal build records `NOT_PROVEN` for a failed provider feasibility probe and may deploy the existing API/SPA. Player Python remains disabled; R3 is marked DONE only after the public provider report returns `PROVEN`.
- `corepack pnpm --filter @ottv2/server probe:r3:provider` requires PASS and exits nonzero on failure.
- `/diagnostics/r3/provider` returns HTTP 503 for the recorded failure, with sanitized startup details, and HTTP 200 only for a proven report.
- Local validation: four Node regression tests and 81 server tests PASS; contracts/server build PASS. These are not provider execution evidence.

## 2026-10-03 provider follow-up

- Commits `2e851eb`, `8562528`, `302db1e`, `206b1ff`, `dfe2e63`, `659db98`, `8b8d971`, `25faa18`, `8e78f5f` and `c58c7e5` keep the API/SPA deploy fail-closed while improving provider diagnostics.
- The Render probe exposed a Wasmtime/CPython bootstrap fuel failure. The manifest now separates `wasmStartupFuel` (`2,000,000,000`, bootstrap only) from the equal Bot turn budget (`wasmFuel=300,000,000`); the `500ms` per-turn watchdog remains unchanged.
- Public Render evidence later showed all security, quota, headroom, whole-match and determinism checks passing before the final report write; the remaining public report was from an older revision and is not evidence for `c58c7e5`.
- Local evidence after the fixes: 84 server tests PASS, contracts/SDK typecheck PASS, probe syntax PASS, artifact pin tests PASS. No player source was executed.
- R3 feasibility is now `DONE` from the schema-valid public `PROVEN` report measured at `2026-10-03T05:27:49.185Z`. R4/R9/R10/R11 still own production lifecycle, commit and restart integration; do not infer those later gates from this fixture evidence.
