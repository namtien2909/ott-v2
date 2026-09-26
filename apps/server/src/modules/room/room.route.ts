import { CreateRoomRequestSchema, JoinRoomRequestSchema, SpectateRoomRequestSchema } from "@ottv2/contracts";
import type { FastifyInstance } from "fastify";

import { requireBody, readCookie } from "../auth/auth.http.js";
import type { AuthService } from "../auth/auth.service.js";
import { RoomManager, type RoomActor } from "./room.manager.js";

function idempotencyKey(request: { headers: Record<string, string | string[] | undefined> }): string | undefined {
  const value = request.headers["idempotency-key"];
  return Array.isArray(value) ? value[0] : value;
}

function actorOf(context: Awaited<ReturnType<AuthService["authenticate"]>>): RoomActor {
  return { userId: context.user.id, username: context.user.username, displayName: context.user.displayName, rating: context.user.stats?.elo ?? 1000 };
}

export async function registerRoomRoutes(app: FastifyInstance, auth: AuthService, rooms: RoomManager): Promise<void> {
  app.get<{ Querystring: { search?: string; limit?: string } }>("/rooms", async (request, reply) => {
    if (request.query.search?.trim()) return reply.status(200).send({ rooms: [rooms.search(request.query.search, undefined)] });
    const limit = request.query.limit ? Number.parseInt(request.query.limit, 10) : 8;
    return reply.status(200).send({ rooms: rooms.list(Number.isFinite(limit) ? limit : 8) });
  });

  app.get<{ Params: { roomId: string } }>("/rooms/:roomId", async (request, reply) => {
    return reply.status(200).send({ room: rooms.search(request.params.roomId) });
  });

  app.post("/rooms", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    const input = requireBody(request.body, CreateRoomRequestSchema);
    const room = await rooms.create(actorOf(context), input, idempotencyKey(request));
    return reply.status(201).send({ room });
  });

  app.post<{ Params: { roomId: string } }>("/rooms/:roomId/join", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    const input = requireBody(request.body ?? {}, JoinRoomRequestSchema);
    const room = await rooms.join(actorOf(context), request.params.roomId, input, idempotencyKey(request));
    return reply.status(200).send({ room });
  });

  app.post<{ Params: { roomId: string } }>("/rooms/:roomId/spectate", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    const input = requireBody(request.body ?? {}, SpectateRoomRequestSchema);
    const room = await rooms.spectate(actorOf(context), request.params.roomId, input);
    return reply.status(200).send({ role: "SPECTATOR", room });
  });

  app.post<{ Params: { roomId: string } }>("/rooms/:roomId/spectate/leave", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    rooms.leaveSpectator(request.params.roomId, context.user.id);
    return reply.status(204).send();
  });

  app.post<{ Params: { roomId: string } }>("/rooms/:roomId/leave", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    const result = rooms.leave(actorOf(context), request.params.roomId);
    if (!result) return reply.status(204).send();
    return reply.status(200).send({ room: result });
  });
}
