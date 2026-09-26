import { CreateInviteRequestSchema, FriendRequestDirectionSchema, PresenceEventSchema, SearchUsersQuerySchema } from "@ottv2/contracts";
import type { FastifyInstance } from "fastify";

import { requireBody, readCookie } from "../auth/auth.http.js";
import type { AuthService } from "../auth/auth.service.js";
import { SocialService } from "./social.service.js";

export async function registerSocialRoutes(app: FastifyInstance, auth: AuthService, social: SocialService): Promise<void> {
  app.get("/social/friends", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    await social.markOnline(context.user.id);
    return reply.status(200).send({ friends: await social.friends(context.user.id) });
  });

  app.get("/social/search", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    const query = requireBody(request.query ?? {}, SearchUsersQuerySchema);
    await social.markOnline(context.user.id);
    return reply.status(200).send({ results: await social.search(context.user.id, query.q) });
  });

  app.get("/social/requests", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    const raw = (request.query ?? {}) as { direction?: unknown };
    const direction = FriendRequestDirectionSchema.parse(raw.direction ?? "incoming");
    await social.markOnline(context.user.id);
    return reply.status(200).send({ requests: await social.requests(context.user.id, direction) });
  });

  app.post<{ Params: { userId: string } }>("/social/requests/:userId", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    const result = await social.sendRequest(context.user.id, request.params.userId);
    return reply.status(201).send(result);
  });

  app.post<{ Params: { requestId: string; action: "accept" | "reject" | "cancel" } }>("/social/requests/:requestId/:action", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    if (!["accept", "reject", "cancel"].includes(request.params.action)) return reply.status(404).send();
    await social.updateRequest(context.user.id, request.params.requestId, request.params.action);
    return reply.status(204).send();
  });

  app.delete<{ Params: { userId: string } }>("/social/friends/:userId", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    await social.removeFriend(context.user.id, request.params.userId);
    return reply.status(204).send();
  });

  app.post<{ Params: { userId: string } }>("/social/blocks/:userId", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    await social.block(context.user.id, request.params.userId);
    return reply.status(204).send();
  });

  app.delete<{ Params: { userId: string } }>("/social/blocks/:userId", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    await social.unblock(context.user.id, request.params.userId);
    return reply.status(204).send();
  });

  app.get("/social/blocks", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    return reply.status(200).send({ users: await social.blocks(context.user.id) });
  });

  app.get("/social/presence/events", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    const raw = reply.raw;
    reply.hijack();
    raw.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "Access-Control-Allow-Origin": "http://localhost:3000", "Access-Control-Allow-Credentials": "true" });
    const send = (event: unknown) => { const parsed = PresenceEventSchema.safeParse(event); if (parsed.success) raw.write(`data: ${JSON.stringify(parsed.data)}\n\n`); };
    const unsubscribe = await social.subscribePresence(context.user.id, send);
    await social.markOnline(context.user.id);
    request.raw.on("close", unsubscribe);
  });

  app.get("/social/invites", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    return reply.status(200).send({ invites: await social.invitesFor(context.user.id) });
  });

  app.post("/social/invites", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    const input = requireBody(request.body, CreateInviteRequestSchema);
    return reply.status(201).send({ invite: await social.createInvite(context.user.id, input.roomId, input.targetUserId) });
  });

  app.post<{ Params: { token: string } }>("/social/invites/:token/accept", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    return reply.status(200).send(await social.acceptInvite(context.user.id, request.params.token));
  });

  app.post<{ Params: { token: string } }>("/social/invites/:token/reject", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    social.rejectInvite(context.user.id, request.params.token);
    return reply.status(204).send();
  });
}
