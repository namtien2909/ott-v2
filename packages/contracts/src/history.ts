import { z } from "zod";

import { MatchBoardSchema } from "./match.js";

export const HistoryModeSchema = z.enum(["RANKED", "UNRANKED", "GUEST", "AI", "OFFLINE"]);
export const HistoryModeFilterSchema = z.enum(["ALL", ...HistoryModeSchema.options]);
export const HistoryResultFilterSchema = z.enum(["ALL", "WIN", "LOSS"]);
export const HistoryRangeFilterSchema = z.enum(["7D", "30D", "ALL"]);

export const HistoryQuerySchema = z.object({
  mode: HistoryModeFilterSchema.default("ALL"),
  result: HistoryResultFilterSchema.default("ALL"),
  range: HistoryRangeFilterSchema.default("ALL"),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(20),
});

export const HistoryPlayerSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  displayName: z.string().min(1),
  side: z.enum(["BLUE", "RED"]),
  isViewer: z.boolean(),
  isWinner: z.boolean().nullable(),
  ratingBefore: z.number().int().nonnegative().nullable(),
  ratingAfter: z.number().int().nonnegative().nullable(),
  ratingDelta: z.number().int().nullable(),
});

export const HistoryMatchCardSchema = z.object({
  matchId: z.string().uuid(),
  roomId: z.string().length(6),
  mode: HistoryModeSchema,
  status: z.enum(["FINISHED", "ABORTED"]),
  result: z.enum(["WIN", "LOSS", "ABORTED"]),
  resultReason: z.enum(["EXTINCTION", "GOAL_REACHED", "TIMEOUT", "SURRENDER", "DISCONNECT_TIMEOUT", "SERVER_INTERRUPTION"]).nullable(),
  winner: z.enum(["BLUE", "RED"]).nullable(),
  viewer: HistoryPlayerSchema,
  opponent: HistoryPlayerSchema.nullable(),
  timerSeconds: z.number().int().positive(),
  startedAt: z.string().datetime().nullable(),
  endedAt: z.string().datetime(),
  durationSeconds: z.number().int().nonnegative(),
  ratingDelta: z.number().int().nullable(),
  finalBoard: MatchBoardSchema.nullable(),
});

export const HistorySummarySchema = z.object({
  elo: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  winRate: z.number().min(0).max(100),
});

export const HistoryListResponseSchema = z.object({
  matches: z.array(HistoryMatchCardSchema),
  nextCursor: z.string().uuid().nullable(),
  hasMore: z.boolean(),
  summary: HistorySummarySchema,
});

export const HistoryDetailResponseSchema = z.object({
  match: HistoryMatchCardSchema.extend({
    players: z.array(HistoryPlayerSchema).min(1).max(2),
  }),
});

export type HistoryMode = z.infer<typeof HistoryModeSchema>;
export type HistoryResultFilter = z.infer<typeof HistoryResultFilterSchema>;
export type HistoryRangeFilter = z.infer<typeof HistoryRangeFilterSchema>;
export type HistoryQuery = z.infer<typeof HistoryQuerySchema>;
export type HistoryPlayer = z.infer<typeof HistoryPlayerSchema>;
export type HistoryMatchCard = z.infer<typeof HistoryMatchCardSchema>;
export type HistoryListResponse = z.infer<typeof HistoryListResponseSchema>;
export type HistoryDetailResponse = z.infer<typeof HistoryDetailResponseSchema>;
