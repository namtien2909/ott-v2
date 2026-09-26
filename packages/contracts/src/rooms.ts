import { z } from "zod";

export const RoomVisibilitySchema = z.enum(["PUBLIC", "PRIVATE"]);
export const RoomModeSchema = z.enum(["UNRANKED", "RANKED"]);
export const RoomStatusSchema = z.enum(["WAITING", "PLAYING", "ENDED", "ABORTED"]);
export const TimerSecondsSchema = z.union([z.literal(30), z.literal(60), z.literal(300), z.literal(600), z.literal(1800), z.literal(3600)]);
export const SpectatorCapacitySchema = z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10), z.literal(50), z.literal(100)]);

export const CreateRoomRequestSchema = z.object({
  name: z.string().trim().max(30).optional().default(""),
  visibility: RoomVisibilitySchema,
  password: z.string().min(1).max(12).optional(),
  timerSeconds: TimerSecondsSchema,
  spectatorsEnabled: z.boolean().default(false),
  spectatorCapacity: SpectatorCapacitySchema.optional(),
}).superRefine((input, context) => {
  if (input.visibility === "PUBLIC" && input.password !== undefined) context.addIssue({ code: "custom", path: ["password"], message: "Phòng Public không được đặt mật khẩu." });
  if (input.visibility === "PRIVATE" && input.password === undefined) context.addIssue({ code: "custom", path: ["password"], message: "Phòng Private cần mật khẩu." });
  if (input.spectatorsEnabled && input.spectatorCapacity === undefined) context.addIssue({ code: "custom", path: ["spectatorCapacity"], message: "Hãy chọn sức chứa spectator." });
  if (!input.spectatorsEnabled && input.spectatorCapacity !== undefined) context.addIssue({ code: "custom", path: ["spectatorCapacity"], message: "Tắt spectator thì không cần sức chứa." });
});

export const JoinRoomRequestSchema = z.object({ password: z.string().min(1).max(12).optional() });

export const RoomMemberSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  displayName: z.string().min(1),
  isHost: z.boolean(),
});

export const RoomSummarySchema = z.object({
  roomId: z.string().length(6),
  name: z.string().min(1).max(30),
  players: z.number().int().min(0).max(2),
  playerCapacity: z.literal(2),
  waitingPlayerRating: z.number().int().nullable(),
  mode: RoomModeSchema,
  visibility: RoomVisibilitySchema,
  timerSeconds: TimerSecondsSchema,
  spectators: z.number().int().min(0),
  spectatorsEnabled: z.boolean(),
  spectatorCapacity: SpectatorCapacitySchema.nullable(),
  status: RoomStatusSchema,
});

export const RoomDetailSchema = RoomSummarySchema.extend({
  hostUserId: z.string().min(1).nullable(),
  isMember: z.boolean(),
  requiresPassword: z.boolean(),
  members: z.array(RoomMemberSchema),
});

export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;
export type JoinRoomRequest = z.infer<typeof JoinRoomRequestSchema>;
export type RoomSummary = z.infer<typeof RoomSummarySchema>;
export type RoomDetail = z.infer<typeof RoomDetailSchema>;
