import { performance } from "node:perf_hooks";

import { PrismaClient } from "@prisma/client";

export interface DatabasePort {
  check(): Promise<number>;
  close(): Promise<void>;
}

export class PrismaDatabase implements DatabasePort {
  readonly client: PrismaClient;

  constructor(client: PrismaClient = new PrismaClient()) {
    this.client = client;
  }

  async check(): Promise<number> {
    const startedAt = performance.now();
    await this.client.$queryRaw`SELECT 1`;
    return Math.max(0, Math.round(performance.now() - startedAt));
  }

  async close(): Promise<void> {
    await this.client.$disconnect();
  }
}
