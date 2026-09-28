import { MatchEventEnvelopeSchema, PieceMoveRequestSchema, ReadyMatchRequestSchema, RematchRequestSchema, SurrenderMatchRequestSchema } from "@ottv2/contracts";
import type { FastifyInstance } from "fastify";
import type { FastifyRequest } from "fastify";
import type { Coordinate } from "@ottv2/game-rules";

import { requireBody, readCookie } from "../auth/auth.http.js";
import type { AuthService } from "../auth/auth.service.js";
import { RoomManager } from "../room/room.manager.js";
import { AppError } from "../../shared/errors/app-error.js";
import { MatchManager, type MatchActor } from "./match.manager.js";
import type { RatingService } from "../rating/rating.service.js";
import type { MatchHistoryService } from "../history/history.service.js";
import type { MetricsRegistry } from "../diagnostics/metrics.js";

function actorOf(context: Awaited<ReturnType<AuthService["authenticate"]>>): MatchActor {
  return { userId: context.user.id, username: context.user.username, displayName: context.user.displayName };
}

function clientIdOf(request: FastifyRequest): string {
  const header = request.headers["x-client-id"];
  if (typeof header === "string" && header.trim()) return header.trim().slice(0, 120);
  const query = request.query as { clientId?: unknown } | undefined;
  return typeof query?.clientId === "string" && query.clientId.trim() ? query.clientId.trim().slice(0, 120) : "server";
}

async function memberRoom(auth: AuthService, rooms: RoomManager, request: FastifyRequest<{ Params: { roomId: string } }>) {
  const context = await auth.authenticate(readCookie(request));
  const room = rooms.search(request.params.roomId, context.user.id);
  if (!room.isMember) throw new AppError("UNAUTHORIZED", "Bạn không phải thành viên của room này.", 403, false, "FATAL_SESSION", { reason: "MATCH_MEMBER_REQUIRED" });
  return { context, room };
}

async function settle(matches: MatchManager, history: MatchHistoryService | undefined, rating: RatingService | undefined, rooms: RoomManager, roomId: string, room: Awaited<ReturnType<RoomManager["search"]>>, match: Awaited<ReturnType<MatchManager["ensure"]>>): Promise<Awaited<ReturnType<MatchManager["ensure"]>>> {
  let next = match;
  if (rating && next.status === "FINISHED" && next.rating === null) {
    try {
      const result = await rating.finalize(next);
      if (result) next = matches.setRating(room, result);
    } catch {
      // The authoritative result is already committed in memory; persistence/retry handles DB degradation.
    }
  }
  if (history && (next.status === "FINISHED" || next.status === "ABORTED")) await history.record(next);
  if (next.status === "PLAYING") rooms.markPlaying(roomId);
  return next;
}

