import { describe, expect, it } from "vitest";
import { GuestHistoryImportRequestSchema, GuestSessionRequestSchema } from "@ottv2/contracts";

describe("guest import contract", () => {
  it("accepts a bounded guest record and rejects non-guest modes", () => {
    const base = { localId: "00000000-0000-4000-8000-000000000001", mode: "GUEST", result: "WIN", playerName: "Xanh", opponentName: "Đỏ", timerSeconds: 60, durationSeconds: 12, endedAt: "2026-09-25T10:00:00.000Z", scoreDelta: 10 };
    expect(GuestHistoryImportRequestSchema.safeParse({ records: [base] }).success).toBe(true);
    expect(GuestHistoryImportRequestSchema.safeParse({ records: [{ ...base, mode: "AI" }] }).success).toBe(false);
  });

  it("requires a bounded browser profile/display name for a Guest session", () => {
    expect(GuestSessionRequestSchema.safeParse({ clientId: "browser-profile-123", displayName: "Khách Lam 123" }).success).toBe(true);
    expect(GuestSessionRequestSchema.safeParse({ clientId: "short", displayName: "Khách" }).success).toBe(false);
  });
});
