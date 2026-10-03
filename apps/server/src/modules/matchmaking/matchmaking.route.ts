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
    const initial = matchmaking.snapshotEvent(queueId, userId);
    const raw = reply.raw;
    reply.hijack();
    for (const [name, value] of Object.entries(reply.getHeaders())) {
      if (value !== undefined) raw.setHeader(name, value);
    }
    raw.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
    let closed = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let unsubscribe = () => {};
    const cleanup = () => {
      if (closed) return;
      closed = true;
      if (timer !== undefined) clearInterval(timer);
      unsubscribe();
      request.raw.off("close", onRequestClose);
      raw.off("close", cleanup);
    };
    const close = () => {
      if (closed) return;
      cleanup();
      if (!raw.writableEnded && !raw.destroyed) {
        try { raw.end(); } catch { raw.destroy(); }
      }
    };
    const authorized = () => {
      if (closed) return false;
      if (raw.writableEnded || raw.destroyed) { cleanup(); return false; }
      return true;
    };
    const send = (event: unknown) => {
      if (!authorized()) return;
      const parsed = MatchmakingEventEnvelopeSchema.safeParse(event);
      if (!parsed.success) return;
      try { raw.write(`data: ${JSON.stringify(parsed.data)}\n\n`); }
      catch { close(); }
    };
    function onRequestClose() {
      // IncomingMessage close also occurs when the request body has completed.
      // The response close event is authoritative for an actual SSE disconnect.
      if (!request.raw.complete) cleanup();
    }
    request.raw.on("close", onRequestClose);
    raw.on("close", cleanup);
    unsubscribe = matchmaking.subscribe(queueId, send);
    send(initial);
    if (closed) return;
    timer = setInterval(() => {
      if (!authorized()) return;
      try { matchmaking.tick(queueId, userId); }
      catch { close(); }
    }, 1000);
    timer.unref();
  });
}
