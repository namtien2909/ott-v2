import { MatchEventEnvelopeSchema, PieceMoveRequestSchema, ReadyMatchRequestSchema, RematchRequestSchema, SurrenderMatchRequestSchema } from "@ottv2/contracts";
import type { OutgoingHttpHeaders } from "node:http";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { FastifyRequest } from "fastify";
import type { Coordinate } from "@ottv2/game-rules";

import { requireBody, readCookie } from "../auth/auth.http.js";
import { GUEST_SESSION_COOKIE, type AuthService } from "../auth/auth.service.js";
import { RoomManager } from "../room/room.manager.js";
import { AppError } from "../../shared/errors/app-error.js";
import { MatchManager, type MatchActor } from "./match.manager.js";
import type { RatingService } from "../rating/rating.service.js";
import type { MatchHistoryService } from "../history/history.service.js";
import type { MetricsRegistry } from "../diagnostics/metrics.js";

function actorOf(context: Awaited<ReturnType<AuthService["authenticate"]>>): MatchActor {
  return { userId: context.user.id, username: context.user.username, displayName: context.user.displayName };
}

async function authenticateMatch(auth: AuthService, rooms: RoomManager, request: FastifyRequest<{ Params: { roomId: string } }>) {
  const accountToken = readCookie(request);
  const guestToken = readCookie(request, GUEST_SESSION_COOKIE);
  if (!guestToken) return auth.authenticate(accountToken);
  let guest: Awaited<ReturnType<AuthService["authenticate"]>>;
  try { guest = await auth.authenticateAny(undefined, guestToken); }
  catch { if (accountToken) return auth.authenticate(accountToken); throw new AppError("UNAUTHORIZED", "Phiên khách không hợp lệ.", 401, false, "FATAL_SESSION"); }
  try {
    const room = rooms.search(request.params.roomId, guest.user.id);
    if (room.isMember || rooms.isSpectator(request.params.roomId, guest.user.id)) return guest;
  } catch { /* account auth below handles non-existent/unauthorized room access */ }
  if (accountToken) return auth.authenticate(accountToken);
  return guest;
}

function assertGuestMatchAllowed(context: Awaited<ReturnType<AuthService["authenticate"]>>, room: Awaited<ReturnType<RoomManager["search"]>>): void {
  if (context.principal === "GUEST" && room.mode === "RANKED") throw new AppError("UNAUTHORIZED", "Guest chỉ có thể tham gia trận thường.", 403, false, "FATAL_SESSION", { reason: "ACCOUNT_REQUIRED_RANKED" });
}

function clientIdOf(request: FastifyRequest): string {
  const header = request.headers["x-client-id"];
  if (typeof header === "string" && header.trim()) return header.trim().slice(0, 120);
  const query = request.query as { clientId?: unknown } | undefined;
  return typeof query?.clientId === "string" && query.clientId.trim() ? query.clientId.trim().slice(0, 120) : "server";
}

function sseHeaders(reply: FastifyReply): OutgoingHttpHeaders {
  const headers: OutgoingHttpHeaders = {};
  for (const [name, value] of Object.entries(reply.getHeaders())) {
    if (value !== undefined) headers[name] = value;
  }
  headers["content-type"] = "text/event-stream";
  headers["cache-control"] = "no-cache, no-transform";
  headers.connection = "keep-alive";
  return headers;
}

async function memberRoom(auth: AuthService, rooms: RoomManager, request: FastifyRequest<{ Params: { roomId: string } }>) {
  const context = await authenticateMatch(auth, rooms, request);
  const room = rooms.search(request.params.roomId, context.user.id);
  assertGuestMatchAllowed(context, room);
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
    const context = await authenticateMatch(auth, rooms, request);
    const room = rooms.spectatorView(request.params.roomId, context.user.id);
    assertGuestMatchAllowed(context, room);
    const match = matches.ensure(room);
    return reply.status(200).send({ role: "SPECTATOR", room, match, viewerSide: null, spectatorCount: room.spectators });
  });

  app.get<{ Params: { roomId: string } }>("/matches/:roomId/spectator/events", async (request, reply) => {
    const context = await authenticateMatch(auth, rooms, request);
    const room = rooms.spectatorView(request.params.roomId, context.user.id);
    assertGuestMatchAllowed(context, room);
    matches.ensure(room);
    const raw = reply.raw;
    reply.hijack();
    // Preserve the configured CORS allowlist headers even though SSE bypasses reply.send.
    raw.writeHead(200, sseHeaders(reply));
    let closed = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let tickInFlight = false;
    let unsubscribe = () => {};
    let unsubscribeRevocation = () => {};
    metrics?.streamOpened();

    const cleanup = () => {
      if (closed) return;
      closed = true;
      if (timer !== undefined) clearInterval(timer);
      unsubscribe();
      unsubscribeRevocation();
      request.raw.off("close", onRequestClose);
      raw.off("close", cleanup);
      metrics?.streamClosed();
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
      if (!rooms.isSpectator(room.roomId, context.user.id)) { close(); return false; }
      return true;
    };
    const send = (event: unknown) => {
      if (!authorized()) return;
      const parsed = MatchEventEnvelopeSchema.safeParse(event);
      if (!parsed.success) return;
      try {
        raw.write(`data: ${JSON.stringify(parsed.data)}\n\n`);
        metrics?.recordFanout(1);
      } catch { close(); }
    };
    function onRequestClose() {
      // IncomingMessage close also signals a normally completed GET, not an SSE disconnect.
      if (!request.raw.complete) cleanup();
    }

    // A transport close keeps the room lease for reconnect; explicit role revocation closes every tab.
    request.raw.on("close", onRequestClose);
    raw.on("close", cleanup);
    unsubscribe = matches.subscribeSpectator(room.roomId, send);
    unsubscribeRevocation = rooms.subscribeSpectatorRevocation(room.roomId, context.user.id, close);
    if (closed) { unsubscribeRevocation(); return; }
    send(matches.snapshotEvent(room));
    if (closed) return;
    timer = setInterval(async () => {
      if (!authorized() || tickInFlight) return;
      tickInFlight = true;
      try {
        const currentRoom = rooms.spectatorView(room.roomId, context.user.id);
        const snapshot = matches.tick(currentRoom);
        if (authorized()) await settle(matches, history, rating, rooms, currentRoom.roomId, currentRoom, snapshot);
      } catch { close(); }
      finally { tickInFlight = false; }
    }, 1000);
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

  app.post<{ Params: { roomId: string } }>("/matches/:roomId/rematch/reject", async (request, reply) => {
    const { context, room } = await memberRoom(auth, rooms, request);
    matches.acquireActiveLock(room, context.user.id, clientIdOf(request));
    const input = requireBody(request.body, RematchRequestSchema);
    return reply.status(200).send({ match: matches.rejectRematch(room, actorOf(context), input.stateVersion) });
  });

  app.get<{ Params: { roomId: string } }>("/matches/:roomId/events", async (request, reply) => {
    const { context, room } = await memberRoom(auth, rooms, request);
    const clientId = clientIdOf(request);
    matches.acquireActiveLock(room, context.user.id, clientId);
    const raw = reply.raw;
    reply.hijack();
    raw.writeHead(200, sseHeaders(reply));
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
