import { z } from "zod";

import { SemanticEnvelopeSchema } from "./envelope.js";

export const MatchmakingModeSchema = z.literal("RANKED");
export const MatchmakingStatusSchema = z.enum(["QUEUED", "MATCHED", "CANCELLED"]);
export const MatchmakingPlayerSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  displayName: z.string().min(1),
  elo: z.number().int().nonnegative(),
});
export const MatchmakingSnapshotSchema = z.object({
  queueId: z.uuid(),
  mode: MatchmakingModeSchema,
  status: MatchmakingStatusSchema,
  player: MatchmakingPlayerSchema,
  opponent: MatchmakingPlayerSchema.nullable(),
  range: z.number().int().positive(),
  elapsedMs: z.number().int().nonnegative(),
  joinedAt: z.number().int().positive(),
  roomId: z.string().length(6).nullable(),
  matchId: z.uuid().nullable(),
});
export const JoinMatchmakingRequestSchema = z.object({ mode: MatchmakingModeSchema.default("RANKED") });
export const MatchmakingEventTypeSchema = z.enum(["QUEUE_JOINED", "QUEUE_RANGE_UPDATED", "MATCH_FOUND", "QUEUE_CANCELLED"]);
export const MatchmakingEventEnvelopeSchema = SemanticEnvelopeSchema.extend({
  type: MatchmakingEventTypeSchema,
  queueId: z.uuid(),
  sequence: z.number().int().nonnegative(),
  payload: MatchmakingSnapshotSchema,
});

export type MatchmakingMode = z.infer<typeof MatchmakingModeSchema>;
export type MatchmakingStatus = z.infer<typeof MatchmakingStatusSchema>;
export type MatchmakingPlayer = z.infer<typeof MatchmakingPlayerSchema>;
export type MatchmakingSnapshot = z.infer<typeof MatchmakingSnapshotSchema>;
export type JoinMatchmakingRequest = z.infer<typeof JoinMatchmakingRequestSchema>;
export type MatchmakingEventType = z.infer<typeof MatchmakingEventTypeSchema>;
export type MatchmakingEventEnvelope = z.infer<typeof MatchmakingEventEnvelopeSchema>;