export async function registerMatchRoutes(app: FastifyInstance, auth: AuthService, rooms: RoomManager, matches: MatchManager, rating?: RatingService, history?: MatchHistoryService, metrics?: MetricsRegistry): Promise<void> {
  app.get<{ Params: { roomId: string } }>("/matches/:roomId/spectator", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    const room = rooms.spectatorView(request.params.roomId, context.user.id);
    const match = matches.ensure(room);
    return reply.status(200).send({ role: "SPECTATOR", room, match, viewerSide: null, spectatorCount: room.spectators });
  });

  app.get<{ Params: { roomId: string } }>("/matches/:roomId/spectator/events", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    const room = rooms.spectatorView(request.params.roomId, context.user.id);
    const clientRoom = rooms.spectatorView(request.params.roomId, context.user.id);
    matches.ensure(clientRoom);
    const raw = reply.raw;
    reply.hijack();
    raw.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "Access-Control-Allow-Origin": "http://localhost:3000", "Access-Control-Allow-Credentials": "true" });
    const send = (event: unknown) => { const parsed = MatchEventEnvelopeSchema.safeParse(event); if (parsed.success) { metrics?.recordFanout(1); raw.write(`data: ${JSON.stringify(parsed.data)}\n\n`); } };
    const unsubscribe = matches.subscribeSpectator(room.roomId, send);
    metrics?.streamOpened();
    send(matches.snapshotEvent(room));
    const timer = setInterval(async () => {
      let snapshot = matches.tick(room);
      snapshot = await settle(matches, history, rating, rooms, room.roomId, room, snapshot);
    }, 1000);
    // Keep the authorization lease across transient SSE reconnects; the explicit leave endpoint releases capacity.
    request.raw.on("close", () => { clearInterval(timer); unsubscribe(); metrics?.streamClosed(); });
  });

  app.get<{ Params: { roomId: string } }>("/matches/:roomId", async (request, reply) => {
    const { context, room } = await memberRoom(auth, rooms, request);
    matches.acquireActiveLock(room, context.user.id, clientIdOf(request));
    const match = matches.ensure(room);
    if (match.status === "PLAYING") rooms.markPlaying(room.roomId);
    return reply.status(200).send({ match, viewerSide: matches.getViewerSide(room, context.user.id) });
  });

  app.post<{ Params: { roomId: string } }>("/matches/:roomId/ready", async (request, reply) => {
    const { context, room } = await memberRoom(auth, rooms, request);
    matches.acquireActiveLock(room, context.user.id, clientIdOf(request));
    const input = requireBody(request.body, ReadyMatchRequestSchema);
    const match = matches.ready(room, actorOf(context), input.ready);
    if (match.status === "PLAYING") rooms.markPlaying(room.roomId);
    return reply.status(200).send({ match });
  });

  app.post<{ Params: { roomId: string } }>("/matches/:roomId/fast-ready", async (request, reply) => {
    const { context, room } = await memberRoom(auth, rooms, request);
    matches.acquireActiveLock(room, context.user.id, clientIdOf(request));
    return reply.status(200).send({ match: matches.fastReady(room, actorOf(context)) });
  });
  app.post<{ Params: { roomId: string } }>("/matches/:roomId/moves", async (request, reply) => {
    const { context, room } = await memberRoom(auth, rooms, request);
    matches.acquireActiveLock(room, context.user.id, clientIdOf(request));
    const input = requireBody(request.body, PieceMoveRequestSchema);
    let match = matches.move(room, actorOf(context), input.from as Coordinate, input.to as Coordinate, input.stateVersion);
    match = await settle(matches, history, rating, rooms, room.roomId, room, match);
    return reply.status(200).send({ match });
  });

  app.post<{ Params: { roomId: string } }>("/matches/:roomId/surrender", async (request, reply) => {
    const { context, room } = await memberRoom(auth, rooms, request);
    matches.acquireActiveLock(room, context.user.id, clientIdOf(request));
    const input = requireBody(request.body, SurrenderMatchRequestSchema);
    let match = matches.surrender(room, actorOf(context), input.stateVersion);
    match = await settle(matches, history, rating, rooms, room.roomId, room, match);
    return reply.status(200).send({ match });
  });

  app.post<{ Params: { roomId: string } }>("/matches/:roomId/rematch", async (request, reply) => {
    const { context, room } = await memberRoom(auth, rooms, request);
    matches.acquireActiveLock(room, context.user.id, clientIdOf(request));
    const input = requireBody(request.body, RematchRequestSchema);
    const match = matches.rematch(room, actorOf(context), input.stateVersion);
    if (match.status === "WAITING_READY" || match.status === "COUNTDOWN" || match.status === "PLAYING") matches.acquireActiveLock(room, context.user.id, clientIdOf(request));
    return reply.status(200).send({ match });
  });

  app.get<{ Params: { roomId: string } }>("/matches/:roomId/events", async (request, reply) => {
    const { context, room } = await memberRoom(auth, rooms, request);
    const clientId = clientIdOf(request);
    matches.acquireActiveLock(room, context.user.id, clientId);
    const raw = reply.raw;
    reply.hijack();
    raw.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "Access-Control-Allow-Origin": "http://localhost:3000", "Access-Control-Allow-Credentials": "true" });
    const send = (event: unknown) => { const parsed = MatchEventEnvelopeSchema.safeParse(event); if (parsed.success) { metrics?.recordFanout(1); raw.write(`data: ${JSON.stringify(parsed.data)}\n\n`); } };
    const unsubscribe = matches.subscribe(room.roomId, send);
    metrics?.streamOpened();
    matches.connect(room, context.user.id, clientId);
    send(matches.snapshotEvent(room));
    const timer = setInterval(async () => {
      let snapshot = matches.tick(room);
      snapshot = await settle(matches, history, rating, rooms, room.roomId, room, snapshot);
    }, 1000);
    request.raw.on("close", () => { clearInterval(timer); unsubscribe(); metrics?.streamClosed(); matches.disconnect(room, context.user.id, clientId); });
  });
}
