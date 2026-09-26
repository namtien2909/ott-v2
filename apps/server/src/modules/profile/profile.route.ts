import { ProfilePatchRequestSchema } from "@ottv2/contracts";
import type { FastifyInstance } from "fastify";

import { requireBody, readCookie } from "../auth/auth.http.js";
import type { AuthService } from "../auth/auth.service.js";

export async function registerProfileRoutes(app: FastifyInstance, service: AuthService): Promise<void> {
  app.get("/profiles/me", async (request, reply) => {
    const context = await service.authenticate(readCookie(request));
    return reply.status(200).send({ user: await service.self(context) });
  });

  app.patch("/profiles/me", async (request, reply) => {
    const context = await service.authenticate(readCookie(request));
    const input = requireBody(request.body, ProfilePatchRequestSchema);
    return reply.status(200).send({ user: await service.updateProfile(context, input) });
  });

  app.get<{ Params: { username: string } }>("/profiles/:username", async (request, reply) => {
    return reply.status(200).send({ profile: await service.publicProfile(request.params.username) });
  });
}
