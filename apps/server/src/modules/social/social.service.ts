import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { BlockedUser, FriendRequest, PresenceEvent, RoomInvite, SocialUser } from "@ottv2/contracts";

import { AppError } from "../../shared/errors/app-error.js";
import { RoomManager } from "../room/room.manager.js";
import { PresenceManager, type PresenceUser } from "./presence.manager.js";

type UserRow = Prisma.UserGetPayload<{ include: { stats: true; profile: true } }>;
type InviteState = RoomInvite & { targetUserId: string; fromUserId: string; consuming?: boolean };

const INVITE_TTL_MS = 5 * 60 * 1000;

function unavailable(): never { throw new AppError("SERVICE_UNAVAILABLE", "Dịch vụ social hiện chưa sẵn sàng.", 503, true, "RECOVERABLE"); }
function pair(left: string, right: string): { userAId: string; userBId: string } { return left < right ? { userAId: left, userBId: right } : { userAId: right, userBId: left }; }

export function normalizePair(left: string, right: string): string { const normalized = pair(left, right); return `${normalized.userAId}:${normalized.userBId}`; }

export class SocialService {
  private readonly invites = new Map<string, InviteState>();
  constructor(private readonly db?: PrismaClient, private readonly rooms?: RoomManager, readonly presence = new PresenceManager(), private readonly now: () => number = Date.now) {}

  private requireDb(): PrismaClient { if (!this.db) unavailable(); return this.db; }
  private requireRooms(): RoomManager { if (!this.rooms) throw new AppError("SERVICE_UNAVAILABLE", "Room service hiện chưa sẵn sàng.", 503, true, "RECOVERABLE"); return this.rooms; }

  async friends(viewerId: string): Promise<SocialUser[]> {
    const db = this.requireDb();
    const rows = await db.friendship.findMany({ where: { OR: [{ userAId: viewerId }, { userBId: viewerId }] } });
    const ids = rows.map((item) => item.userAId === viewerId ? item.userBId : item.userAId);
    const users = await db.user.findMany({ where: { id: { in: ids } }, include: { stats: true, profile: true } });
    return users.map((user) => this.socialUser(user, true, null, user.profile?.presenceVisibility !== "NOBODY"));
  }

  async profileRelationship(viewerId: string, targetUserId: string): Promise<{ isFriend: boolean; requestStatus: "PENDING" | null; presence?: SocialUser["presence"] }> {
    if (await this.isBlocked(viewerId, targetUserId)) return { isFriend: false, requestStatus: null };
    const isFriend = await this.isFriend(viewerId, targetUserId);
    const target = await this.requireDb().user.findUnique({ where: { id: targetUserId }, include: { profile: true } });
    return { isFriend, requestStatus: await this.requestStatus(viewerId, targetUserId), ...(isFriend && target?.profile?.presenceVisibility !== "NOBODY" ? { presence: this.presence.get(targetUserId) } : {}) };
  }

