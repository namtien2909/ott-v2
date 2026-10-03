import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

import { HealthResponseSchema } from "@ottv2/contracts";

import { buildApp } from "../src/app.js";
import type { AppEnv } from "../src/config/env.js";
import type { DatabasePort } from "../src/plugins/prisma.js";
import { DisabledRealtimeAdapter } from "../src/realtime/disabled.adapter.js";

/**
 * Local free-class capacity harness. The guest is a fixed compatibility
 * fixture, never player source; it runs in the pinned Wasmtime supervisor
 * process while Fastify serves health requests. This does not claim Render
 * deployment capacity or production scheduler readiness.
 */
const wasmtimePath = process.env.R3_WASMTIME_PATH;
const cpythonDir = process.env.R3_CPYTHON_WASI_DIR;
const expectedWasmtimeSha = "51165ae46e2e4ca71b52efff33432d9e58db41bf236cb7c768adb03f653a7152";
const expectedCpythonSha = "d24bd98d3071af6b17d51d53a08700b9acef59172a0afcb6adb733645c2a1715";
const env: AppEnv = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 0,
  LOG_LEVEL: "silent",
  DATABASE_URL: "postgresql://r3-capacity-disposable.invalid/ottv2_test",
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

const digest = async (path: string): Promise<string> => createHash("sha256").update(await readFile(path)).digest("hex");

const runGuest = (): Promise<{ code: number | null; elapsedMs: number }> => new Promise((resolve) => {
  const startedAt = performance.now();
  const source = "import json, time\nstate = {'turn': 'BLUE', 'legalMoves': [{'from': 'a1', 'to': 'b2'}]}\nfor _ in range(8):\n    time.sleep(0.01)\nprint(json.dumps({'move': state['legalMoves'][0], 'memory': {'seen': 1}}, separators=(',', ':')))";
  const child = spawn(wasmtimePath!, [
    "run",
    "--dir", ".::/",
    "-W", "fuel=300000000",
    "-W", "timeout=500ms",
    "--env", "PYTHONHASHSEED=0",
    "--env", "TZ=UTC",
    "python.wasm",
    "-c",
    source,
  ], { cwd: cpythonDir, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout?.resume();
  child.stderr.resume();
  child.once("close", (code) => resolve({ code, elapsedMs: Math.round(performance.now() - startedAt) }));
});

if (!wasmtimePath || !cpythonDir) {
  console.error("R3 capacity harness requires R3_WASMTIME_PATH and R3_CPYTHON_WASI_DIR; status NOT_RUN");
  process.exitCode = 2;
} else {
  const app = await buildApp({ env, database, realtime: new DisabledRealtimeAdapter() });
  try {
    await app.ready();
    const wasmtimeHash = await digest(wasmtimePath);
    const cpythonHash = await digest(`${cpythonDir}/python.wasm`);
    const guestRuns = await Promise.all(Array.from({ length: 4 }, () => runGuest()));
    const requestTimes: number[] = [];
    const statuses: number[] = [];
    for (let index = 0; index < 24; index += 1) {
      const startedAt = performance.now();
      const response = await app.inject({ method: "GET", url: "/health" });
      HealthResponseSchema.parse(response.json());
      statuses.push(response.statusCode);
      requestTimes.push(Math.round(performance.now() - startedAt));
    }
    const concurrentStartedAt = performance.now();
    const concurrent = await Promise.all(Array.from({ length: 4 }, () => app.inject({ method: "GET", url: "/health" })));
    const concurrentElapsedMs = Math.round(performance.now() - concurrentStartedAt);
    const allPassed = wasmtimeHash === expectedWasmtimeSha
      && cpythonHash === expectedCpythonSha
      && guestRuns.every((run) => run.code === 0)
      && statuses.every((status) => status === 200)
      && concurrent.every((response) => response.statusCode === 200);
    console.log(JSON.stringify({
      measuredAt: new Date().toISOString(),
      fixtureCodeExecuted: true,
      playerCodeExecuted: false,
      databaseMutated: false,
      freeClassSimulation: true,
      productionDeployment: false,
      runtime: { wasmtimeHash, cpythonHash, guestCount: guestRuns.length, guestRuns },
      checks: {
        pinnedRuntime: { pass: wasmtimeHash === expectedWasmtimeSha && cpythonHash === expectedCpythonSha },
        botLoad: { pass: guestRuns.every((run) => run.code === 0), count: guestRuns.length, maxMs: Math.max(...guestRuns.map((run) => run.elapsedMs)) },
        apiUnderBotLoad: { pass: statuses.every((status) => status === 200) && concurrent.every((response) => response.statusCode === 200), requests: statuses.length, p95Ms: percentile(requestTimes, 0.95), maxMs: Math.max(...requestTimes), concurrentStatuses: concurrent.map((response) => response.statusCode), concurrentElapsedMs },
      },
      allPass: allPassed,
    }, null, 2));
    if (!allPassed) process.exitCode = 1;
  } finally {
    await app.close();
  }
}
