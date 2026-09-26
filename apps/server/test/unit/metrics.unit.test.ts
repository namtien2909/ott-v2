import { describe, expect, it } from "vitest";
import { MetricsRegistry } from "../../src/modules/diagnostics/metrics.js";

describe("W11 MetricsRegistry", () => {
  it("keeps bounded request latency/error and stream/fan-out diagnostics", () => {
    const metrics = new MetricsRegistry();
    metrics.observeHttp("GET", "/health", 200, 4);
    metrics.observeHttp("GET", "/health", 503, 18);
    metrics.streamOpened();
    metrics.recordFanout(5);
    const snapshot = metrics.snapshot();
    expect(snapshot.requestCount).toBe(2);
    expect(snapshot.errorCount).toBe(1);
    expect(snapshot.activeStreams).toBe(1);
    expect(snapshot.fanoutEvents).toBe(5);
    expect(snapshot.routes).toEqual([expect.objectContaining({ method: "GET", path: "/health", count: 2, errorCount: 1, p95Ms: 4 })]);
    metrics.streamClosed();
    expect(metrics.snapshot().activeStreams).toBe(0);
  });
});
