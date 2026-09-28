import { randomUUID } from "node:crypto";
import type { MatchEventEnvelope, MatchEventType, MatchRating, MatchSnapshot, RoomDetail } from "@ottv2/contracts";
import { applyMove, createInitialState, type Coordinate, type RuleState, type Side } from "@ottv2/game-rules";

import { AppError } from "../../shared/errors/app-error.js";

export type MatchActor = { userId: string; username: string; displayName: string };
type MatchPlayerState = MatchActor & { side: Side; ready: boolean; connected: boolean };
type MatchState = {
  matchId: string;
  roomId: string;
  hostUserId: string;
  mode: MatchSnapshot["mode"];
  timerSeconds: number;
  players: MatchPlayerState[];
  ruleState: RuleState;
  status: MatchSnapshot["status"];
  clocksMs: Record<Side, number>;
  countdownEndsAt: number | null;
  turnStartedAt: number | null;
  startedAt: number | null;
  endedAt: number | null;
  sequence: number;
  stateVersion: number;
  resultReason: MatchSnapshot["resultReason"];
  winner: Side | null;
  rating: MatchRating | null;
  rematchRequests: Set<string>;
  fastReadyUsers: Set<string>;
};

type MatchListener = (envelope: MatchEventEnvelope) => void;
type ActiveGameLock = { roomId: string; matchId: string; clientId: string; acquiredAt: number };

export class MatchManager {
  private readonly matches = new Map<string, MatchState>();
  private readonly listeners = new Map<string, Set<MatchListener>>();
  private readonly spectatorListeners = new Map<string, Set<MatchListener>>();
  private readonly connections = new Map<string, Map<string, Set<string>>>();
  private readonly disconnectTimers = new Map<string, Map<string, NodeJS.Timeout>>();
  private readonly activeLocks = new Map<string, ActiveGameLock>();
  private readonly now: () => number;
  private readonly graceMs: number;

  constructor(now: () => number = Date.now, graceMs = 30_000) {
    this.now = now;
    this.graceMs = graceMs;
  }

  ensure(room: RoomDetail): MatchSnapshot {
    if (room.members.length === 0) throw new AppError("CONFLICT", "Phòng chưa có người chơi.", 409, false, "INVALID", { reason: "NO_PLAYERS" });
    let match = this.matches.get(room.roomId);
    if (!match) {
      const timerMs = room.timerSeconds * 1000;
      match = {
        matchId: randomUUID(),
        roomId: room.roomId,
        hostUserId: room.hostUserId ?? room.members[0]?.userId ?? "",
        mode: room.mode,
        timerSeconds: room.timerSeconds,
        players: [],
        ruleState: createInitialState(),
        status: "WAITING_READY",
        clocksMs: { BLUE: timerMs, RED: timerMs },
        countdownEndsAt: null,
        turnStartedAt: null,
        startedAt: null,
        endedAt: null,
        sequence: 0,
        stateVersion: 0,
        resultReason: null,
        winner: null,
        rating: null,
        rematchRequests: new Set(),
        fastReadyUsers: new Set(),
      };
      this.matches.set(room.roomId, match);
    }
    if (!match) throw new AppError("INTERNAL_ERROR", "Match state chưa sẵn sàng.", 500, true, "RECOVERABLE");
    match.hostUserId = room.hostUserId ?? room.members[0]?.userId ?? match.hostUserId;
    this.syncPlayers(match, room);
    this.advance(match);
    return this.snapshot(match);
  }

  getViewerSide(room: RoomDetail, userId: string): Side | null {
    const player = this.ensure(room).players.find((item) => item.userId === userId);
    return player?.side ?? null;
  }

  subscribe(roomId: string, listener: MatchListener): () => void {
    const listeners = this.listeners.get(roomId) ?? new Set<MatchListener>();
    listeners.add(listener);
    this.listeners.set(roomId, listeners);
    return () => { listeners.delete(listener); if (listeners.size === 0) this.listeners.delete(roomId); };
  }

