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
});
