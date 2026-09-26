import { z } from "zod";

export const PresenceStatusSchema = z.enum(["OFFLINE", "ONLINE", "IN_GAME"]);
export const FriendRequestDirectionSchema = z.enum(["incoming", "sent"]);
export const FriendRequestStatusSchema = z.enum(["PENDING", "ACCEPTED", "REJECTED", "CANCELLED"]);

export const SocialUserSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  displayName: z.string().min(1),
  elo: z.number().int().nonnegative(),
  rankedWins: z.number().int().nonnegative(),
  rankedLosses: z.number().int().nonnegative(),
  presence: PresenceStatusSchema,
  isFriend: z.boolean(),
  requestStatus: FriendRequestStatusSchema.nullable(),
});

export const FriendRequestSchema = z.object({
  requestId: z.string().uuid(),
  user: SocialUserSchema,
  direction: FriendRequestDirectionSchema,
  status: FriendRequestStatusSchema,
  createdAt: z.string().datetime(),
});

export const BlockedUserSchema = SocialUserSchema.omit({ isFriend: true, requestStatus: true }).extend({ blockedAt: z.string().datetime() });
export const FriendshipListResponseSchema = z.object({ friends: z.array(SocialUserSchema) });
export const FriendRequestListResponseSchema = z.object({ requests: z.array(FriendRequestSchema) });
export const SocialSearchResponseSchema = z.object({ results: z.array(SocialUserSchema) });
export const BlockedListResponseSchema = z.object({ users: z.array(BlockedUserSchema) });
export const SearchUsersQuerySchema = z.object({ q: z.string().trim().min(2).max(30) });

export const PresenceEventTypeSchema = z.enum(["PRESENCE_SNAPSHOT", "FRIEND_PRESENCE_CHANGED"]);
export const PresenceEventSchema = z.object({
  protocolVersion: z.literal("0.1"),
  type: PresenceEventTypeSchema,
  timestamp: z.number().int().nonnegative(),
  user: SocialUserSchema.pick({ userId: true, username: true, displayName: true, presence: true }),
});

export const CreateInviteRequestSchema = z.object({ roomId: z.string().length(6), targetUserId: z.string().min(1) });
export const RoomInviteSchema = z.object({
  token: z.string().min(20),
  roomId: z.string().length(6),
  from: SocialUserSchema.pick({ userId: true, username: true, displayName: true }),
  expiresAt: z.string().datetime(),
  status: z.enum(["ACTIVE", "USED", "EXPIRED", "REJECTED"]),
});
export const InviteListResponseSchema = z.object({ invites: z.array(RoomInviteSchema) });

export type PresenceStatus = z.infer<typeof PresenceStatusSchema>;
export type FriendRequestDirection = z.infer<typeof FriendRequestDirectionSchema>;
export type FriendRequestStatus = z.infer<typeof FriendRequestStatusSchema>;
export type SocialUser = z.infer<typeof SocialUserSchema>;
export type FriendRequest = z.infer<typeof FriendRequestSchema>;
export type BlockedUser = z.infer<typeof BlockedUserSchema>;
export type RoomInvite = z.infer<typeof RoomInviteSchema>;
export type PresenceEvent = z.infer<typeof PresenceEventSchema>;
