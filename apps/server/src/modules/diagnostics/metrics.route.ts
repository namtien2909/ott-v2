import { MetricsSnapshotSchema } from "@ottv2/contracts";
import type { FastifyInstance } from "fastify";
import { MetricsRegistry } from "./metrics.js";

export async function registerMetricsRoute(app: FastifyInstance, metrics: MetricsRegistry): Promise<void> {
  app.get("/diagnostics/metrics", async (_request, reply) => reply.status(200).send(MetricsSnapshotSchema.parse(metrics.snapshot())));
}
