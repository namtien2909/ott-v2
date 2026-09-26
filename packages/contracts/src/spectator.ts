import { z } from "zod";
import { MatchSnapshotSchema } from "./match.js";
import { RoomDetailSchema } from "./rooms.js";

export const SpectateRoomRequestSchema = z.object({ password: z.string().min(1).max(12).optional() });
export const SpectatorRoleSchema = z.literal("SPECTATOR");
export const SpectatorAccessResponseSchema = z.object({
  role: SpectatorRoleSchema,
  room: RoomDetailSchema,
  match: MatchSnapshotSchema,
  viewerSide: z.null(),
  spectatorCount: z.number().int().nonnegative(),
});

export type SpectateRoomRequest = z.infer<typeof SpectateRoomRequestSchema>;
export type SpectatorAccessResponse = z.infer<typeof SpectatorAccessResponseSchema>;