  subscribeSpectator(roomId: string, listener: MatchListener): () => void {
    const listeners = this.spectatorListeners.get(roomId) ?? new Set<MatchListener>();
    listeners.add(listener);
    this.spectatorListeners.set(roomId, listeners);
    return () => { listeners.delete(listener); if (listeners.size === 0) this.spectatorListeners.delete(roomId); };
  }

  spectatorListenerCount(roomId: string): number {
    return this.spectatorListeners.get(roomId)?.size ?? 0;
  }

  acquireActiveLock(room: RoomDetail, userId: string, clientId = "server"): void {
    const match = this.getMatch(room);
    if (match.status === "FINISHED" || match.status === "ABORTED") return;
    const existing = this.activeLocks.get(userId);
    if (existing && (existing.roomId !== room.roomId || existing.clientId !== clientId)) {
      throw new AppError("CONFLICT", "Tài khoản đang có một match hoạt động ở nơi khác.", 409, false, "INVALID", { reason: "ACTIVE_GAME_LOCK", roomId: existing.roomId, matchId: existing.matchId });
    }
    this.activeLocks.set(userId, { roomId: room.roomId, matchId: match.matchId, clientId, acquiredAt: this.now() });
  }

  isActiveLocked(userId: string): boolean {
    return this.activeLocks.has(userId);
  }

  connect(room: RoomDetail, userId: string, clientId = "server"): void {
    const match = this.getMatch(room);
    const roomConnections = this.connections.get(room.roomId) ?? new Map<string, Set<string>>();
    const userConnections = roomConnections.get(userId) ?? new Set<string>();
    const roomTimers = this.disconnectTimers.get(room.roomId);
    const wasDisconnected = roomTimers?.has(userId) ?? false;
    const timer = roomTimers?.get(userId);
    if (timer) clearTimeout(timer);
    roomTimers?.delete(userId);
    userConnections.add(clientId);
    roomConnections.set(userId, userConnections);
    this.connections.set(room.roomId, roomConnections);
    const player = this.player(match, userId);
    player.connected = true;
    if (wasDisconnected) {
      this.emit(match, "PLAYER_RECONNECTED");
      this.emit(match, "STATE_RESYNC");
    }
  }

  disconnect(room: RoomDetail, userId: string, clientId = "server"): void {
    const match = this.getMatch(room);
    const roomConnections = this.connections.get(room.roomId);
    const userConnections = roomConnections?.get(userId);
    userConnections?.delete(clientId);
    if (userConnections && userConnections.size > 0) return;
    roomConnections?.delete(userId);
    const player = match.players.find((item) => item.userId === userId);
    if (!player) return;
    if (match.status === "WAITING_READY") {
      player.connected = false;
      this.releaseLock(userId, room.roomId, clientId);
      return;
    }
    if (match.status !== "COUNTDOWN" && match.status !== "PLAYING") return;
    player.connected = false;
    this.emit(match, "PLAYER_DISCONNECTED");
    const timers = this.disconnectTimers.get(room.roomId) ?? new Map<string, NodeJS.Timeout>();
    const timer = setTimeout(() => this.expireDisconnect(room.roomId, userId), this.graceMs);
    timers.set(userId, timer);
    this.disconnectTimers.set(room.roomId, timers);
  }

  stop(): void {
    for (const timers of this.disconnectTimers.values()) for (const timer of timers.values()) clearTimeout(timer);
    this.disconnectTimers.clear();
    this.connections.clear();
    this.listeners.clear();
    this.spectatorListeners.clear();
    this.activeLocks.clear();
  }

  snapshotEvent(room: RoomDetail): MatchEventEnvelope {
    const match = this.getMatch(room);
    return this.createEnvelope(match, "MATCH_SNAPSHOT");
  }

