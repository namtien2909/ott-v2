import { describe, expect, it } from "vitest";
import { SpectatorAccessResponseSchema } from "@ottv2/contracts";

describe("spectator contract", () => {
  it("requires spectator role, null viewer side and a bounded count", () => {
    const result = SpectatorAccessResponseSchema.safeParse({ role: "SPECTATOR", viewerSide: null, spectatorCount: 4, room: { roomId: "ABC234", name: "Room", players: 2, playerCapacity: 2, waitingPlayerRating: null, mode: "UNRANKED", visibility: "PUBLIC", timerSeconds: 300, spectators: 4, spectatorsEnabled: true, spectatorCapacity: 10, status: "PLAYING", hostUserId: "u-host", isMember: false, requiresPassword: false, members: [{ userId: "u-host", username: "host_user", displayName: "Host", isHost: true }, { userId: "u-red", username: "red_user", displayName: "Red", isHost: false }] }, match: { matchId: "00000000-0000-4000-8000-000000000001", roomId: "ABC234", mode: "UNRANKED", status: "WAITING_READY", players: [], board: {}, pieceCounts: { BLUE: { R: 9, P: 9, S: 9 }, RED: { R: 9, P: 9, S: 9 } }, currentTurn: "BLUE", winner: null, resultReason: null, clocksMs: { BLUE: 300000, RED: 300000 }, timerSeconds: 300, countdownEndsAt: null, startedAt: null, endedAt: null, sequence: 0, stateVersion: 0, rating: null } });
    expect(result.success).toBe(true);
    expect(SpectatorAccessResponseSchema.safeParse({ role: "PLAYER", viewerSide: "BLUE" }).success).toBe(false);
  });
});
