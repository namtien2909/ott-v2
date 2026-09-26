import { describe, expect, it } from "vitest";
import { MetricsSnapshotSchema } from "@ottv2/contracts";

describe("metrics contract", () => {
  it("accepts diagnostic route and stream counters", () => {
    expect(MetricsSnapshotSchema.safeParse({ uptimeSeconds: 1.2, requestCount: 3, errorCount: 1, activeStreams: 2, fanoutEvents: 4, routes: [{ method: "GET", path: "/health", count: 3, errorCount: 1, averageMs: 4.5, p95Ms: 8 }] }).success).toBe(true);
  });
});
