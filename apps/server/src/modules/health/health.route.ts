import { HealthResponseSchema } from "@ottv2/contracts";
import type { FastifyInstance } from "fastify";

import type { HealthService } from "./health.service.js";

export async function registerHealthRoute(app: FastifyInstance, service: HealthService): Promise<void> {
  app.get("/health", async (_request, reply) => {
    const response = HealthResponseSchema.parse(await service.getHealth());
    return reply.status(200).send(response);
  });
}
