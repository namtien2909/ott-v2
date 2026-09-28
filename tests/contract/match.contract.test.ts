import { describe, expect, it } from "vitest";
import { HistoryListResponseSchema, JoinMatchmakingRequestSchema, MatchEventEnvelopeSchema, MatchmakingEventEnvelopeSchema, MatchSnapshotSchema, PieceMoveRequestSchema, PresenceEventSchema, SocialUserSchema } from "@ottv2/contracts";

describe("W4/W5 match contracts", () => {
  it("accepts canonical move commands and rejects invalid coordinates", () => {
    expect(PieceMoveRequestSchema.safeParse({ from: "b1", to: "b2", stateVersion: 3 }).success).toBe(true);
    expect(PieceMoveRequestSchema.safeParse({ from: "z1", to: "b2", stateVersion: 3 }).success).toBe(false);
  });

  it("keeps event envelopes versioned and snapshot-shaped", () => {
    const board = Object.fromEntries(Array.from({ length: 81 }, (_, index) => [`${String.fromCharCode(97 + (index % 9))}${Math.floor(index / 9) + 1}`, null]));
    const snapshot = { matchId: "00000000-0000-4000-8000-000000000001", roomId: "ABC234", mode: "UNRANKED", status: "WAITING_READY", players: [{ userId: "u1", username: "blue", displayName: "Blue", side: "BLUE", ready: false, connected: true }], board, pieceCounts: { BLUE: { R: 3, P: 3, S: 3 }, RED: { R: 3, P: 3, S: 3 } }, currentTurn: "BLUE", winner: null, resultReason: null, clocksMs: { BLUE: 30000, RED: 30000 }, timerSeconds: 30, countdownEndsAt: null, sequence: 1, stateVersion: 0, rating: null };
    expect(MatchSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(MatchEventEnvelopeSchema.safeParse({ protocolVersion: "0.1", messageId: "00000000-0000-4000-8000-000000000002", type: "MATCH_SNAPSHOT", timestamp: 1, roomId: "ABC234", matchId: snapshot.matchId, sequence: 1, stateVersion: 0, payload: snapshot }).success).toBe(true);
  });

  it("accepts reconnect and server-interruption event types", () => {
    const board = Object.fromEntries(Array.from({ length: 81 }, (_, index) => [`${String.fromCharCode(97 + (index % 9))}${Math.floor(index / 9) + 1}`, null]));
    const snapshot = { matchId: "00000000-0000-4000-8000-000000000003", roomId: "ABC234", mode: "RANKED", status: "ABORTED", players: [], board, pieceCounts: { BLUE: { R: 3, P: 3, S: 3 }, RED: { R: 3, P: 3, S: 3 } }, currentTurn: null, winner: null, resultReason: "SERVER_INTERRUPTION", clocksMs: { BLUE: 30000, RED: 30000 }, timerSeconds: 30, countdownEndsAt: null, sequence: 4, stateVersion: 2, rating: null };
    for (const type of ["PLAYER_DISCONNECTED", "PLAYER_RECONNECTED", "STATE_RESYNC", "MATCH_ABORTED"] as const) {
      expect(MatchEventEnvelopeSchema.safeParse({ protocolVersion: "0.1", messageId: "00000000-0000-4000-8000-000000000004", type, timestamp: 1, roomId: "ABC234", matchId: snapshot.matchId, sequence: 4, stateVersion: 2, payload: snapshot }).success).toBe(true);
    }
  });

  it("accepts Ranked queue commands and Match Found envelopes", () => {
    expect(JoinMatchmakingRequestSchema.safeParse({ mode: "RANKED" }).success).toBe(true);
    const queue = { queueId: "00000000-0000-4000-8000-000000000005", mode: "RANKED", status: "MATCHED", player: { userId: "u1", username: "blue", displayName: "Blue", elo: 1000 }, opponent: { userId: "u2", username: "red", displayName: "Red", elo: 1010 }, range: 150, elapsedMs: 10000, joinedAt: 1000, roomId: "QWERTY", matchId: "00000000-0000-4000-8000-000000000006" };
    expect(MatchmakingEventEnvelopeSchema.safeParse({ protocolVersion: "0.1", messageId: "00000000-0000-4000-8000-000000000007", type: "MATCH_FOUND", timestamp: 1, queueId: queue.queueId, sequence: 1, payload: queue }).success).toBe(true);
  });

  it("accepts history list projection contracts", () => {
    const player = { userId: "u1", username: "blue", displayName: "Blue", side: "BLUE" as const, isViewer: true, isWinner: true, ratingBefore: 1000, ratingAfter: 1016, ratingDelta: 16 };
    const card = { matchId: "00000000-0000-4000-8000-000000000001", roomId: "ABC234", mode: "RANKED" as const, status: "FINISHED" as const, result: "WIN" as const, resultReason: "SURRENDER" as const, winner: "BLUE" as const, viewer: player, opponent: { ...player, userId: "u2", username: "red", displayName: "Red", side: "RED" as const, isViewer: false, isWinner: false, ratingBefore: 1000, ratingAfter: 984, ratingDelta: -16 }, timerSeconds: 300, startedAt: new Date(0).toISOString(), endedAt: new Date(1000).toISOString(), durationSeconds: 1, ratingDelta: 16, finalBoard: null };
    expect(HistoryListResponseSchema.safeParse({ matches: [card], nextCursor: null, hasMore: false, summary: { elo: 1016, wins: 1, losses: 0, total: 1, winRate: 100 } }).success).toBe(true);
  });

  it("accepts friend-only presence event contracts", () => {
    const user = { userId: "u1", username: "blue", displayName: "Blue", presence: "IN_GAME" as const };
    expect(SocialUserSchema.safeParse({ ...user, elo: 1000, rankedWins: 1, rankedLosses: 0, isFriend: true, requestStatus: null }).success).toBe(true);
    expect(PresenceEventSchema.safeParse({ protocolVersion: "0.1", type: "FRIEND_PRESENCE_CHANGED", timestamp: 1, user }).success).toBe(true);
  });
});
