import { describe, expect, it } from "vitest";
import type { MatchmakingEventEnvelope, MatchmakingSnapshot } from "@ottv2/contracts";
import { applyQueueEvent, formatCountdown, formatQueueElapsed, queueStateFromSnapshot } from "../../apps/web/src/pages/queueState";

const queue: MatchmakingSnapshot = {
  queueId: "00000000-0000-4000-8000-000000000005",
  mode: "RANKED",
  status: "QUEUED",
  player: { userId: "u1", username: "blue", displayName: "Blue", elo: 1426 },
  opponent: null,
  range: 100,
  elapsedMs: 18_000,
  joinedAt: 1_000,
  roomId: null,
  matchId: null,
};

function event(sequence: number, type: MatchmakingEventEnvelope["type"], payload: MatchmakingSnapshot): MatchmakingEventEnvelope {
  return {
    protocolVersion: "0.1",
    messageId: `00000000-0000-4000-8000-${sequence.toString().padStart(12, "0")}`,
    type,
    timestamp: 1_000 + sequence,
    queueId: payload.queueId,
    sequence,
    payload,
  };
}

describe("B4 queue state", () => {
  it("ignores events from another queue generation or mismatched payload generation", () => {
    const current = queueStateFromSnapshot(queue, 3);
    const anotherQueue = { ...queue, queueId: "00000000-0000-4000-8000-000000000099" };
    expect(applyQueueEvent(current, event(10, "QUEUE_CANCELLED", anotherQueue))).toBe(current);
    expect(applyQueueEvent(current, { ...event(10, "QUEUE_RANGE_UPDATED", queue), queueId: anotherQueue.queueId })).toBe(current);
  });

  it("does not reopen an acknowledged cancelled generation with a later search event", () => {
    const cancelled = queueStateFromSnapshot({ ...queue, status: "CANCELLED" }, 3);
    expect(applyQueueEvent(cancelled, event(4, "QUEUE_RANGE_UPDATED", queue))).toEqual({ ...cancelled, lastSequence: 4 });
  });

  it("formats tabular elapsed time and server countdown", () => {
    expect(formatQueueElapsed(78_000)).toBe("01:18");
    expect(formatCountdown(4_000, 1_001)).toBe(3);
    expect(formatCountdown(4_000, 4_001)).toBe(0);
  });

  it("ignores duplicate and stale queue events", () => {
    const current = queueStateFromSnapshot(queue);
    const widened = { ...queue, range: 150, elapsedMs: 20_000 };
    const next = applyQueueEvent(current, event(2, "QUEUE_RANGE_UPDATED", widened));
    expect(applyQueueEvent(next, event(2, "QUEUE_RANGE_UPDATED", { ...queue, range: 200 }))).toEqual(next);
    expect(applyQueueEvent(next, event(1, "QUEUE_JOINED", queue))).toEqual(next);
  });

  it("keeps the committed Match Found state ahead of late queue updates", () => {
    const current = queueStateFromSnapshot(queue);
    const matched: MatchmakingSnapshot = {
      ...queue,
      status: "MATCHED",
      opponent: { userId: "u2", username: "red", displayName: "Red", elo: 1451 },
      roomId: "AZ72KQ",
      matchId: "00000000-0000-4000-8000-000000000006",
    };
    const found = applyQueueEvent(current, event(3, "MATCH_FOUND", matched));
    expect(found.phase).toBe("found");
    expect(applyQueueEvent(found, event(4, "QUEUE_RANGE_UPDATED", { ...matched, status: "QUEUED" }))).toEqual({ ...found, lastSequence: 4 });
  });
});
