import { describe, expect, it } from "vitest";

import { MatchManager } from "../../src/modules/match/match.manager.js";
import { MatchmakingManager } from "../../src/modules/matchmaking/matchmaking.manager.js";
import { RoomManager } from "../../src/modules/room/room.manager.js";

const blue = { userId: "queue-blue", username: "queue_blue", displayName: "Queue Blue" };
const red = { userId: "queue-red", username: "queue_red", displayName: "Queue Red" };

describe("W6 MatchmakingManager", () => {
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
