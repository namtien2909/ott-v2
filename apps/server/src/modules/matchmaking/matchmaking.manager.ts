import { randomUUID } from "node:crypto";
import type { MatchmakingEventEnvelope, MatchmakingEventType, MatchmakingPlayer, MatchmakingSnapshot } from "@ottv2/contracts";

import { AppError } from "../../shared/errors/app-error.js";
import { MatchManager, type MatchActor } from "../match/match.manager.js";
import { RoomManager, type RoomActor } from "../room/room.manager.js";

type QueueListener = (event: MatchmakingEventEnvelope) => void;
type QueueEntry = {
  queueId: string;
  actor: MatchActor;
  clientId: string;
  elo: number;
  joinedAt: number;
  status: MatchmakingSnapshot["status"];
  opponent: MatchmakingPlayer | null;
  roomId: string | null;
  matchId: string | null;
  sequence: number;
};

const BASE_RANGE = 100;
const RANGE_STEP = 50;
const RANGE_STEP_MS = 10_000;
const MAX_RANGE = 1_000;

export class MatchmakingManager {
  private readonly entries = new Map<string, QueueEntry>();
  private readonly byUser = new Map<string, string>();
  private readonly listeners = new Map<string, Set<QueueListener>>();
  private readonly now: () => number;

  constructor(private readonly rooms: RoomManager, private readonly matches: MatchManager, now: () => number = Date.now) {
    this.now = now;
  }

  async join(actor: MatchActor, elo: number, clientId = "server"): Promise<MatchmakingSnapshot> {
    if (this.matches.isActiveLocked(actor.userId)) throw new AppError("CONFLICT", "Tài khoản đang tham gia một trận đấu khác.", 409, false, "INVALID", { reason: "ACTIVE_GAME_EXISTS" });
    const existingId = this.byUser.get(actor.userId);
    if (existingId) {
      const existing = this.entries.get(existingId);
      if (existing?.status === "MATCHED") return this.snapshot(existing);
      if (existing?.status === "QUEUED" && existing.clientId === clientId) return this.snapshot(existing);
      throw new AppError("CONFLICT", "Bạn đã ở trong hàng chờ tìm trận.", 409, false, "INVALID", { reason: "MATCHMAKING_ALREADY_QUEUED", queueId: existingId });
    }
    const entry: QueueEntry = { queueId: randomUUID(), actor, clientId, elo: Math.max(0, Math.round(elo)), joinedAt: this.now(), status: "QUEUED", opponent: null, roomId: null, matchId: null, sequence: 0 };
    const candidate = [...this.entries.values()].find((item) => item.status === "QUEUED" && item.actor.userId !== actor.userId && Math.abs(item.elo - entry.elo) <= Math.max(this.range(item), this.range(entry)));
    if (!candidate) {
      this.entries.set(entry.queueId, entry);
      this.byUser.set(actor.userId, entry.queueId);
      this.emit(entry, "QUEUE_JOINED");
      return this.snapshot(entry);
    }
    this.entries.delete(candidate.queueId);
    this.byUser.delete(candidate.actor.userId);
    if (this.matches.isActiveLocked(candidate.actor.userId)) throw new AppError("CONFLICT", "Đối thủ vừa tham gia một trận đấu khác.", 409, true, "RECOVERABLE", { reason: "ACTIVE_GAME_EXISTS" });
    const rankedRoom = await this.rooms.createRanked(this.roomActor(candidate), this.roomActor(entry));
    const match = this.matches.ensure(rankedRoom);
    this.matches.acquireActiveLock(rankedRoom, candidate.actor.userId, candidate.clientId);
    this.matches.acquireActiveLock(rankedRoom, actor.userId, clientId);
    candidate.status = "MATCHED";
    candidate.opponent = this.playerOf(entry);
    candidate.roomId = rankedRoom.roomId;
    candidate.matchId = match.matchId;
    candidate.sequence = 0;
    entry.status = "MATCHED";
    entry.opponent = this.playerOf(candidate);
    entry.roomId = rankedRoom.roomId;
    entry.matchId = match.matchId;
    entry.sequence = 0;
    this.entries.set(candidate.queueId, candidate);
    this.entries.set(entry.queueId, entry);
    this.byUser.set(candidate.actor.userId, candidate.queueId);
    this.byUser.set(actor.userId, entry.queueId);
    this.emit(candidate, "MATCH_FOUND");
    this.emit(entry, "MATCH_FOUND");
    return this.snapshot(entry);
  }

