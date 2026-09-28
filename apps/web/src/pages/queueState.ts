import type { MatchmakingEventEnvelope, MatchmakingSnapshot } from "@ottv2/contracts";

export type QueuePhase = "queued" | "found" | "cancelled";

export type QueueUiState = {
  phase: QueuePhase;
  queue: MatchmakingSnapshot;
  lastSequence: number;
};

export function queueStateFromSnapshot(queue: MatchmakingSnapshot, lastSequence = 0): QueueUiState {
  return {
    phase: queue.status === "MATCHED" ? "found" : queue.status === "CANCELLED" ? "cancelled" : "queued",
    queue,
    lastSequence,
  };
}

export function applyQueueEvent(current: QueueUiState, event: MatchmakingEventEnvelope): QueueUiState {
  if (event.sequence <= current.lastSequence) return current;
  if (current.phase === "found" && event.type !== "MATCH_FOUND") return { ...current, lastSequence: event.sequence };

  const phase: QueuePhase = event.type === "MATCH_FOUND" || event.payload.status === "MATCHED"
    ? "found"
    : event.type === "QUEUE_CANCELLED" || event.payload.status === "CANCELLED"
      ? "cancelled"
      : "queued";

  return { phase, queue: event.payload, lastSequence: event.sequence };
}

export function formatQueueElapsed(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function formatCountdown(endsAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}
