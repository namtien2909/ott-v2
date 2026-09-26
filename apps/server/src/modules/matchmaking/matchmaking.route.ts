import { JoinMatchmakingRequestSchema, MatchmakingEventEnvelopeSchema } from "@ottv2/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";

import { requireBody, readCookie } from "../auth/auth.http.js";
import type { AuthService } from "../auth/auth.service.js";
import { MatchmakingManager } from "./matchmaking.manager.js";

function clientIdOf(request: FastifyRequest): string {
  const header = request.headers["x-client-id"];
  if (typeof header === "string" && header.trim()) return header.trim().slice(0, 120);
  const query = request.query as { clientId?: unknown } | undefined;
  return typeof query?.clientId === "string" && query.clientId.trim() ? query.clientId.trim().slice(0, 120) : "server";
}

export async function registerMatchmakingRoutes(app: FastifyInstance, auth: AuthService, matchmaking: MatchmakingManager): Promise<void> {
  app.post("/matchmaking/queue", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    const input = requireBody(request.body ?? {}, JoinMatchmakingRequestSchema);
    const snapshot = await matchmaking.join({ userId: context.user.id, username: context.user.username, displayName: context.user.displayName }, context.user.stats?.elo ?? 1000, clientIdOf(request));
    return reply.status(200).send({ queue: snapshot });
  });

  app.get<{ Params: { queueId: string } }>("/matchmaking/queue/:queueId", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    return reply.status(200).send({ queue: matchmaking.get(request.params.queueId, context.user.id) });
  });

  app.delete<{ Params: { queueId: string } }>("/matchmaking/queue/:queueId", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    return reply.status(200).send({ queue: matchmaking.cancel(request.params.queueId, context.user.id) });
  });

  app.get<{ Params: { queueId: string } }>("/matchmaking/queue/:queueId/events", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    const userId = context.user.id;
    const queueId = request.params.queueId;
    const raw = reply.raw;
    reply.hijack();
    raw.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "Access-Control-Allow-Origin": "http://localhost:3000", "Access-Control-Allow-Credentials": "true" });
    const send = (event: unknown) => { const parsed = MatchmakingEventEnvelopeSchema.safeParse(event); if (parsed.success) raw.write(`data: ${JSON.stringify(parsed.data)}\n\n`); };
    const unsubscribe = matchmaking.subscribe(queueId, send);
    send(matchmaking.snapshotEvent(queueId, userId));
    const timer = setInterval(() => { matchmaking.tick(queueId, userId); }, 1000);
    request.raw.on("close", () => { clearInterval(timer); unsubscribe(); });
  });
}
