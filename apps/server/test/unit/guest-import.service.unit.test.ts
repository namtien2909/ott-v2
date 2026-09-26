import { describe, expect, it } from "vitest";
import { dedupeGuestRecords } from "../../src/modules/guest/guest-import.service.js";

const record = (localId: string) => ({ localId, mode: "GUEST" as const, result: "WIN" as const, playerName: "Xanh", opponentName: "Đỏ", timerSeconds: 60, durationSeconds: 12, endedAt: "2026-09-25T10:00:00.000Z", scoreDelta: 10 });

describe("GuestImportService", () => {
  it("deduplicates retries by localId before persistence", () => {
    expect(dedupeGuestRecords([record("00000000-0000-4000-8000-000000000001"), record("00000000-0000-4000-8000-000000000001"), record("00000000-0000-4000-8000-000000000002")])).toHaveLength(2);
  });
});
