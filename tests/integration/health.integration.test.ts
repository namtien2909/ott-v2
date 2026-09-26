import { HealthResponseSchema, PROTOCOL_VERSION } from "@ottv2/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import type { BuildAppOptions } from "../../apps/server/src/app.js";

describe("GET /health", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("returns a response that satisfies the shared health contract", async () => {
    const { buildApp } = await import("../../apps/server/src/app.js");
    let databaseClosed = false;
    let realtimeStarted = false;
    let realtimeStopped = false;

    const env: NonNullable<BuildAppOptions["env"]> = {
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      PORT: 3001,
      LOG_LEVEL: "silent",
      DATABASE_URL: "postgresql://unused:unused@127.0.0.1:5432/unused",
      CORS_ORIGINS: "http://localhost:5173",
      REALTIME_ADAPTER: "disabled",
      corsOrigins: ["http://localhost:5173"],
    };

    app = await buildApp({
      env,
      database: {
        check: async () => 0,
        close: async () => { databaseClosed = true; },
      },
      realtime: {
        start: async () => { realtimeStarted = true; },
        stop: async () => { realtimeStopped = true; },
        getStatus: () => ({ status: "ok" }),
        publish: async () => undefined,
        subscribe: async () => async () => undefined,
      },
    });

    const response = await app.inject({ method: "GET", url: "/health" });
    const health = HealthResponseSchema.parse(response.json());

    expect(response.statusCode).toBe(200);
    expect(health).toMatchObject({
      status: "ok",
      service: "ottv2-server",
      protocolVersion: PROTOCOL_VERSION,
      components: {
        application: { status: "ok" },
        database: { status: "ok" },
        realtime: { status: "ok" },
      },
    });
    expect(realtimeStarted).toBe(true);

    await app.close();
    app = undefined;
    expect(databaseClosed).toBe(true);
    expect(realtimeStopped).toBe(true);
  });
});
