import {
  APPLICATION_VERSION,
  PROTOCOL_VERSION,
  type HealthComponent,
  type HealthResponse
} from "@ottv2/contracts";

import type { DatabasePort } from "../../plugins/prisma.js";
import type { RealtimePort } from "../../realtime/realtime.port.js";

const DATABASE_HEALTH_TIMEOUT_MS = 1_000;

async function databaseComponent(database: DatabasePort): Promise<HealthComponent> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    const latencyMs = await Promise.race([
      database.check(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("database health timeout")), DATABASE_HEALTH_TIMEOUT_MS);
      })
    ]);
    return { status: "ok", latencyMs };
  } catch {
    return { status: "degraded", reason: "unreachable" };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export class HealthService {
  constructor(
    private readonly database: DatabasePort,
    private readonly realtime: RealtimePort
  ) {}

  async getHealth(): Promise<HealthResponse> {
    const database = await databaseComponent(this.database);
    const realtime = this.realtime.getStatus();
    const status = database.status === "ok" && realtime.status === "ok" ? "ok" : "degraded";

    return {
      status,
      service: "ottv2-server",
      version: APPLICATION_VERSION,
      protocolVersion: PROTOCOL_VERSION,
      timestamp: new Date().toISOString(),
      components: {
        application: { status: "ok" },
        database,
        realtime
      }
    };
  }
}
