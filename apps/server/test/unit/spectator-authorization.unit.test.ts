import { EventEmitter } from "node:events";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthService } from "../../src/modules/auth/auth.service.js";
import { MetricsRegistry } from "../../src/modules/diagnostics/metrics.js";
import { MatchManager } from "../../src/modules/match/match.manager.js";
import { registerMatchRoutes } from "../../src/modules/match/match.route.js";
import { RoomManager, type RoomActor } from "../../src/modules/room/room.manager.js";
import { registerCors } from "../../src/plugins/cors.js";

const host: RoomActor = { userId: "lease-host", username: "lease_host", displayName: "Host" };
const player: RoomActor = { userId: "lease-player", username: "lease_player", displayName: "Player" };
const viewer: RoomActor = { userId: "lease-viewer", username: "lease_viewer", displayName: "Viewer" };
const otherViewer: RoomActor = { userId: "lease-other", username: "lease_other", displayName: "Other" };
const roomInput = { visibility: "PUBLIC" as const, timerSeconds: 300 as const, spectatorsEnabled: true, spectatorCapacity: 10 as const };
type StreamRequest = FastifyRequest<{ Params: { roomId: string } }>;
type StreamHandler = (request: StreamRequest, reply: FastifyReply) => Promise<unknown>;

class StreamResponse extends EventEmitter {
  writableEnded = false;
  destroyed = false;
  writeHead = vi.fn();
  write = vi.fn();
  end = vi.fn(() => { this.writableEnded = true; this.emit("close"); });
}

class StreamRequestRaw extends EventEmitter { complete = true; }

const cleanup: Array<() => void> = [];

function authFor(actor: RoomActor) {
  return { authenticate: vi.fn(async () => ({ user: { id: actor.userId, username: actor.username, displayName: actor.displayName } })) };
}

async function fixture(twoPlayers = true) {
  const rooms = new RoomManager();
  const matches = new MatchManager(() => Date.now());
  cleanup.push(() => matches.stop());
  const created = await rooms.create(host, roomInput);
  if (twoPlayers) await rooms.join(player, created.roomId, {});
  await rooms.spectate(viewer, created.roomId, {});
  const metrics = new MetricsRegistry();

  async function open(actor = viewer, roomId = created.roomId) {
    const handlers = new Map<string, StreamHandler>();
    const app = { get: (path: string, handler: StreamHandler) => handlers.set(path, handler), post: vi.fn() } as unknown as FastifyInstance;
    const auth = authFor(actor);
    await registerMatchRoutes(app, auth as unknown as AuthService, rooms, matches, undefined, undefined, metrics);
    const requestRaw = new StreamRequestRaw();
    const raw = new StreamResponse();
    const request = { params: { roomId }, headers: {}, raw: requestRaw } as unknown as StreamRequest;
    const reply = { raw, hijack: vi.fn(), getHeaders: () => ({}) } as unknown as FastifyReply;
    cleanup.push(() => { requestRaw.emit("close"); raw.emit("close"); });
    const handler = handlers.get("/matches/:roomId/spectator/events");
    if (!handler) throw new Error("Spectator SSE route missing");
    await handler(request, reply);
    return { raw, requestRaw, auth };
  }

  return { rooms, matches, metrics, roomId: created.roomId, open };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1_000); });
afterEach(() => {
  for (const close of cleanup.splice(0).reverse()) close();
  vi.useRealTimers();
});

