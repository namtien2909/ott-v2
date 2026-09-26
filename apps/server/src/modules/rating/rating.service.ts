import type { PrismaClient } from "@prisma/client";
import type { MatchRating, MatchSnapshot } from "@ottv2/contracts";

import { AppError } from "../../shared/errors/app-error.js";

export const INITIAL_ELO = 1000;
export const ELO_K_FACTOR = 32;
export const MINIMUM_ELO = 0;

export type EloOutcome = { blueElo: number; redElo: number; winner: "BLUE" | "RED" };

function expectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + 10 ** ((opponentElo - playerElo) / 400));
}

export function calculateElo({ blueElo, redElo, winner }: EloOutcome): MatchRating {
  const safeBlue = Math.max(MINIMUM_ELO, Math.round(blueElo));
  const safeRed = Math.max(MINIMUM_ELO, Math.round(redElo));
  const winnerElo = winner === "BLUE" ? safeBlue : safeRed;
  const loserElo = winner === "BLUE" ? safeRed : safeBlue;
  const safeWinner = winnerElo;
  const safeLoser = loserElo;
  const winnerDelta = Math.round(ELO_K_FACTOR * (1 - expectedScore(safeWinner, safeLoser)));
  const loserDelta = Math.round(ELO_K_FACTOR * (0 - expectedScore(safeLoser, safeWinner)));
  const winnerAfter = Math.max(MINIMUM_ELO, safeWinner + winnerDelta);
  const loserAfter = Math.max(MINIMUM_ELO, safeLoser + loserDelta);
  return {
    blueBefore: safeBlue,
    blueAfter: winner === "BLUE" ? winnerAfter : loserAfter,
    blueDelta: winner === "BLUE" ? winnerDelta : loserDelta,
    redBefore: safeRed,
    redAfter: winner === "RED" ? winnerAfter : loserAfter,
    redDelta: winner === "RED" ? winnerDelta : loserDelta,
  };
}

function resultFromRows(row: { blueBefore: number; blueAfter: number; blueDelta: number; redBefore: number; redAfter: number; redDelta: number }): MatchRating {
  return { blueBefore: row.blueBefore, blueAfter: row.blueAfter, blueDelta: row.blueDelta, redBefore: row.redBefore, redAfter: row.redAfter, redDelta: row.redDelta };
}

export class RatingService {
  constructor(private readonly db?: PrismaClient) {}

  async finalize(match: MatchSnapshot): Promise<MatchRating | null> {
    if (match.mode !== "RANKED" || match.status !== "FINISHED" || !match.winner || !match.resultReason || match.resultReason === "SERVER_INTERRUPTION") return null;
    const blue = match.players.find((player) => player.side === "BLUE");
    const red = match.players.find((player) => player.side === "RED");
    if (!blue || !red) return null;
    const winner = match.winner;
    if (!winner) return null;
    const resultReason = match.resultReason;
    if (!resultReason) return null;
    const db = this.db;
    if (!db) throw new AppError("SERVICE_UNAVAILABLE", "Dịch vụ xếp hạng hiện chưa sẵn sàng.", 503, true, "RECOVERABLE");
    try {
      return await db.$transaction(async (tx) => {
      const existing = await tx.rankedMatchResult.findUnique({ where: { matchId: match.matchId } });
      if (existing) return resultFromRows(existing);
      const stats = await tx.userStats.findMany({ where: { userId: { in: [blue.userId, red.userId] } } });
      const blueStats = stats.find((item) => item.userId === blue.userId);
      const redStats = stats.find((item) => item.userId === red.userId);
      if (!blueStats || !redStats) throw new AppError("SERVICE_UNAVAILABLE", "Không tìm thấy thống kê Elo của người chơi.", 503, true, "RECOVERABLE");
      const rating = calculateElo({ blueElo: blueStats.elo, redElo: redStats.elo, winner });
      await tx.rankedMatchResult.create({ data: { matchId: match.matchId, blueUserId: blue.userId, redUserId: red.userId, resultReason, ...rating } });
      await tx.userStats.update({ where: { userId: blue.userId }, data: { elo: rating.blueAfter, ...(winner === "BLUE" ? { rankedWins: { increment: 1 } } : { rankedLosses: { increment: 1 } }) } });
      await tx.userStats.update({ where: { userId: red.userId }, data: { elo: rating.redAfter, ...(winner === "RED" ? { rankedWins: { increment: 1 } } : { rankedLosses: { increment: 1 } }) } });
        return rating;
      });
    } catch (error) {
      if ((error as { code?: unknown }).code !== "P2002") throw error;
      const existing = await db.rankedMatchResult.findUnique({ where: { matchId: match.matchId } });
      if (!existing) throw error;
      return resultFromRows(existing);
    }
  }
}