  setRating(room: RoomDetail, rating: MatchRating): MatchSnapshot {
    const match = this.getMatch(room);
    match.rating = rating;
    this.emit(match, "RATING_UPDATED");
    return this.snapshot(match);
  }

  tick(room: RoomDetail): MatchSnapshot {
    const match = this.getMatch(room);
    this.advance(match, true);
    return this.snapshot(match);
  }

  ready(room: RoomDetail, actor: MatchActor, ready: boolean): MatchSnapshot {
    const match = this.getMatch(room);
    const player = this.player(match, actor.userId);
    if (match.status !== "WAITING_READY" && match.status !== "COUNTDOWN") throw this.invalidState("ready", match.status);
    player.ready = ready;
    if (!ready) { match.status = "WAITING_READY"; match.countdownEndsAt = null; match.turnStartedAt = null; match.fastReadyUsers.clear(); }
    this.emit(match, "PLAYER_READY");
    if (match.players.length === 2 && match.players.every((item) => item.ready) && match.status === "WAITING_READY") {
      match.status = "COUNTDOWN";
      match.countdownEndsAt = this.now() + 3000;
      match.fastReadyUsers.clear();
      match.stateVersion += 1;
      this.emit(match, "COUNTDOWN_STARTED");
    }
    return this.snapshot(match);
  }

  fastReady(room: RoomDetail, actor: MatchActor): MatchSnapshot {
    const match = this.getMatch(room);
    if (match.status !== "COUNTDOWN") throw this.invalidState("fast-ready", match.status);
    this.player(match, actor.userId);
    match.fastReadyUsers.add(actor.userId);
    if (match.players.length === 2 && match.players.every((player) => match.fastReadyUsers.has(player.userId))) {
      match.countdownEndsAt = this.now();
      this.advance(match);
    }
    return this.snapshot(match);
  }
  move(room: RoomDetail, actor: MatchActor, from: Coordinate, to: Coordinate, stateVersion: number): MatchSnapshot {
    const match = this.getMatch(room);
    this.advance(match, true);
    const player = this.player(match, actor.userId);
    this.assertVersion(match, stateVersion);
    if (match.status !== "PLAYING") throw this.invalidState("move", match.status);
    if (match.ruleState.currentTurn !== player.side) throw new AppError("CONFLICT", "Chưa tới lượt của bạn.", 409, false, "INVALID", { reason: "WRONG_TURN", event: "PIECE_MOVE_REJECTED" });
    const result = applyMove(match.ruleState, { side: player.side, from, to });
    if (result.kind === "rejected") {
      this.emit(match, "PIECE_MOVE_REJECTED");
      throw new AppError("VALIDATION_ERROR", "Nước đi không hợp lệ.", 400, false, "INVALID", { reason: "MOVE_REJECTED", moveCode: result.error.code, event: "PIECE_MOVE_REJECTED" });
    }
    match.ruleState = result.state;
    match.stateVersion += 1;
    match.turnStartedAt = this.now();
    if (result.state.status === "FINISHED") {
      match.status = "FINISHED";
      match.winner = result.state.winner;
      match.resultReason = result.state.resultReason;
      match.endedAt = this.now();
      this.releaseLocks(match.roomId);
    }
    this.emit(match, "PIECE_MOVE_ACCEPTED");
    if (match.status === "FINISHED") this.emit(match, "MATCH_FINISHED");
    return this.snapshot(match);
  }

  surrender(room: RoomDetail, actor: MatchActor, stateVersion: number): MatchSnapshot {
    const match = this.getMatch(room);
    this.advance(match, true);
    const player = this.player(match, actor.userId);
    this.assertVersion(match, stateVersion);
    if (match.status !== "PLAYING") throw this.invalidState("surrender", match.status);
    this.finish(match, player.side === "BLUE" ? "RED" : "BLUE", "SURRENDER");
    this.emit(match, "PLAYER_SURRENDERED");
    this.emit(match, "MATCH_FINISHED");
    return this.snapshot(match);
  }

