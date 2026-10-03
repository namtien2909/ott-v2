import { describe, expect, it } from "vitest";
import { R3ProviderResponseSchema } from "@ottv2/contracts";

describe("provider failure report", () => {
  it("preserves NOT_PROVEN while stripping raw process output and secrets", () => {
    const report = R3ProviderResponseSchema.parse({
      schemaVersion: 1, status: "NOT_PROVEN", runtimeGate: "NOT_PROVEN",
      measuredAt: "2026-10-03T00:00:00.000Z", playerCodeExecuted: false, fixtureCodeExecuted: false,
      reason: "Provider probe failed closed; no player code was executed.", stage: "parse-wasmtime-security-probe",
      failedChecks: ["abi"], rawOutput: "private-path-or-secret",
      startup: { cause: "HOST_STARTUP_TIMEOUT", code: null, signal: "SIGTERM", elapsedMs: 2000, hostTimedOut: true, stderr: "private-path-or-secret" }
    });
    expect(report.status).toBe("NOT_PROVEN");
    expect(JSON.stringify(report)).not.toContain("private-path-or-secret");
  });

  it("accepts sanitized provider process-abort diagnostics", () => {
    const report = R3ProviderResponseSchema.parse({
      schemaVersion: 1, status: "NOT_PROVEN", runtimeGate: "NOT_PROVEN",
      measuredAt: "2026-10-03T00:00:00.000Z", playerCodeExecuted: false, fixtureCodeExecuted: false,
      reason: "Provider probe failed closed; no player code was executed.", stage: "parse-wasmtime-security-probe",
      failedChecks: ["abi"], startup: { cause: "HOST_PROCESS_ABORTED", code: 134, signal: null, elapsedMs: 176, hostTimedOut: false }
    });
    expect(report.startup?.cause).toBe("HOST_PROCESS_ABORTED");
  });

  it("accepts safe failed-check measurements without raw guest output", () => {
    const report = R3ProviderResponseSchema.parse({
      schemaVersion: 1, status: "NOT_PROVEN", runtimeGate: "NOT_PROVEN",
      measuredAt: "2026-10-03T00:00:00.000Z", playerCodeExecuted: false, fixtureCodeExecuted: false,
      reason: "Provider probe failed closed; no player code was executed.", stage: "parse-wasmtime-security-probe",
      failedChecks: ["determinism"], checks: { determinism: { pass: false, sameSeedSameState: false, differentSeedChangesResult: true } }
    });
    expect(report.checks?.determinism?.sameSeedSameState).toBe(false);
    expect(JSON.stringify(report)).not.toContain("source");
  });

  it("accepts safe admission scheduler evidence", () => {
    const report = R3ProviderResponseSchema.parse({
      schemaVersion: 1, status: "NOT_PROVEN", runtimeGate: "NOT_PROVEN",
      measuredAt: "2026-10-03T00:00:00.000Z", playerCodeExecuted: false, fixtureCodeExecuted: false,
      reason: "Provider probe failed closed; no player code was executed.", stage: "write-provider-evidence",
      failedChecks: ["admission"], scheduler: { pass: false, requested: 4, completed: 4, maxConcurrent: 1,
        results: [{ id: 0, code: 134, elapsedMs: 170, validOutput: false }, { id: 1, code: 134, elapsedMs: 170, validOutput: false }, { id: 2, code: 134, elapsedMs: 170, validOutput: false }, { id: 3, code: 134, elapsedMs: 170, validOutput: false }] }
    });
    expect(report.scheduler?.maxConcurrent).toBe(1);
  });
});
