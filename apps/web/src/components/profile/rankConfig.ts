export const RANK_TIERS = [
  { id: "bronze", label: "Đồng", minElo: 0, chevrons: 1 },
  { id: "silver", label: "Bạc", minElo: 800, chevrons: 2 },
  { id: "gold", label: "Vàng", minElo: 1000, chevrons: 3 },
  { id: "platinum", label: "Bạch kim", minElo: 1200, chevrons: 4 },
  { id: "diamond", label: "Kim cương", minElo: 1400, chevrons: 5 },
  { id: "master", label: "Cao thủ", minElo: 1600, chevrons: 6 },
] as const;

export type RankTier = (typeof RANK_TIERS)[number];

export function deriveRank(elo: number): RankTier {
  const safeElo = Number.isFinite(elo) ? Math.max(0, elo) : 0;
  return [...RANK_TIERS].reverse().find((tier) => safeElo >= tier.minElo) ?? RANK_TIERS[0];
}
