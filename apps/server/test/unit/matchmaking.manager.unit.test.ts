import { describe, expect, it } from "vitest";
import type { MatchmakingEventEnvelope } from "@ottv2/contracts";

import { MatchManager } from "../../src/modules/match/match.manager.js";
import { MatchmakingManager } from "../../src/modules/matchmaking/matchmaking.manager.js";
import { RoomManager } from "../../src/modules/room/room.manager.js";

const blue = { userId: "queue-blue", username: "queue_blue", displayName: "Queue Blue" };
const red = { userId: "queue-red", username: "queue_red", displayName: "Queue Red" };

describe("W6 MatchmakingManager", () => {
  it("keeps MATCH_FOUND newer than every tick in the same queue generation", async () => {
    const rooms = new RoomManager();
    const matches = new MatchManager();
    const queue = new MatchmakingManager(rooms, matches);
    const first = await queue.join(blue, 1000, "client-blue");
    const events: MatchmakingEventEnvelope[] = [queue.snapshotEvent(first.queueId, blue.userId)];
    const unsubscribe = queue.subscribe(first.queueId, (event) => events.push(event));
    queue.tick(first.queueId, blue.userId);
    queue.tick(first.queueId, blue.userId);
    await queue.join(red, 1000, "client-red");
    expect(events.at(-1)?.type).toBe("MATCH_FOUND");
    expect(events.at(-1)?.sequence).toBeGreaterThan(events.at(-2)!.sequence);
    expect(events.every((event) => event.queueId === first.queueId)).toBe(true);
    unsubscribe();
    queue.stop();
    matches.stop();
  });

  it("repeats cancellation idempotently and never matches a cancelled generation", async () => {
    const rooms = new RoomManager();
    const matches = new MatchManager();
    const queue = new MatchmakingManager(rooms, matches);
    const first = await queue.join(blue, 1000, "client-blue");
    const cancelled = queue.cancel(first.queueId, blue.userId);
    expect(queue.cancel(first.queueId, blue.userId)).toEqual(cancelled);
    expect((await queue.join(red, 1000, "client-red")).status).toBe("QUEUED");
    expect(queue.get(first.queueId, blue.userId).status).toBe("CANCELLED");
    expect(rooms.size()).toBe(0);
    queue.stop();
    matches.stop();
  });

  it("reserves both users while ranked room creation is awaiting storage", async () => {
    const rooms = new RoomManager();
    const matches = new MatchManager();
    const originalCreateRanked = rooms.createRanked.bind(rooms);
    let release!: () => void;
    let started!: () => void;
    const startedPromise = new Promise<void>((resolve) => { started = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    rooms.createRanked = async (...args) => {
      started();
      await gate;
      return originalCreateRanked(...args);
    };
    const queue = new MatchmakingManager(rooms, matches);
    const candidate = await queue.join(blue, 1000, "client-blue");
    const matching = queue.join(red, 1000, "client-red");
    await startedPromise;

    await expect(queue.join(blue, 1000, "another-client")).rejects.toMatchObject({ code: "CONFLICT" });
    expect(() => queue.cancel(candidate.queueId, blue.userId)).toThrowError(/Đang xác nhận ghép trận/);
    const redRetry = await queue.join(red, 1000, "client-red");

    release();
    const matched = await matching;
    expect(redRetry.queueId).toBe(matched.queueId);
    expect(matched.status).toBe("MATCHED");
    expect(queue.get(candidate.queueId, blue.userId).status).toBe("MATCHED");
    queue.stop();
    matches.stop();
  });

  it("keeps a failed room commit queryable as a cancelled provisional generation", async () => {
    const rooms = new RoomManager();
    const matches = new MatchManager();
    const originalCreateRanked = rooms.createRanked.bind(rooms);
    let rejectCommit!: (error: Error) => void;
    let started!: () => void;
    const startedPromise = new Promise<void>((resolve) => { started = resolve; });
    const commitFailure = new Promise<never>((_, reject) => { rejectCommit = reject; });
    rooms.createRanked = async (...args) => {
      started();
      await commitFailure;
      return originalCreateRanked(...args);
    };
    const queue = new MatchmakingManager(rooms, matches);
    const candidate = await queue.join(blue, 1000, "client-blue");
    const matching = queue.join(red, 1000, "client-red");
    await startedPromise;
    const provisional = await queue.join(red, 1000, "client-red");
    rejectCommit(new Error("storage unavailable"));
    await expect(matching).rejects.toThrow("storage unavailable");
    expect(queue.get(provisional.queueId, red.userId).status).toBe("CANCELLED");
    expect(queue.cancel(provisional.queueId, red.userId).status).toBe("CANCELLED");
    expect(queue.get(candidate.queueId, blue.userId).status).toBe("QUEUED");
    queue.stop();
    matches.stop();
  });

  it("rolls back a room and partial active locks when match admission fails after room creation", async () => {
    const rooms = new RoomManager();
    const matches = new MatchManager();
    const acquire = matches.acquireActiveLock.bind(matches);
    let lockCalls = 0;
    matches.acquireActiveLock = (room, userId, clientId) => {
      lockCalls += 1;
      if (lockCalls === 2) throw new Error("lock storage unavailable");
      acquire(room, userId, clientId);
    };
    const queue = new MatchmakingManager(rooms, matches);
    const candidate = await queue.join(blue, 1000, "client-blue");
    const matching = queue.join(red, 1000, "client-red");
    const provisional = await queue.join(red, 1000, "client-red");
    await expect(matching).rejects.toThrow("lock storage unavailable");
    expect(queue.get(provisional.queueId, red.userId).status).toBe("CANCELLED");
    expect(queue.get(candidate.queueId, blue.userId).status).toBe("QUEUED");
    expect(rooms.size()).toBe(0);
    expect(matches.isActiveLocked(blue.userId)).toBe(false);
    expect(matches.isActiveLocked(red.userId)).toBe(false);
    queue.stop();
    matches.stop();
  });

  it("widens the range and commits exactly one ranked room", async () => {
    let now = 10_000;
    const rooms = new RoomManager();
    const matches = new MatchManager(() => now);
    const queue = new MatchmakingManager(rooms, matches, () => now);
    const first = await queue.join(blue, 1000, "client-blue");
    expect(first.status).toBe("QUEUED");
    expect(first.range).toBe(100);
    now += 10_000;
    expect(queue.tick(first.queueId, blue.userId).range).toBe(150);
    const found = await queue.join(red, 1120, "client-red");
    expect(found.status).toBe("MATCHED");
    expect(found.roomId).toHaveLength(6);
    expect(found.opponent?.userId).toBe(blue.userId);
    const committed = queue.get(first.queueId, blue.userId);
    expect(committed.status).toBe("MATCHED");
    const room = rooms.search(found.roomId!, blue.userId);
    expect(room.mode).toBe("RANKED");
    expect(matches.isActiveLocked(blue.userId)).toBe(true);
    expect(matches.isActiveLocked(red.userId)).toBe(true);
  });

  it("cancels a queued entry but never cancels a committed match", async () => {
    const rooms = new RoomManager();
    const matches = new MatchManager();
    const queue = new MatchmakingManager(rooms, matches);
    const waiting = await queue.join(blue, 1000, "client-blue");
    expect(queue.cancel(waiting.queueId, blue.userId).status).toBe("CANCELLED");
    const first = await queue.join(blue, 1000, "client-blue");
    await queue.join(red, 1000, "client-red");
    expect(() => queue.cancel(first.queueId, blue.userId)).toThrowError(expect.objectContaining({ details: expect.objectContaining({ reason: "MATCH_ALREADY_COMMITTED" }) }));
  });
});
