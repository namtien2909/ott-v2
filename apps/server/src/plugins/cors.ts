import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";

export async function registerCors(app: FastifyInstance, allowedOrigins: readonly string[]): Promise<void> {
  const allowlist = new Set(allowedOrigins);
  await app.register(cors, {
    credentials: true,
    origin(origin, callback) {
      if (origin === undefined || allowlist.has(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    }
  });
}
