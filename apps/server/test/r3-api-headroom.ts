import { performance } from "node:perf_hooks";

import { HealthResponseSchema } from "@ottv2/contracts";

import { buildApp } from "../src/app.js";
import type { AppEnv } from "../src/config/env.js";
import type { DatabasePort } from "../src/plugins/prisma.js";
import { DisabledRealtimeAdapter } from "../src/realtime/disabled.adapter.js";

const env: AppEnv = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 0,
  LOG_LEVEL: "silent",
  DATABASE_URL: "postgresql://r3-headroom-disposable.invalid/ottv2_test",
  CORS_ORIGINS: "http://localhost:3000",
  REALTIME_ADAPTER: "disabled",
  corsOrigins: ["http://localhost:3000"],
};

const database: DatabasePort = { check: async () => 1, close: async () => {} };
const percentile = (values: number[], p: number): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] ?? null;
};

const app = await buildApp({ env, database, realtime: new DisabledRealtimeAdapter() });
const sequential: Array<{ statusCode: number; elapsedMs: number }> = [];
try {
  await app.ready();
  for (let index = 0; index < 12; index += 1) {
    const startedAt = performance.now();
    const response = await app.inject({ method: "GET", url: "/health" });
    HealthResponseSchema.parse(response.json());
    sequential.push({ statusCode: response.statusCode, elapsedMs: Math.round(performance.now() - startedAt) });
  }
  const concurrentStartedAt = performance.now();
  const concurrentResponses = await Promise.all([
    app.inject({ method: "GET", url: "/health" }),
    app.inject({ method: "GET", url: "/health" }),
  ]);
  const concurrentElapsedMs = Math.round(performance.now() - concurrentStartedAt);
  const times = sequential.map((run) => run.elapsedMs);
  console.log(JSON.stringify({
    measuredAt: new Date().toISOString(),
    fixtureCodeExecuted: false,
    playerCodeExecuted: false,
    databaseMutated: false,
    route: "GET /health",
    runtime: { node: process.version, platform: process.platform, arch: process.arch, nodeOptions: process.env.NODE_OPTIONS ?? null },
    checks: {
      sequential: { pass: sequential.length === 12 && sequential.every((run) => run.statusCode === 200), requests: sequential.length, p95Ms: percentile(times, 0.95), maxMs: Math.max(...times) },
      concurrent: { pass: concurrentResponses.every((response) => response.statusCode === 200), statuses: concurrentResponses.map((response) => response.statusCode), elapsedMs: concurrentElapsedMs },
    },
  }, null, 2));
} finally {
  await app.close();
}