  rematch(room: RoomDetail, actor: MatchActor, stateVersion: number): MatchSnapshot {
    const match = this.getMatch(room);
    const player = this.player(match, actor.userId);
    this.assertVersion(match, stateVersion);
    if (match.status !== "FINISHED") throw this.invalidState("rematch", match.status);
    match.rematchRequests.add(player.userId);
    this.emit(match, "REMATCH_REQUESTED");
    if (match.players.length === 2 && match.rematchRequests.size === 2) {
      match.matchId = randomUUID();
      match.ruleState = createInitialState();
      match.status = "WAITING_READY";
      match.clocksMs = { BLUE: match.timerSeconds * 1000, RED: match.timerSeconds * 1000 };
      match.countdownEndsAt = null;
      match.turnStartedAt = null;
      match.winner = null;
      match.resultReason = null;
      match.rating = null;
      match.startedAt = null;
      match.endedAt = null;
      match.rematchRequests.clear();
      match.fastReadyUsers.clear();
      match.players.forEach((item) => { item.ready = false; });
      match.stateVersion = 0;
      this.emit(match, "MATCH_SNAPSHOT");
    }
    return this.snapshot(match);
  }

  size(): number { return this.matches.size; }

  private getMatch(room: RoomDetail): MatchState {
    this.ensure(room);
    const match = this.matches.get(room.roomId);
    if (!match) throw new AppError("INTERNAL_ERROR", "Match state chưa sẵn sàng.", 500, true, "RECOVERABLE");
    return match;
  }

  private syncPlayers(match: MatchState, room: RoomDetail): void {
    const members = room.members.slice(0, 2);
    for (const [index, member] of members.entries()) {
      const side: Side = member.userId === room.hostUserId || index === 0 ? "BLUE" : "RED";
      const existing = match.players.find((item) => item.userId === member.userId);
      if (existing) { existing.username = member.username; existing.displayName = member.displayName; existing.side = side; continue; }
      match.players.push({ userId: member.userId, username: member.username, displayName: member.displayName, side, ready: false, connected: false });
      if (match.players.length > 2) match.players.splice(2);
    }
  }

  private player(match: MatchState, userId: string): MatchPlayerState {
    const player = match.players.find((item) => item.userId === userId);
    if (!player) throw new AppError("UNAUTHORIZED", "Bạn không phải người chơi của match này.", 403, false, "FATAL_SESSION", { reason: "NOT_MATCH_MEMBER" });
    return player;
  }

  private assertVersion(match: MatchState, stateVersion: number): void {
    if (stateVersion !== match.stateVersion) throw new AppError("CONFLICT", "Trạng thái bàn cờ đã thay đổi, hãy đồng bộ lại.", 409, true, "RECOVERABLE", { reason: "STALE_STATE", stateVersion: match.stateVersion, event: "STATE_RESYNC" });
  }

  private invalidState(command: string, status: MatchState["status"]): AppError {
    return new AppError("CONFLICT", `Không thể thực hiện ${command} ở trạng thái ${status}.`, 409, false, "INVALID", { reason: "INVALID_MATCH_STATE", status });
  }

  private advance(match: MatchState, emitClock = false): void {
    const now = this.now();
    if (match.status === "COUNTDOWN" && match.countdownEndsAt !== null && now >= match.countdownEndsAt) {
      match.status = "PLAYING";
      match.countdownEndsAt = null;
      match.turnStartedAt = now;
      match.startedAt = now;
      match.stateVersion += 1;
      this.emit(match, "MATCH_STARTED");
    }
    if (match.status !== "PLAYING" || match.turnStartedAt === null || match.ruleState.currentTurn === null) return;
    const elapsed = Math.max(0, now - match.turnStartedAt);
    if (elapsed === 0) return;
    const side = match.ruleState.currentTurn;
    match.clocksMs[side] = Math.max(0, match.clocksMs[side] - elapsed);
    match.turnStartedAt = now;
    if (match.clocksMs[side] === 0) {
      this.finish(match, side === "BLUE" ? "RED" : "BLUE", "TIMEOUT");
      this.emit(match, "MATCH_FINISHED");
      return;
    }
    if (emitClock) this.emit(match, "CLOCK_TICK");
  }

