import { HealthResponseSchema } from "@ottv2/contracts";
import { describe, expect, it } from "vitest";

import { buildApp } from "../../src/app.js";
import type { AppEnv } from "../../src/config/env.js";
import type { DatabasePort } from "../../src/plugins/prisma.js";
import { DisabledRealtimeAdapter } from "../../src/realtime/disabled.adapter.js";

const env: AppEnv = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 3001,
  LOG_LEVEL: "silent",
  DATABASE_URL: "postgresql://user:password@localhost:5432/ottv2_test",
  CORS_ORIGINS: "http://localhost:5173",
  REALTIME_ADAPTER: "disabled",
  corsOrigins: ["http://localhost:5173"]
};

function database(check: DatabasePort["check"]): DatabasePort {
  return { check, close: async () => {} };
}

describe("GET /health", () => {
  it("returns a shared-contract response without a TCP listener", async () => {
    const app = await buildApp({ env, database: database(async () => 3), realtime: new DisabledRealtimeAdapter() });
    const response = await app.inject({ method: "GET", url: "/health" });
    const health = HealthResponseSchema.parse(response.json());
    expect(response.statusCode).toBe(200);
    expect(health.components.database).toEqual({ status: "ok", latencyMs: 3 });
    expect(health.components.realtime.status).toBe("degraded");
    await app.close();
  });

  it("sanitizes database failures into a degraded component", async () => {
    const marker = "postgresql://private-credential";
    const app = await buildApp({ env, database: database(async () => { throw new Error(marker); }), realtime: new DisabledRealtimeAdapter() });
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain(marker);
    expect(response.json().components.database).toEqual({ status: "degraded", reason: "unreachable" });
    await app.close();
  });

  it("uses the public envelope for unknown routes", async () => {
    const app = await buildApp({ env, database: database(async () => 1), realtime: new DisabledRealtimeAdapter() });
    const response = await app.inject({ method: "GET", url: "/missing" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: "NOT_FOUND", retryable: false, severity: "INVALID", details: {} });
    await app.close();
  });
});
