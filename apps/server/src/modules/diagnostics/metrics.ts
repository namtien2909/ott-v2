import { performance } from "node:perf_hooks";
import type { MetricRoute, MetricsSnapshot } from "@ottv2/contracts";

type Sample = { durationMs: number; statusCode: number };

const MAX_SAMPLES_PER_ROUTE = 200;

function percentile(samples: readonly Sample[], fraction: number): number {
  if (samples.length === 0) return 0;
  const sorted = samples.map((sample) => sample.durationMs).sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))] ?? 0;
}

export class MetricsRegistry {
  private readonly startedAt = Date.now();
  private readonly routes = new Map<string, Sample[]>();
  private requests = 0;
  private errors = 0;
  private activeStreams = 0;
  private fanoutEvents = 0;

  observeHttp(method: string, path: string, statusCode: number, durationMs: number): void {
    this.requests += 1;
    if (statusCode >= 400) this.errors += 1;
    const key = `${method.toUpperCase()} ${path}`;
    const samples = this.routes.get(key) ?? [];
    samples.push({ durationMs: Math.max(0, durationMs), statusCode });
    if (samples.length > MAX_SAMPLES_PER_ROUTE) samples.splice(0, samples.length - MAX_SAMPLES_PER_ROUTE);
    this.routes.set(key, samples);
  }

  streamOpened(): void { this.activeStreams += 1; }
  streamClosed(): void { this.activeStreams = Math.max(0, this.activeStreams - 1); }
  recordFanout(eventCount = 1): void { this.fanoutEvents += Math.max(0, Math.round(eventCount)); }

  snapshot(): MetricsSnapshot {
    const routes: MetricRoute[] = [...this.routes.entries()].map(([key, samples]) => {
      const [method, ...pathParts] = key.split(" ");
      const averageMs = samples.length === 0 ? 0 : samples.reduce((sum, sample) => sum + sample.durationMs, 0) / samples.length;
      return { method: method ?? "UNKNOWN", path: pathParts.join(" ") || "/", count: samples.length, errorCount: samples.filter((sample) => sample.statusCode >= 400).length, averageMs: Number(averageMs.toFixed(2)), p95Ms: Number(percentile(samples, 0.95).toFixed(2)) };
    }).sort((left, right) => `${left.method} ${left.path}`.localeCompare(`${right.method} ${right.path}`));
    return { uptimeSeconds: Math.max(0, (Date.now() - this.startedAt) / 1000), requestCount: this.requests, errorCount: this.errors, activeStreams: this.activeStreams, fanoutEvents: this.fanoutEvents, routes };
  }
}
