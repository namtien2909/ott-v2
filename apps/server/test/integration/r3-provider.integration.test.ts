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

function database(): DatabasePort {
  return { check: async () => 1, close: async () => {} };
}

describe("GET /diagnostics/r3/provider", () => {
  it("fails closed without exposing a path when no provider report is present", async () => {
    const app = await buildApp({ env, database: database(), realtime: new DisabledRealtimeAdapter() });
    const response = await app.inject({ method: "GET", url: "/diagnostics/r3/provider" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      schemaVersion: 1,
      status: "NOT_PROVEN",
      runtimeGate: "NOT_PROVEN",
      reason: "Provider runtime evidence is not available."
    });
    expect(response.body).not.toContain("r3-provider-evidence.json");
    await app.close();
  });
});