  async search(viewerId: string, query: string): Promise<SocialUser[]> {
    const db = this.requireDb();
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const blocked = await db.block.findMany({ where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] } });
    const blockedIds = blocked.map((item) => item.blockerId === viewerId ? item.blockedId : item.blockerId);
    const users = await db.user.findMany({ where: { id: { not: viewerId, notIn: blockedIds }, OR: [{ usernameNormalized: { contains: q } }, { displayName: { contains: query.trim(), mode: "insensitive" } }] }, include: { stats: true, profile: true }, take: 20, orderBy: { usernameNormalized: "asc" } });
    return Promise.all(users.map(async (user) => { const isFriend = await this.isFriend(viewerId, user.id); return this.socialUser(user, isFriend, await this.requestStatus(viewerId, user.id), isFriend && user.profile?.presenceVisibility !== "NOBODY"); }));
  }

  async requests(viewerId: string, direction: "incoming" | "sent"): Promise<FriendRequest[]> {
    const db = this.requireDb();
    const rows = await db.friendRequest.findMany({ where: direction === "incoming" ? { recipientId: viewerId, status: "PENDING" } : { senderId: viewerId, status: "PENDING" }, orderBy: { createdAt: "desc" }, include: { sender: { include: { stats: true, profile: true } }, recipient: { include: { stats: true, profile: true } } } });
    return rows.map((row) => {
      const user = direction === "incoming" ? row.sender : row.recipient;
      return { requestId: row.id, user: this.socialUser(user, false, "PENDING", false), direction, status: row.status as "PENDING", createdAt: row.createdAt.toISOString() };
    });
  }

  async sendRequest(viewerId: string, targetUserId: string): Promise<FriendRequest | { friendshipCreated: true }> {
    const db = this.requireDb();
    if (viewerId === targetUserId) throw new AppError("CONFLICT", "Không thể kết bạn với chính mình.", 409, false, "INVALID");
    await this.assertUsers(viewerId, targetUserId);
    await this.assertNotBlocked(viewerId, targetUserId);
    if (await this.isFriend(viewerId, targetUserId)) throw new AppError("CONFLICT", "Hai bạn đã là bạn bè.", 409, false, "INVALID");
    const existing = await db.friendRequest.findUnique({ where: { pairKey: normalizePair(viewerId, targetUserId) } });
    if (existing?.status === "PENDING" && existing.senderId !== viewerId) {
      await db.$transaction(async (tx) => {
        await tx.friendship.upsert({ where: { userAId_userBId: pair(viewerId, targetUserId) }, create: { ...pair(viewerId, targetUserId) }, update: {} });
        await tx.friendRequest.update({ where: { id: existing.id }, data: { status: "ACCEPTED" } });
      });
      return { friendshipCreated: true };
    }
    if (existing?.status === "PENDING") throw new AppError("CONFLICT", "Lời mời đã được gửi.", 409, false, "INVALID");
    const row = existing ? await db.friendRequest.update({ where: { id: existing.id }, data: { senderId: viewerId, recipientId: targetUserId, status: "PENDING" }, include: { sender: { include: { stats: true, profile: true } }, recipient: { include: { stats: true, profile: true } } } }) : await db.friendRequest.create({ data: { senderId: viewerId, recipientId: targetUserId, pairKey: normalizePair(viewerId, targetUserId) }, include: { sender: { include: { stats: true, profile: true } }, recipient: { include: { stats: true, profile: true } } } });
    return { requestId: row.id, user: this.socialUser(row.recipient, false, "PENDING", false), direction: "sent", status: "PENDING", createdAt: row.createdAt.toISOString() };
  }

  async updateRequest(viewerId: string, requestId: string, action: "accept" | "reject" | "cancel"): Promise<void> {
    const db = this.requireDb();
    const request = await db.friendRequest.findUnique({ where: { id: requestId } });
    if (!request || request.status !== "PENDING" || (action === "cancel" ? request.senderId !== viewerId : request.recipientId !== viewerId)) throw new AppError("NOT_FOUND", "Lời mời kết bạn không tồn tại.", 404, false, "INVALID");
    if (action === "accept") {
      await this.assertNotBlocked(viewerId, request.senderId);
      await db.$transaction(async (tx) => {
        await tx.friendship.upsert({ where: { userAId_userBId: pair(request.senderId, request.recipientId) }, create: { ...pair(request.senderId, request.recipientId) }, update: {} });
        await tx.friendRequest.update({ where: { id: request.id }, data: { status: "ACCEPTED" } });
      });
      return;
    }
    await db.friendRequest.update({ where: { id: request.id }, data: { status: action === "cancel" ? "CANCELLED" : "REJECTED" } });
  }

  async removeFriend(viewerId: string, targetUserId: string): Promise<void> { const db = this.requireDb(); await db.friendship.deleteMany({ where: pair(viewerId, targetUserId) }); }

  async block(viewerId: string, targetUserId: string): Promise<void> {
    const db = this.requireDb();
    await this.assertUsers(viewerId, targetUserId);
    await db.$transaction([
      db.block.upsert({ where: { blockerId_blockedId: { blockerId: viewerId, blockedId: targetUserId } }, create: { blockerId: viewerId, blockedId: targetUserId }, update: {} }),
      db.friendship.deleteMany({ where: { OR: [{ userAId: viewerId, userBId: targetUserId }, { userAId: targetUserId, userBId: viewerId }] } }),
      db.friendRequest.updateMany({ where: { OR: [{ senderId: viewerId, recipientId: targetUserId }, { senderId: targetUserId, recipientId: viewerId }], status: "PENDING" }, data: { status: "REJECTED" } }),
    ]);
  }

  async unblock(viewerId: string, targetUserId: string): Promise<void> { const db = this.requireDb(); await db.block.deleteMany({ where: { blockerId: viewerId, blockedId: targetUserId } }); }

  async blocks(viewerId: string): Promise<BlockedUser[]> {
    const db = this.requireDb();
    const rows = await db.block.findMany({ where: { blockerId: viewerId }, include: { blocked: { include: { stats: true, profile: true } } }, orderBy: { createdAt: "desc" } });
    return rows.map((row) => ({ ...this.socialUser(row.blocked, false, null, false), blockedAt: row.createdAt.toISOString() }));
  }

  async subscribePresence(viewerId: string, listener: (event: PresenceEvent) => void): Promise<() => void> {
    const db = this.requireDb();
    const rows = await db.friendship.findMany({ where: { OR: [{ userAId: viewerId }, { userBId: viewerId }] } });
    const ids = rows.map((item) => item.userAId === viewerId ? item.userBId : item.userAId);
    const users = await db.user.findMany({ where: { id: { in: ids } }, include: { profile: true } });
    const visibleUsers = users.filter((user) => user.profile?.presenceVisibility !== "NOBODY");
    return this.presence.subscribe(viewerId, visibleUsers.map((user) => user.id), visibleUsers.map((user) => ({ userId: user.id, username: user.username, displayName: user.displayName })), listener, this.now());
  }

  async markOnline(userId: string): Promise<void> { const db = this.requireDb(); const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, username: true, displayName: true } }); if (user) this.presence.set({ userId: user.id, username: user.username, displayName: user.displayName }, "ONLINE", this.now()); }

  async createInvite(senderId: string, roomId: string, targetUserId: string): Promise<RoomInvite> {
    const db = this.requireDb();
    await this.assertUsers(senderId, targetUserId);
    await this.assertNotBlocked(senderId, targetUserId);
    if (!(await this.isFriend(senderId, targetUserId))) throw new AppError("UNAUTHORIZED", "Chỉ có thể mời bạn bè vào phòng.", 403, false, "INVALID");
    const rooms = this.requireRooms();
    const room = rooms.search(roomId, senderId);
    if (!room.isMember || room.status !== "WAITING") throw new AppError("CONFLICT", "Phòng không còn nhận lời mời.", 409, false, "INVALID");
    const sender = await db.user.findUniqueOrThrow({ where: { id: senderId } });
    const expiresAt = new Date(this.now() + INVITE_TTL_MS).toISOString();
    const invite: InviteState = { token: `${randomUUID()}${randomUUID()}`, roomId: room.roomId, from: { userId: sender.id, username: sender.username, displayName: sender.displayName }, fromUserId: senderId, targetUserId, expiresAt, status: "ACTIVE" };
    this.invites.set(invite.token, invite);
    return this.publicInvite(invite);
  }

  async invitesFor(targetUserId: string): Promise<RoomInvite[]> { return [...this.invites.values()].filter((invite) => invite.targetUserId === targetUserId && this.expire(invite)).filter((invite) => invite.status === "ACTIVE").map((invite) => this.publicInvite(invite)); }

  async acceptInvite(targetUserId: string, token: string): Promise<{ room: Awaited<ReturnType<RoomManager["search"]>> }> {
    const invite = this.invites.get(token);
    if (!invite || invite.targetUserId !== targetUserId || !this.expire(invite) || invite.status !== "ACTIVE") throw new AppError("NOT_FOUND", "Lời mời không còn hiệu lực.", 404, false, "INVALID", { reason: "INVITE_INVALID" });
    if (invite.consuming) throw new AppError("CONFLICT", "Lời mời đang được xử lý.", 409, true, "RECOVERABLE");
    invite.consuming = true;
    try {
      const db = this.requireDb();
      const target = await db.user.findUniqueOrThrow({ where: { id: targetUserId } });
      const room = await this.requireRooms().joinByInvite({ userId: target.id, username: target.username, displayName: target.displayName }, invite.roomId);
      invite.status = "USED";
      return { room };
    } catch (error) {
      invite.consuming = false;
      throw error;
    }
  }

  rejectInvite(targetUserId: string, token: string): void { const invite = this.invites.get(token); if (!invite || invite.targetUserId !== targetUserId || !this.expire(invite) || invite.status !== "ACTIVE") throw new AppError("NOT_FOUND", "Lời mời không còn hiệu lực.", 404, false, "INVALID", { reason: "INVITE_INVALID" }); invite.status = "REJECTED"; }

  private expire(invite: InviteState): boolean { if (invite.status === "ACTIVE" && new Date(invite.expiresAt).getTime() <= this.now()) invite.status = "EXPIRED"; return invite.status === "ACTIVE"; }
  private publicInvite(invite: InviteState): RoomInvite { return { token: invite.token, roomId: invite.roomId, from: invite.from, expiresAt: invite.expiresAt, status: invite.status }; }
  private async assertUsers(left: string, right: string): Promise<void> { const db = this.requireDb(); const count = await db.user.count({ where: { id: { in: [left, right] } } }); if (count !== 2) throw new AppError("NOT_FOUND", "Người chơi không tồn tại.", 404, false, "INVALID"); }
  private async assertNotBlocked(left: string, right: string): Promise<void> { const db = this.requireDb(); const block = await db.block.findFirst({ where: { OR: [{ blockerId: left, blockedId: right }, { blockerId: right, blockedId: left }] } }); if (block) throw new AppError("UNAUTHORIZED", "Thao tác bị chặn bởi quyền riêng tư.", 403, false, "INVALID"); }
  private async isFriend(left: string, right: string): Promise<boolean> { const db = this.requireDb(); return Boolean(await db.friendship.findUnique({ where: { userAId_userBId: pair(left, right) } })); }
  private async isBlocked(left: string, right: string): Promise<boolean> { const db = this.requireDb(); return Boolean(await db.block.findFirst({ where: { OR: [{ blockerId: left, blockedId: right }, { blockerId: right, blockedId: left }] } })); }
  private async requestStatus(viewerId: string, targetId: string): Promise<"PENDING" | null> { const db = this.requireDb(); const request = await db.friendRequest.findFirst({ where: { OR: [{ senderId: viewerId, recipientId: targetId }, { senderId: targetId, recipientId: viewerId }], status: "PENDING" } }); return request ? "PENDING" : null; }
  private socialUser(user: UserRow, isFriend: boolean, requestStatus: "PENDING" | null, canSeePresence: boolean): SocialUser { return { userId: user.id, username: user.username, displayName: user.displayName, elo: user.stats?.elo ?? 1000, rankedWins: user.stats?.rankedWins ?? 0, rankedLosses: user.stats?.rankedLosses ?? 0, ...(canSeePresence ? { presence: this.presence.get(user.id) } : {}), isFriend, requestStatus }; }
}

export { INVITE_TTL_MS };
