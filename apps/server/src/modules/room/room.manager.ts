import type { CreateRoomRequest, JoinRoomRequest, RoomDetail, RoomSummary, SpectateRoomRequest } from "@ottv2/contracts";

import { AppError } from "../../shared/errors/app-error.js";
import { hashSecret, verifySecret } from "../auth/auth.crypto.js";

const ROOM_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const FRIENDLY_ADJECTIVES = ["Neon", "Silent", "Crimson", "Silver", "Swift", "Lucky"];
const FRIENDLY_NOUNS = ["Hammer", "Lotus", "Fox", "Orbit", "Tiger", "Comet"];

export type RoomActor = { userId: string; username: string; displayName: string; rating?: number };
type RoomMember = RoomActor & { joinedAt: number; isHost: boolean };
type RoomState = {
  roomId: string;
  name: string;
  mode: "UNRANKED" | "RANKED";
  visibility: "PUBLIC" | "PRIVATE";
  passwordHash?: string;
  timerSeconds: 30 | 60 | 300 | 600 | 1800 | 3600;
  spectatorsEnabled: boolean;
  spectatorCapacity?: 1 | 2 | 5 | 10 | 50 | 100;
  status: "WAITING" | "PLAYING" | "ENDED" | "ABORTED";
  members: RoomMember[];
  spectatorIds: Set<string>;
  createdAt: number;
};

type IdempotencyRecord = { fingerprint: string; roomId: string };

export class RoomManager {
  private readonly rooms = new Map<string, RoomState>();
  private readonly listeners = new Set<(rooms: RoomSummary[]) => void>();
  private readonly createIdempotency = new Map<string, IdempotencyRecord>();
  private readonly joinIdempotency = new Map<string, IdempotencyRecord>();

  subscribe(listener: (rooms: RoomSummary[]) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  private publish(): void { const rooms = this.list(100); for (const listener of this.listeners) listener(rooms); }

  async create(actor: RoomActor, input: CreateRoomRequest, idempotencyKey?: string): Promise<RoomDetail> {
    const fingerprint = JSON.stringify(input);
    if (idempotencyKey) {
      const key = `${actor.userId}:${idempotencyKey}`;
      const previous = this.createIdempotency.get(key);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new AppError("CONFLICT", "Idempotency-Key đã được dùng cho yêu cầu khác.", 409, false, "INVALID");
        const existing = this.rooms.get(previous.roomId);
        if (existing) return this.serialize(existing, actor.userId);
      }
    }
    const roomId = this.generateRoomId();
    const passwordHash = input.password === undefined ? undefined : await hashSecret(input.password);
    const member: RoomMember = { ...actor, joinedAt: Date.now(), isHost: true };
    const room: RoomState = {
      roomId,
      name: input.name?.trim() || this.generateFriendlyName(),
      mode: "UNRANKED",
      visibility: input.visibility,
      ...(passwordHash ? { passwordHash } : {}),
      timerSeconds: input.timerSeconds,
      spectatorsEnabled: input.spectatorsEnabled,
      ...(input.spectatorCapacity !== undefined ? { spectatorCapacity: input.spectatorCapacity } : {}),
      status: "WAITING",
      members: [member],
      spectatorIds: new Set(),
      createdAt: Date.now(),
    };
    this.rooms.set(roomId, room);
    if (idempotencyKey) this.createIdempotency.set(`${actor.userId}:${idempotencyKey}`, { fingerprint, roomId });
    this.publish();
    return this.serialize(room, actor.userId);
  }

  async createRanked(host: RoomActor, opponent: RoomActor, timerSeconds: 30 | 60 | 300 | 600 | 1800 | 3600 = 300): Promise<RoomDetail> {
    if (host.userId === opponent.userId) throw new AppError("CONFLICT", "Không thể ghép tài khoản với chính mình.", 409, false, "INVALID");
    const roomId = this.generateRoomId();
    const now = Date.now();
    const room: RoomState = {
      roomId,
      name: "Ranked Quick Match",
      mode: "RANKED",
      visibility: "PRIVATE",
      timerSeconds,
      spectatorsEnabled: false,
      status: "WAITING",
      members: [
        { ...host, joinedAt: now, isHost: true },
        { ...opponent, joinedAt: now, isHost: false },
      ],
      spectatorIds: new Set(),
      createdAt: now,
    };
    this.rooms.set(roomId, room);
    this.publish();
    return this.serialize(room, host.userId);
  }

