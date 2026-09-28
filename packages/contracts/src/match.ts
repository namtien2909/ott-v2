import { z } from "zod";

import { SemanticEnvelopeSchema } from "./envelope.js";

export const MatchStatusSchema = z.enum(["WAITING_READY", "COUNTDOWN", "PLAYING", "FINISHED", "ABORTED"]);
export const MatchModeSchema = z.enum(["UNRANKED", "RANKED"]);
export const MatchSideSchema = z.enum(["BLUE", "RED"]);
export const MatchPieceTypeSchema = z.enum(["R", "P", "S"]);
export const MatchRuleStatusSchema = z.enum(["PLAYING", "FINISHED"]);
export const MatchResultReasonSchema = z.enum(["EXTINCTION", "GOAL_REACHED", "TIMEOUT", "SURRENDER", "DISCONNECT_TIMEOUT", "SERVER_INTERRUPTION"]).nullable();
export const MatchCoordinateSchema = z.string().regex(/^[a-i][1-9]$/);
export const MatchPieceSchema = z.object({ id: z.string().min(1), side: MatchSideSchema, type: MatchPieceTypeSchema });
export const MatchPlayerSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  displayName: z.string().min(1),
  side: MatchSideSchema,
  ready: z.boolean(),
  connected: z.boolean(),
});
export const MatchRatingSchema = z.object({
  blueBefore: z.number().int().nonnegative(),
  blueAfter: z.number().int().nonnegative(),
  blueDelta: z.number().int(),
  redBefore: z.number().int().nonnegative(),
  redAfter: z.number().int().nonnegative(),
  redDelta: z.number().int(),
});
export const MatchBoardSchema = z.record(z.string().regex(/^[a-i][1-9]$/), MatchPieceSchema.nullable());
export const MatchSnapshotSchema = z.object({
  matchId: z.uuid(),
  roomId: z.string().length(6),
  hostUserId: z.string().min(1).optional(),
  mode: MatchModeSchema,
  status: MatchStatusSchema,
  players: z.array(MatchPlayerSchema).max(2),
  board: MatchBoardSchema,
  pieceCounts: z.object({ BLUE: z.object({ R: z.number().int(), P: z.number().int(), S: z.number().int() }), RED: z.object({ R: z.number().int(), P: z.number().int(), S: z.number().int() }) }),
  currentTurn: MatchSideSchema.nullable(),
  winner: MatchSideSchema.nullable(),
  resultReason: MatchResultReasonSchema,
  clocksMs: z.object({ BLUE: z.number().int().nonnegative(), RED: z.number().int().nonnegative() }),
  timerSeconds: z.number().int().positive(),
  countdownEndsAt: z.number().int().positive().nullable(),
  startedAt: z.number().int().positive().nullable().optional(),
  endedAt: z.number().int().positive().nullable().optional(),
  sequence: z.number().int().nonnegative(),
  stateVersion: z.number().int().nonnegative(),
  rating: MatchRatingSchema.nullable(),
  rematchRequestedBy: MatchSideSchema.nullable().optional(),
});
export const MatchEventTypeSchema = z.enum([
  "MATCH_SNAPSHOT",
  "PLAYER_READY",
  "COUNTDOWN_STARTED",
  "MATCH_STARTED",
  "PIECE_MOVE_ACCEPTED",
  "PIECE_MOVE_REJECTED",
  "CLOCK_TICK",
  "PLAYER_SURRENDERED",
  "MATCH_FINISHED",
  "REMATCH_REQUESTED",
  "PLAYER_DISCONNECTED",
  "PLAYER_RECONNECTED",
  "STATE_RESYNC",
  "MATCH_ABORTED",
  "RATING_UPDATED",
  "REMATCH_REJECTED",
]);
export const MatchEventEnvelopeSchema = SemanticEnvelopeSchema.extend({
  type: MatchEventTypeSchema,
  roomId: z.string().length(6),
  matchId: z.uuid(),
  sequence: z.number().int().nonnegative(),
  stateVersion: z.number().int().nonnegative(),
  payload: MatchSnapshotSchema,
});

export const ReadyMatchRequestSchema = z.object({ ready: z.boolean() });
export const PieceMoveRequestSchema = z.object({ from: MatchCoordinateSchema, to: MatchCoordinateSchema, stateVersion: z.number().int().nonnegative() });
export const SurrenderMatchRequestSchema = z.object({ stateVersion: z.number().int().nonnegative() });
export const RematchRequestSchema = z.object({ stateVersion: z.number().int().nonnegative() });

export type MatchStatus = z.infer<typeof MatchStatusSchema>;
export type MatchResultReason = z.infer<typeof MatchResultReasonSchema>;
export type MatchRating = z.infer<typeof MatchRatingSchema>;
export type MatchEventType = z.infer<typeof MatchEventTypeSchema>;
export type MatchSnapshot = z.infer<typeof MatchSnapshotSchema>;
export type MatchEventEnvelope = z.infer<typeof MatchEventEnvelopeSchema>;
export type ReadyMatchRequest = z.infer<typeof ReadyMatchRequestSchema>;
export type PieceMoveRequest = z.infer<typeof PieceMoveRequestSchema>;
export type SurrenderMatchRequest = z.infer<typeof SurrenderMatchRequestSchema>;
export type RematchRequest = z.infer<typeof RematchRequestSchema>;