  private finish(match: MatchState, winner: Side, reason: "TIMEOUT" | "SURRENDER"): void {
    match.status = "FINISHED";
    match.winner = winner;
    match.resultReason = reason;
    match.ruleState = { ...match.ruleState, status: "FINISHED", currentTurn: null, winner, resultReason: reason === "TIMEOUT" || reason === "SURRENDER" ? null : reason };
    match.stateVersion += 1;
    match.turnStartedAt = null;
    match.endedAt = this.now();
    this.releaseLocks(match.roomId);
  }

  private expireDisconnect(roomId: string, userId: string): void {
    const match = this.matches.get(roomId);
    const roomTimers = this.disconnectTimers.get(roomId);
    roomTimers?.delete(userId);
    if (!match || (match.status !== "COUNTDOWN" && match.status !== "PLAYING") || this.connections.get(roomId)?.get(userId)?.size) return;
    match.status = "ABORTED";
    match.winner = null;
    match.resultReason = "SERVER_INTERRUPTION";
    match.ruleState = { ...match.ruleState, status: "FINISHED", currentTurn: null, winner: null, resultReason: null };
    match.stateVersion += 1;
    match.turnStartedAt = null;
    match.endedAt = this.now();
    this.releaseLocks(roomId);
    this.emit(match, "MATCH_ABORTED");
  }

  private releaseLocks(roomId: string): void {
    for (const [userId, lock] of this.activeLocks.entries()) if (lock.roomId === roomId) this.activeLocks.delete(userId);
  }

  private releaseLock(userId: string, roomId: string, clientId: string): void {
    const lock = this.activeLocks.get(userId);
    if (lock?.roomId === roomId && lock.clientId === clientId) this.activeLocks.delete(userId);
  }

  private snapshot(match: MatchState): MatchSnapshot {
    return {
      matchId: match.matchId,
      roomId: match.roomId,
      hostUserId: match.hostUserId,
      mode: match.mode,
      status: match.status,
      players: match.players.map(({ userId, username, displayName, side, ready, connected }) => ({ userId, username, displayName, side, ready, connected })),
      board: match.ruleState.board,
      pieceCounts: match.ruleState.pieceCounts,
      currentTurn: match.ruleState.currentTurn,
      winner: match.winner,
      resultReason: match.resultReason,
      clocksMs: { ...match.clocksMs },
      timerSeconds: match.timerSeconds,
      countdownEndsAt: match.countdownEndsAt,
      ...(match.startedAt !== null ? { startedAt: match.startedAt } : { startedAt: null }),
      ...(match.endedAt !== null ? { endedAt: match.endedAt } : { endedAt: null }),
      sequence: match.sequence,
      stateVersion: match.stateVersion,
      rating: match.rating,
    };
  }

  private emit(match: MatchState, type: MatchEventType): void {
    match.sequence += 1;
    const envelope = this.createEnvelope(match, type);
    for (const listener of this.listeners.get(match.roomId) ?? []) listener(envelope);
    for (const listener of this.spectatorListeners.get(match.roomId) ?? []) listener(envelope);
  }

  private createEnvelope(match: MatchState, type: MatchEventType): MatchEventEnvelope {
    return {
      protocolVersion: "0.1",
      messageId: randomUUID(),
      type,
      timestamp: this.now(),
      roomId: match.roomId,
      matchId: match.matchId,
      sequence: match.sequence,
      stateVersion: match.stateVersion,
      payload: this.snapshot(match),
    };
  }
}