  list(limit = 8): RoomSummary[] {
    return [...this.rooms.values()]
      .filter((room) => room.visibility === "PUBLIC" && room.status === "WAITING" && room.members.length < 2)
      .sort((left, right) => left.createdAt - right.createdAt)
      .slice(0, Math.max(1, Math.min(limit, 100)))
      .map((room) => this.serialize(room, undefined));
  }

  search(roomId: string, viewerId?: string): RoomDetail {
    const room = this.rooms.get(roomId.trim().toUpperCase());
    if (!room) throw new AppError("NOT_FOUND", "Phòng đấu không tồn tại.", 404, false, "INVALID");
    return this.serialize(room, viewerId);
  }

  async join(actor: RoomActor, roomId: string, input: JoinRoomRequest, idempotencyKey?: string): Promise<RoomDetail> {
    return this.joinInternal(actor, roomId, input, idempotencyKey, false);
  }

  async joinByInvite(actor: RoomActor, roomId: string): Promise<RoomDetail> {
    return this.joinInternal(actor, roomId, {}, undefined, true);
  }

  async spectate(actor: RoomActor, roomId: string, input: SpectateRoomRequest): Promise<RoomDetail> {
    const normalizedRoomId = roomId.trim().toUpperCase();
    const room = this.rooms.get(normalizedRoomId);
    if (!room) throw new AppError("NOT_FOUND", "Phòng đấu không tồn tại.", 404, false, "INVALID");
    if (room.members.some((member) => member.userId === actor.userId)) {
      throw new AppError("CONFLICT", "Người chơi không thể vào cùng trận với vai trò spectator.", 409, false, "INVALID", { reason: "SPECTATOR_PLAYER_CONFLICT" });
    }
    if (!room.spectatorsEnabled) throw new AppError("CONFLICT", "Phòng này không cho phép spectator.", 409, false, "INVALID", { reason: "SPECTATOR_DISABLED" });
    if (room.passwordHash && (!input.password || !(await verifySecret(input.password, room.passwordHash)))) {
      throw new AppError("UNAUTHORIZED", "Mật khẩu phòng không đúng.", 401, false, "INVALID", { reason: "SPECTATOR_PASSWORD_REQUIRED" });
    }
    if (!room.spectatorIds.has(actor.userId) && room.spectatorCapacity !== undefined && room.spectatorIds.size >= room.spectatorCapacity) {
      throw new AppError("CONFLICT", "Phòng đã đạt sức chứa spectator.", 409, false, "INVALID", { reason: "SPECTATOR_CAPACITY", capacity: room.spectatorCapacity });
    }
    room.spectatorIds.add(actor.userId);
    this.publish();
    return this.serialize(room, undefined, true);
  }

  leaveSpectator(roomId: string, userId: string): void {
    const room = this.rooms.get(roomId.trim().toUpperCase());
    if (room?.spectatorIds.delete(userId)) this.publish();
  }

  isSpectator(roomId: string, userId: string): boolean {
    return this.rooms.get(roomId.trim().toUpperCase())?.spectatorIds.has(userId) ?? false;
  }

  spectatorView(roomId: string, userId: string): RoomDetail {
    const room = this.rooms.get(roomId.trim().toUpperCase());
    if (!room) throw new AppError("NOT_FOUND", "Phòng đấu không tồn tại.", 404, false, "INVALID");
    if (!room.spectatorIds.has(userId)) throw new AppError("UNAUTHORIZED", "Bạn chưa được cấp quyền spectator cho phòng này.", 403, false, "INVALID", { reason: "SPECTATOR_ACCESS_REQUIRED" });
    return this.serialize(room, undefined, true);
  }

