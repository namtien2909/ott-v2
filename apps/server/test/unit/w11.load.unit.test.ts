import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { MatchHistoryService } from "../../src/modules/history/history.service.js";
import { MatchmakingManager } from "../../src/modules/matchmaking/matchmaking.manager.js";
import { MatchManager } from "../../src/modules/match/match.manager.js";
import { RoomManager } from "../../src/modules/room/room.manager.js";

const blue = { userId: "w11-blue", username: "w11_blue", displayName: "Blue" };
const red = { userId: "w11-red", username: "w11_red", displayName: "Red" };

describe("W11 load and recovery evidence", () => {
  it("creates many rooms and pairs a queue within the local action budget", async () => {
    const rooms = new RoomManager();
    const matches = new MatchManager();
    const queue = new MatchmakingManager(rooms, matches);
    const started = performance.now();
    for (let index = 0; index < 100; index += 1) await rooms.create({ userId: `room-${index}`, username: `room_${index}`, displayName: `Room ${index}` }, { name: `Load ${index}`, visibility: "PUBLIC", timerSeconds: 30, spectatorsEnabled: false });
    await queue.join(blue, 1000, "w11-blue-client");
    const found = await queue.join(red, 1000, "w11-red-client");
    expect(found.status).toBe("MATCHED");
    expect(performance.now() - started).toBeLessThan(2_000);
  });

  it("keeps a DB burst retry queue safe until all records recover", async () => {
    let shouldFail = true;
    let writes = 0;
    const db = {
      $transaction: async (callback: (tx: unknown) => Promise<void>) => callback({ match: { findUnique: async () => null, create: async () => { if (shouldFail) throw new Error("db burst"); writes += 1; } } }),
    };
    const service = new MatchHistoryService(db as never);
    try {
      for (let index = 0; index < 100; index += 1) await service.record({ matchId: `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`, roomId: "ABC234", mode: "RANKED", status: "FINISHED", players: [{ userId: "u-blue", username: "blue", displayName: "Blue", side: "BLUE", ready: true, connected: false }, { userId: "u-red", username: "red", displayName: "Red", side: "RED", ready: true, connected: false }], board: {}, pieceCounts: { BLUE: { R: 3, P: 3, S: 3 }, RED: { R: 3, P: 3, S: 3 } }, currentTurn: null, winner: "BLUE", resultReason: "SURRENDER", clocksMs: { BLUE: 20_000, RED: 20_000 }, timerSeconds: 30, countdownEndsAt: null, startedAt: 1_000, endedAt: 2_000, sequence: 1, stateVersion: 1, rating: null });
      expect(service.pendingCount()).toBe(100);
      shouldFail = false;
      expect(await service.flush()).toBe(100);
      expect(writes).toBe(100);
      expect(service.pendingCount()).toBe(0);
    } finally { service.stop(); }
  });
});