  get(queueId: string, userId: string): MatchmakingSnapshot {
    const entry = this.entries.get(queueId);
    if (!entry || entry.actor.userId !== userId) throw new AppError("NOT_FOUND", "Không tìm thấy hàng chờ.", 404, false, "INVALID");
    return this.snapshot(entry);
  }

  cancel(queueId: string, userId: string): MatchmakingSnapshot {
    const entry = this.entries.get(queueId);
    if (!entry || entry.actor.userId !== userId) throw new AppError("NOT_FOUND", "Không tìm thấy hàng chờ.", 404, false, "INVALID");
    if (entry.status === "MATCHED") throw new AppError("CONFLICT", "Đối thủ đã được ghép trận; không thể huỷ tìm trận.", 409, false, "INVALID", { reason: "MATCH_ALREADY_COMMITTED", roomId: entry.roomId, matchId: entry.matchId });
    if (entry.status === "CANCELLED") return this.snapshot(entry);
    entry.status = "CANCELLED";
    this.byUser.delete(userId);
    this.emit(entry, "QUEUE_CANCELLED");
    return this.snapshot(entry);
  }

  subscribe(queueId: string, listener: QueueListener): () => void {
    const listeners = this.listeners.get(queueId) ?? new Set<QueueListener>();
    listeners.add(listener);
    this.listeners.set(queueId, listeners);
    return () => { listeners.delete(listener); if (listeners.size === 0) this.listeners.delete(queueId); };
  }

  snapshotEvent(queueId: string, userId: string): MatchmakingEventEnvelope {
    const entry = this.entries.get(queueId);
    if (!entry || entry.actor.userId !== userId) throw new AppError("NOT_FOUND", "Không tìm thấy hàng chờ.", 404, false, "INVALID");
    return this.event(entry, "QUEUE_JOINED", false);
  }

  tick(queueId: string, userId: string): MatchmakingSnapshot {
    const entry = this.entries.get(queueId);
    if (!entry || entry.actor.userId !== userId) throw new AppError("NOT_FOUND", "Không tìm thấy hàng chờ.", 404, false, "INVALID");
    if (entry.status === "QUEUED") this.emit(entry, "QUEUE_RANGE_UPDATED");
    return this.snapshot(entry);
  }

  stop(): void {
    this.entries.clear();
    this.byUser.clear();
    this.listeners.clear();
  }

  private range(entry: QueueEntry): number {
    return Math.min(MAX_RANGE, BASE_RANGE + Math.floor(Math.max(0, this.now() - entry.joinedAt) / RANGE_STEP_MS) * RANGE_STEP);
  }

  private snapshot(entry: QueueEntry): MatchmakingSnapshot {
    return {
      queueId: entry.queueId,
      mode: "RANKED",
      status: entry.status,
      player: this.playerOf(entry),
      opponent: entry.opponent,
      range: this.range(entry),
      elapsedMs: Math.max(0, this.now() - entry.joinedAt),
      joinedAt: entry.joinedAt,
      roomId: entry.roomId,
      matchId: entry.matchId,
    };
  }

  private playerOf(entry: QueueEntry): MatchmakingPlayer {
    return { userId: entry.actor.userId, username: entry.actor.username, displayName: entry.actor.displayName, elo: entry.elo };
  }

  private roomActor(entry: QueueEntry): RoomActor {
    return { ...entry.actor, rating: entry.elo };
  }

  private emit(entry: QueueEntry, type: MatchmakingEventType): void {
    entry.sequence += 1;
    const event = this.event(entry, type, true);
    for (const listener of this.listeners.get(entry.queueId) ?? []) listener(event);
  }

  private event(entry: QueueEntry, type: MatchmakingEventType, useSequence: boolean): MatchmakingEventEnvelope {
    const event: MatchmakingEventEnvelope = {
      protocolVersion: "0.1",
      messageId: randomUUID(),
      type,
      timestamp: this.now(),
      queueId: entry.queueId,
      sequence: useSequence ? entry.sequence : Math.max(1, entry.sequence),
      payload: this.snapshot(entry),
    };
    return event;
  }
}

export { BASE_RANGE, MAX_RANGE, RANGE_STEP, RANGE_STEP_MS };