  private async joinInternal(actor: RoomActor, roomId: string, input: JoinRoomRequest, idempotencyKey: string | undefined, bypassPassword: boolean): Promise<RoomDetail> {
    const normalizedRoomId = roomId.trim().toUpperCase();
    const room = this.rooms.get(normalizedRoomId);
    if (!room) throw new AppError("NOT_FOUND", "Phòng đấu không tồn tại.", 404, false, "INVALID");
    const fingerprint = JSON.stringify({ roomId: normalizedRoomId, input });
    if (idempotencyKey) {
      const key = `${actor.userId}:${idempotencyKey}`;
      const previous = this.joinIdempotency.get(key);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new AppError("CONFLICT", "Idempotency-Key đã được dùng cho yêu cầu khác.", 409, false, "INVALID");
        const existing = this.rooms.get(previous.roomId);
        if (existing) return this.serialize(existing, actor.userId);
      }
    }
    if (room.members.some((member) => member.userId === actor.userId)) return this.serialize(room, actor.userId);
    if (room.members.length >= 2) throw new AppError("CONFLICT", "Phòng đã đủ người chơi.", 409, false, "INVALID");
    if (!bypassPassword && room.passwordHash && (!input.password || !(await verifySecret(input.password, room.passwordHash)))) {
      throw new AppError("UNAUTHORIZED", "Mật khẩu phòng không đúng.", 401, false, "INVALID");
    }
    room.members.push({ ...actor, joinedAt: Date.now(), isHost: false });
    this.publish();
    if (idempotencyKey) this.joinIdempotency.set(`${actor.userId}:${idempotencyKey}`, { fingerprint, roomId: normalizedRoomId });
    return this.serialize(room, actor.userId);
  }

  leave(actor: RoomActor, roomId: string): RoomDetail | null {
    const normalizedRoomId = roomId.trim().toUpperCase();
    const room = this.rooms.get(normalizedRoomId);
    if (!room) throw new AppError("NOT_FOUND", "Phòng đấu không tồn tại.", 404, false, "INVALID");
    const index = room.members.findIndex((member) => member.userId === actor.userId);
    if (index === -1) throw new AppError("CONFLICT", "Bạn không ở trong phòng này.", 409, false, "INVALID");
    const wasHost = room.members[index]?.isHost ?? false;
    room.members.splice(index, 1);
    if (room.members.length === 0) {
      this.rooms.delete(normalizedRoomId);
      this.publish();
      return null;
    }
    if (wasHost) {
      for (const [memberIndex, member] of room.members.entries()) member.isHost = memberIndex === 0;
    }
    this.publish();
    return this.serialize(room, undefined);
  }

  /** Test/W4 seam: the Room Manager remains the only authority for lifecycle state. */
  markPlaying(roomId: string): void {
    const room = this.rooms.get(roomId.trim().toUpperCase());
    if (!room) throw new AppError("NOT_FOUND", "Phòng đấu không tồn tại.", 404, false, "INVALID");
    room.status = "PLAYING";
    this.publish();
  }

  size(): number { return this.rooms.size; }

  private generateRoomId(): string {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      let id = "";
      for (let index = 0; index < 6; index += 1) id += ROOM_ID_ALPHABET[Math.floor(Math.random() * ROOM_ID_ALPHABET.length)];
      if (!this.rooms.has(id)) return id;
    }
    throw new AppError("SERVICE_UNAVAILABLE", "Không thể cấp Room ID lúc này.", 503, true, "RECOVERABLE");
  }

  private generateFriendlyName(): string {
    const adjective = FRIENDLY_ADJECTIVES[Math.floor(Math.random() * FRIENDLY_ADJECTIVES.length)] ?? "Neon";
    const noun = FRIENDLY_NOUNS[Math.floor(Math.random() * FRIENDLY_NOUNS.length)] ?? "Hammer";
    return `${adjective} ${noun} ${Math.floor(10 + Math.random() * 90)}`;
  }

  private serialize(room: RoomState, viewerId: string | undefined, revealMembers = false): RoomDetail {
    const isMember = viewerId !== undefined && room.members.some((member) => member.userId === viewerId);
    const host = room.members.find((member) => member.isHost);
    const summary: RoomSummary = {
      roomId: room.roomId,
      name: room.name,
      players: room.members.length,
      playerCapacity: 2,
      waitingPlayerRating: room.members.find((member) => !member.isHost)?.rating ?? null,
      mode: room.mode,
      visibility: room.visibility,
      timerSeconds: room.timerSeconds,
      spectators: room.spectatorIds.size,
      spectatorsEnabled: room.spectatorsEnabled,
      spectatorCapacity: room.spectatorCapacity ?? null,
      status: room.status,
    };
    return {
      ...summary,
      hostUserId: host?.userId ?? null,
      isMember,
      requiresPassword: room.visibility === "PRIVATE" && !isMember,
      members: isMember || revealMembers ? room.members.map(({ userId, username, displayName, isHost }) => ({ userId, username, displayName, isHost })) : [],
    };
  }
}

export { ROOM_ID_ALPHABET };
