import { describe, expect, it, vi } from "vitest";

import { MatchManager, type MatchActor } from "../../src/modules/match/match.manager.js";
import { RoomManager, type RoomActor } from "../../src/modules/room/room.manager.js";

const host: RoomActor & MatchActor = { userId: "match-host", username: "match_host", displayName: "Host" };
const guest: RoomActor & MatchActor = { userId: "match-guest", username: "match_guest", displayName: "Guest" };

async function roomForMatch() {
  const rooms = new RoomManager();
  const created = await rooms.create(host, { name: "W4 match", visibility: "PUBLIC", timerSeconds: 30, spectatorsEnabled: false });
  await rooms.join(guest, created.roomId, {});
  return rooms.search(created.roomId, host.userId);
}

describe("W4 MatchManager", () => {
  it("assigns stable sides and starts a countdown exactly after both players ready", async () => {
    let now = 1_000;
    const manager = new MatchManager(() => now);
    const room = await roomForMatch();
    const events: string[] = [];
    manager.subscribe(room.roomId, (event) => events.push(event.type));
    expect(manager.ensure(room).players.map((player) => player.side)).toEqual(["BLUE", "RED"]);
    manager.ready(room, host, true);
    const countdown = manager.ready(room, guest, true);
    expect(countdown.status).toBe("COUNTDOWN");
    expect(events).toContain("COUNTDOWN_STARTED");
    now += 3_001;
    expect(manager.tick(room).status).toBe("PLAYING");
    expect(events).toContain("MATCH_STARTED");
  });

  it("commits only authoritative moves and rejects stale state versions", async () => {
    let now = 2_000;
    const manager = new MatchManager(() => now);
    const room = await roomForMatch();
    manager.ready(room, host, true);
    manager.ready(room, guest, true);
    now += 3_001;
    const started = manager.tick(room);
    await expect(Promise.resolve().then(() => manager.move(room, host, "b1", "b2", started.stateVersion - 1))).rejects.toMatchObject({ code: "CONFLICT" });
    const moved = manager.move(room, host, "b1", "b2", started.stateVersion);
    expect(moved.board.b1).toBeNull();
    expect(moved.board.b2).toMatchObject({ side: "BLUE", type: "R" });
    expect(moved.currentTurn).toBe("RED");
  });

  it("finishes on surrender and resets only after both rematch requests", async () => {
    let now = 3_000;
    const manager = new MatchManager(() => now);
    const room = await roomForMatch();
    manager.ready(room, host, true);
    manager.ready(room, guest, true);
    now += 3_001;
    const started = manager.tick(room);
    const finished = manager.surrender(room, host, started.stateVersion);
    expect(finished.status).toBe("FINISHED");
    expect(finished.winner).toBe("RED");
    expect(finished.resultReason).toBe("SURRENDER");
    const waiting = manager.rematch(room, host, finished.stateVersion);
    expect(waiting.status).toBe("FINISHED");
    const rematch = manager.rematch(room, guest, waiting.stateVersion);
    expect(rematch.status).toBe("WAITING_READY");
    expect(rematch.winner).toBeNull();
    expect(rematch.players.every((player) => !player.ready)).toBe(true);
    expect(rematch.matchId).not.toBe(finished.matchId);
  });

  it("emits disconnect/resync events and preserves the match during the grace window", async () => {
    let now = 4_000;
    const manager = new MatchManager(() => now, 100);
    const room = await roomForMatch();
    const events: string[] = [];
    manager.subscribe(room.roomId, (event) => events.push(event.type));
    manager.ready(room, host, true);
    manager.ready(room, guest, true);
    now += 3_001;
    manager.tick(room);
    manager.connect(room, host.userId, "tab-a");
    manager.disconnect(room, host.userId, "tab-a");
    expect(manager.ensure(room).players.find((player) => player.userId === host.userId)?.connected).toBe(false);
    expect(events).toContain("PLAYER_DISCONNECTED");
    manager.connect(room, host.userId, "tab-a");
    expect(manager.ensure(room).players.find((player) => player.userId === host.userId)?.connected).toBe(true);
    expect(events).toContain("PLAYER_RECONNECTED");
    expect(events).toContain("STATE_RESYNC");
    vi.useFakeTimers();
    manager.disconnect(room, host.userId, "tab-a");
    vi.advanceTimersByTime(99);
    expect(manager.ensure(room).status).toBe("PLAYING");
    manager.connect(room, host.userId, "tab-a");
    expect(manager.ensure(room).status).toBe("PLAYING");
    vi.useRealTimers();
  });

  it("aborts an interrupted match after the disconnect grace window", async () => {
    vi.useFakeTimers();
    try {
      let now = 5_000;
      const manager = new MatchManager(() => now, 30);
      const room = await roomForMatch();
      const events: string[] = [];
      manager.subscribe(room.roomId, (event) => events.push(event.type));
      manager.ready(room, host, true);
      manager.ready(room, guest, true);
      now += 3_001;
      manager.tick(room);
      manager.connect(room, host.userId, "tab-a");
      manager.disconnect(room, host.userId, "tab-a");
      vi.advanceTimersByTime(31);
      const aborted = manager.ensure(room);
      expect(aborted.status).toBe("ABORTED");
      expect(aborted.resultReason).toBe("SERVER_INTERRUPTION");
      expect(events).toContain("MATCH_ABORTED");
    } finally {
      vi.useRealTimers();
    }
  });

  it("enforces one active game lock per account and client", async () => {
    const manager = new MatchManager(() => 6_000);
    const room = await roomForMatch();
    manager.acquireActiveLock(room, host.userId, "tab-a");
    expect(() => manager.acquireActiveLock(room, host.userId, "tab-a")).not.toThrow();
    expect(() => manager.acquireActiveLock(room, host.userId, "tab-b")).toThrowError(expect.objectContaining({
      code: "CONFLICT",
      details: expect.objectContaining({ reason: "ACTIVE_GAME_LOCK" }),
    }));
  });

  it("fans out committed snapshots to spectator listeners without granting commands", async () => {
    const manager = new MatchManager(() => 7_000);
    const room = await roomForMatch();
    const received: string[] = [];
    const unsubs = Array.from({ length: 10 }, () => manager.subscribeSpectator(room.roomId, (event) => received.push(event.type)));
    manager.ensure(room);
    manager.ready(room, host, true);
    manager.ready(room, guest, true);
    expect(received).toContain("PLAYER_READY");
    expect(manager.spectatorListenerCount(room.roomId)).toBe(10);
    unsubs.forEach((unsubscribe) => unsubscribe());
    expect(manager.spectatorListenerCount(room.roomId)).toBe(0);
  });

  it("keeps 1/10/50/100 listener fan-out within the local harness budget", async () => {
    const manager = new MatchManager(() => 8_000);
    const room = await roomForMatch();
    for (const count of [1, 10, 50, 100]) {
      const received = { value: 0 };
      const unsubs = Array.from({ length: count }, () => manager.subscribeSpectator(room.roomId, () => { received.value += 1; }));
      const started = performance.now();
      manager.ready(room, host, true);
      const elapsed = performance.now() - started;
      expect(received.value).toBeGreaterThanOrEqual(count);
      expect(elapsed).toBeLessThan(100);
      unsubs.forEach((unsubscribe) => unsubscribe());
    }
  });
});
