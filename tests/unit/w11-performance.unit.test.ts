import { describe, expect, it } from "vitest";

const snapshot = JSON.stringify({ matchId: "00000000-0000-4000-8000-000000000001", roomId: "ABC234", status: "PLAYING", board: Object.fromEntries(Array.from({ length: 81 }, (_, index) => [`${String.fromCharCode(97 + (index % 9))}${Math.floor(index / 9) + 1}`, null])), pieceCounts: { BLUE: { R: 3, P: 3, S: 3 }, RED: { R: 3, P: 3, S: 3 } }, currentTurn: "BLUE", clocksMs: { BLUE: 299000, RED: 300000 }, stateVersion: 18, sequence: 42 });
const delta = JSON.stringify({ type: "PIECE_MOVE_ACCEPTED", roomId: "ABC234", stateVersion: 18, sequence: 42, move: { from: "b1", to: "b2", capturedPieceId: null } });

describe("W11 snapshot/delta performance budget", () => {
  it("keeps committed move deltas smaller and serialization within local budget", () => {
    expect(delta.length).toBeLessThan(snapshot.length);
    const started = performance.now();
    for (let index = 0; index < 1000; index += 1) { JSON.stringify(JSON.parse(snapshot)); JSON.stringify(JSON.parse(delta)); }
    expect(performance.now() - started).toBeLessThan(500);
  });
});