describe("R1 spectator room-role authorization", () => {
  it("closes every existing stream on explicit leave and prevents later events or ticks", async () => {
    const f = await fixture();
    const first = await f.open();
    const second = await f.open();
    const tick = vi.spyOn(f.matches, "tick");
    const closed = vi.spyOn(f.metrics, "streamClosed");
    const writes = [first.raw.write.mock.calls.length, second.raw.write.mock.calls.length];

    f.rooms.leaveSpectator(` ${f.roomId.toLowerCase()} `, viewer.userId);
    expect(first.raw.end).toHaveBeenCalledTimes(1);
    expect(second.raw.end).toHaveBeenCalledTimes(1);
    expect(f.matches.spectatorListenerCount(f.roomId)).toBe(0);
    f.matches.ready(f.rooms.search(f.roomId, host.userId), host, true);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(first.raw.write).toHaveBeenCalledTimes(writes[0]!);
    expect(second.raw.write).toHaveBeenCalledTimes(writes[1]!);
    expect(tick).not.toHaveBeenCalled();
    first.requestRaw.emit("close");
    second.raw.emit("close");
    f.rooms.leaveSpectator(f.roomId, viewer.userId);
    expect(closed).toHaveBeenCalledTimes(2);
    expect(f.metrics.snapshot().activeStreams).toBe(0);
  });

  it("keeps other users and other rooms authorized when one room lease is revoked", async () => {
    const f = await fixture();
    await f.rooms.spectate(otherViewer, f.roomId, {});
    const roomB = await f.rooms.create({ ...host, userId: "lease-host-b" }, roomInput);
    await f.rooms.spectate(viewer, roomB.roomId, {});
    const revoked = await f.open();
    const sameRoom = await f.open(otherViewer);
    const otherRoom = await f.open(viewer, roomB.roomId);

    f.rooms.leaveSpectator(f.roomId, viewer.userId);
    expect(revoked.raw.writableEnded).toBe(true);
    expect(sameRoom.raw.end).not.toHaveBeenCalled();
    expect(otherRoom.raw.end).not.toHaveBeenCalled();
    expect(f.matches.spectatorListenerCount(f.roomId)).toBe(1);
    expect(f.matches.spectatorListenerCount(roomB.roomId)).toBe(1);
    expect(f.metrics.snapshot().activeStreams).toBe(2);
  });

  it.each(["request", "response"] as const)("cleans up a transient %s close once but preserves the reconnect lease", async (surface) => {
    const f = await fixture();
    const stream = await f.open();
    const closed = vi.spyOn(f.metrics, "streamClosed");
    if (surface === "request") stream.requestRaw.complete = false;
    (surface === "request" ? stream.requestRaw : stream.raw).emit("close");
    stream.requestRaw.emit("close");
    stream.raw.emit("close");
    expect(f.matches.spectatorListenerCount(f.roomId)).toBe(0);
    expect(closed).toHaveBeenCalledTimes(1);
    expect(f.rooms.isSpectator(f.roomId, viewer.userId)).toBe(true);
    const reconnected = await f.open();
    expect(reconnected.raw.write).toHaveBeenCalledTimes(1);
    expect(f.matches.spectatorListenerCount(f.roomId)).toBe(1);
    f.rooms.leaveSpectator(f.roomId, viewer.userId);
    expect(reconnected.raw.end).toHaveBeenCalledTimes(1);
  });

  it("does not confuse completed HTTP request input with closing the SSE response", async () => {
    const f = await fixture();
    const stream = await f.open();
    stream.requestRaw.emit("close");
    expect(f.matches.spectatorListenerCount(f.roomId)).toBe(1);
    expect(f.metrics.snapshot().activeStreams).toBe(1);
    f.matches.ready(f.rooms.search(f.roomId, host.userId), host, true);
    expect(stream.raw.write).toHaveBeenCalledTimes(2);
  });

  it("revokes spectator streams when the last player deletes the room", async () => {
    const f = await fixture(false);
    const stream = await f.open();
    f.rooms.leave(host, f.roomId);
    expect(stream.raw.end).toHaveBeenCalledTimes(1);
    expect(f.matches.spectatorListenerCount(f.roomId)).toBe(0);
    expect(f.rooms.isSpectator(f.roomId, viewer.userId)).toBe(false);
    expect(() => f.rooms.spectatorView(f.roomId, viewer.userId)).toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("revokes a spectator lease only after a successful transition to player", async () => {
    const f = await fixture(false);
    const stream = await f.open();
    const joined = await f.rooms.join(viewer, f.roomId, {});
    expect(joined.isMember).toBe(true);
    expect(joined.spectators).toBe(0);
    expect(stream.raw.end).toHaveBeenCalledTimes(1);
    expect(f.rooms.isSpectator(f.roomId, viewer.userId)).toBe(false);
    expect(() => f.rooms.spectatorView(f.roomId, viewer.userId)).toThrow();
  });

  it("retains the spectator lease when a player transition is rejected", async () => {
    const f = await fixture();
    const stream = await f.open();
    await expect(f.rooms.join(viewer, f.roomId, {})).rejects.toMatchObject({ code: "CONFLICT" });
    expect(f.rooms.isSpectator(f.roomId, viewer.userId)).toBe(true);
    expect(stream.raw.end).not.toHaveBeenCalled();
  });

  it("checks authoritative room access before every event, without reauthenticating the session", async () => {
    const f = await fixture();
    const stream = await f.open();
    const writes = stream.raw.write.mock.calls.length;
    vi.spyOn(f.rooms, "isSpectator").mockReturnValue(false);
    f.matches.ready(f.rooms.search(f.roomId, host.userId), host, true);
    expect(stream.raw.write).toHaveBeenCalledTimes(writes);
    expect(stream.raw.end).toHaveBeenCalledTimes(1);
    expect(f.matches.spectatorListenerCount(f.roomId)).toBe(0);
    expect(stream.auth.authenticate).toHaveBeenCalledTimes(1);
  });

  it("checks authoritative room access before ticking, without reauthenticating the session", async () => {
    const f = await fixture();
    const stream = await f.open();
    const tick = vi.spyOn(f.matches, "tick");
    vi.spyOn(f.rooms, "isSpectator").mockReturnValue(false);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(tick).not.toHaveBeenCalled();
    expect(stream.raw.end).toHaveBeenCalledTimes(1);
    expect(stream.auth.authenticate).toHaveBeenCalledTimes(1);
  });

  it("uses a current authorized room view for each tick instead of the opening snapshot", async () => {
    const f = await fixture();
    const stream = await f.open();
    const tick = vi.spyOn(f.matches, "tick");
    f.rooms.leave(player, f.roomId);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(tick).toHaveBeenCalledTimes(1);
    expect(tick.mock.calls[0]![0].members.map((member) => member.userId)).toEqual([host.userId]);
    expect(stream.auth.authenticate).toHaveBeenCalledTimes(1);
  });

  it("cleans up a failed event write without interrupting other authorized viewers", async () => {
    const f = await fixture();
    await f.rooms.spectate(otherViewer, f.roomId, {});
    const failed = await f.open();
    const unaffected = await f.open(otherViewer);
    failed.raw.write.mockImplementation(() => { throw new Error("closed transport"); });
    expect(() => f.matches.ready(f.rooms.search(f.roomId, host.userId), host, true)).not.toThrow();
    expect(failed.raw.end).toHaveBeenCalledTimes(1);
    expect(unaffected.raw.write).toHaveBeenCalledTimes(2);
    expect(f.matches.spectatorListenerCount(f.roomId)).toBe(1);
  });

  it("fails closed when access was revoked between match subscription and lease observation", async () => {
    const f = await fixture();
    const subscribe = f.matches.subscribeSpectator.bind(f.matches);
    const snapshotEvent = vi.spyOn(f.matches, "snapshotEvent");
    vi.spyOn(f.matches, "subscribeSpectator").mockImplementation((roomId, listener) => {
      const unsubscribe = subscribe(roomId, listener);
      f.rooms.leaveSpectator(roomId, viewer.userId);
      return unsubscribe;
    });
    const stream = await f.open();
    expect(snapshotEvent).not.toHaveBeenCalled();
    expect(stream.raw.write).not.toHaveBeenCalled();
    expect(stream.raw.end).toHaveBeenCalledTimes(1);
    expect(f.matches.spectatorListenerCount(f.roomId)).toBe(0);
    expect(f.metrics.snapshot().activeStreams).toBe(0);
  });

  it("fails closed if room access changes before the initial snapshot can be sent", async () => {
    const f = await fixture();
    const original = f.matches.snapshotEvent.bind(f.matches);
    vi.spyOn(f.matches, "snapshotEvent").mockImplementation((room) => {
      f.rooms.leaveSpectator(f.roomId, viewer.userId);
      return original(room);
    });
    const stream = await f.open();
    expect(stream.raw.write).not.toHaveBeenCalled();
    expect(stream.raw.end).toHaveBeenCalledTimes(1);
    expect(f.matches.spectatorListenerCount(f.roomId)).toBe(0);
    expect(f.metrics.snapshot().activeStreams).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("R1 match SSE configured CORS policy", () => {
  it.each([
    { role: "spectator", origin: "https://arena.example", allowed: true },
    { role: "spectator", origin: "https://outsider.example", allowed: false },
    { role: "spectator", origin: undefined, allowed: false },
    { role: "player", origin: "https://arena.example", allowed: true },
    { role: "player", origin: "https://outsider.example", allowed: false },
  ])("keeps configured CORS for $role / $origin", async ({ role, origin, allowed }) => {
    vi.useRealTimers();
    const f = await fixture();
    const app = Fastify();
    await registerCors(app, ["https://arena.example"]);
    const auth = authFor(role === "player" ? host : viewer);
    await registerMatchRoutes(app, auth as unknown as AuthService, f.rooms, f.matches, undefined, undefined, f.metrics);
    app.addHook("onRequest", async (request, reply) => {
      const write = reply.raw.write.bind(reply.raw);
      // Bound the real injected SSE response to its first event; no TCP listener or DB.
      vi.spyOn(reply.raw, "write").mockImplementation((chunk) => {
        const result = write(chunk);
        queueMicrotask(() => { request.raw.emit("close"); reply.raw.end(); });
        return result;
      });
    });
    await app.ready();
    const responsePromise = app.inject({
      method: "GET",
      url: `/matches/${f.roomId}/${role === "spectator" ? "spectator/" : ""}events`,
      ...(origin ? { headers: { origin } } : {}),
    });
    try {
      const response = await responsePromise;
      expect(response.statusCode).toBe(200);
      expect(response.headers["access-control-allow-origin"]).toBe(allowed ? origin : undefined);
      expect(response.headers["access-control-allow-origin"]).not.toBe("*");
      if (origin) expect(response.headers["access-control-allow-credentials"]).toBe(allowed ? "true" : undefined);
      expect(response.headers["content-type"]).toBe("text/event-stream");
    } finally {
      await app.close();
    }
  });
});
