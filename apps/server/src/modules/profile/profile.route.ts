import { ProfilePatchRequestSchema } from "@ottv2/contracts";
import type { FastifyInstance } from "fastify";

import { requireBody, readCookie } from "../auth/auth.http.js";
import type { AuthService } from "../auth/auth.service.js";
import type { SocialService } from "../social/social.service.js";

export async function registerProfileRoutes(app: FastifyInstance, service: AuthService, social: SocialService): Promise<void> {
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
    const profile = await service.publicProfile(request.params.username);
    const token = readCookie(request);
    if (!token) return reply.status(200).send({ profile: { ...profile, isFriend: false, requestStatus: null } });
    const context = await service.authenticate(token);
    if (context.user.id === profile.userId) return reply.status(200).send({ profile: { ...profile, isSelf: true, isFriend: false, requestStatus: null } });
    return reply.status(200).send({ profile: { ...profile, ...await social.profileRelationship(context.user.id, profile.userId) } });
  });
}
