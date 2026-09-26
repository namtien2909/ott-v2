import { z } from "zod";

export const GuestMatchRecordSchema = z.object({
  localId: z.string().uuid(),
  mode: z.literal("GUEST"),
  result: z.enum(["WIN", "LOSS", "DRAW"]),
  playerName: z.string().trim().min(2).max(20),
  opponentName: z.string().trim().min(2).max(20),
  timerSeconds: z.number().int().positive().max(3600),
  durationSeconds: z.number().int().nonnegative().max(86400),
  endedAt: z.string().datetime(),
  scoreDelta: z.number().int().min(-100).max(100),
});

export const GuestHistoryImportRequestSchema = z.object({
  records: z.array(GuestMatchRecordSchema).max(100),
});

export const GuestHistoryImportResponseSchema = z.object({
  importedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
});

export type GuestMatchRecord = z.infer<typeof GuestMatchRecordSchema>;
export type GuestHistoryImportRequest = z.infer<typeof GuestHistoryImportRequestSchema>;
export type GuestHistoryImportResponse = z.infer<typeof GuestHistoryImportResponseSchema>;
