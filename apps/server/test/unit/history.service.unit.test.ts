import { describe, expect, it, vi } from "vitest";

import { MatchHistoryService, toHistoryCard, toMatchProjection } from "../../src/modules/history/history.service.js";
import type { MatchSnapshot } from "@ottv2/contracts";

const snapshot: MatchSnapshot = {
  matchId: "00000000-0000-4000-8000-000000000101",
  roomId: "ABC234",
  mode: "RANKED",
  status: "FINISHED",
  players: [
    { userId: "u-blue", username: "blue", displayName: "Blue", side: "BLUE", ready: true, connected: false },
    { userId: "u-red", username: "red", displayName: "Red", side: "RED", ready: true, connected: false },
  ],
  board: {},
  pieceCounts: { BLUE: { R: 3, P: 3, S: 3 }, RED: { R: 3, P: 3, S: 3 } },
  currentTurn: null,
  winner: "BLUE",
  resultReason: "SURRENDER",
  clocksMs: { BLUE: 20_000, RED: 10_000 },
  timerSeconds: 30,
  countdownEndsAt: null,
  startedAt: 1_000,
  endedAt: 4_000,
  sequence: 4,
  stateVersion: 2,
  rating: { blueBefore: 1000, blueAfter: 1016, blueDelta: 16, redBefore: 1000, redAfter: 984, redDelta: -16 },
};

describe("W7 MatchHistoryService", () => {
  it("projects a finished match into a card without turning server interruption into a loss", () => {
    const data = toMatchProjection(snapshot);
    expect(data.id).toBe(snapshot.matchId);
    expect(data.players).toMatchObject({ create: expect.arrayContaining([expect.objectContaining({ userId: "u-blue", isWinner: true, ratingDelta: 16 })]) });
    const row = {
      id: snapshot.matchId, roomId: snapshot.roomId, mode: snapshot.mode, status: "FINISHED", resultReason: snapshot.resultReason, winnerSide: snapshot.winner, timerSeconds: 30,
      startedAt: new Date(1_000), endedAt: new Date(4_000), durationSeconds: 3, createdAt: new Date(1_000), players: [
        { id: "p1", matchId: snapshot.matchId, userId: "u-blue", username: "blue", displayName: "Blue", side: "BLUE", isWinner: true, ratingBefore: 1000, ratingAfter: 1016, ratingDelta: 16 },
        { id: "p2", matchId: snapshot.matchId, userId: "u-red", username: "red", displayName: "Red", side: "RED", isWinner: false, ratingBefore: 1000, ratingAfter: 984, ratingDelta: -16 },
      ],
    };
    expect(toHistoryCard(row, "u-blue")).toMatchObject({ result: "WIN", durationSeconds: 3, ratingDelta: 16 });
    expect(toHistoryCard({ ...row, status: "ABORTED", resultReason: "SERVER_INTERRUPTION", winnerSide: null }, "u-blue").result).toBe("ABORTED");
  });

  it("queues a DB failure and flushes exactly once after recovery", async () => {
    let shouldFail = true;
    let writes = 0;
    const db = {
      $transaction: async (callback: (tx: unknown) => Promise<void>) => callback({ match: { findUnique: async () => null, create: async () => { if (shouldFail) throw new Error("db down"); writes += 1; } } }),
    };
    const service = new MatchHistoryService(db as never);
    try {
      await service.record(snapshot);
      expect(service.pendingCount()).toBe(1);
      shouldFail = false;
      expect(await service.flush()).toBe(1);
      expect(writes).toBe(1);
      expect(service.pendingCount()).toBe(0);
      expect(await service.flush()).toBe(0);
    } finally {
      service.stop();
    }
  });

  it("uses matchId as an idempotency key and protects detail privacy", async () => {
    let created = false;
    let writes = 0;
    const row = {
      id: snapshot.matchId, roomId: snapshot.roomId, mode: snapshot.mode, status: "FINISHED", resultReason: snapshot.resultReason, winnerSide: snapshot.winner, timerSeconds: 30,
      startedAt: new Date(1_000), endedAt: new Date(4_000), durationSeconds: 3, createdAt: new Date(1_000), players: [
        { id: "p1", matchId: snapshot.matchId, userId: "u-blue", username: "blue", displayName: "Blue", side: "BLUE", isWinner: true, ratingBefore: 1000, ratingAfter: 1016, ratingDelta: 16 },
        { id: "p2", matchId: snapshot.matchId, userId: "u-red", username: "red", displayName: "Red", side: "RED", isWinner: false, ratingBefore: 1000, ratingAfter: 984, ratingDelta: -16 },
      ],
    };
    const db = {
      $transaction: async (callback: (tx: unknown) => Promise<void>) => callback({ match: { findUnique: async () => created ? row : null, create: async () => { created = true; writes += 1; } } }),
      match: { findMany: vi.fn(async () => [row]), findUnique: vi.fn(async () => row) },
      userStats: { findUnique: vi.fn(async () => ({ elo: 1016 })) },
    };
    const service = new MatchHistoryService(db as never);
    try {
      await service.record(snapshot);
      await service.record(snapshot);
      expect(writes).toBe(1);
      const page = await service.list("u-blue", { mode: "RANKED", result: "WIN", range: "ALL", limit: 20 });
      expect(page.matches[0]).toMatchObject({ matchId: snapshot.matchId, result: "WIN" });
      await expect(service.detail("not-a-member", snapshot.matchId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    } finally {
      service.stop();
    }
  });
});
