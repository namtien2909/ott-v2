export const rankConfig = [
  { name: "BRONZE", minElo: 0, color: "bronze" },
  { name: "SILVER", minElo: 1100, color: "silver" },
  { name: "GOLD", minElo: 1300, color: "gold" },
  { name: "PLATINUM", minElo: 1550, color: "platinum" },
  { name: "DIAMOND", minElo: 1800, color: "diamond" },
] as const;

export function getRankForElo(elo: number) {
  return [...rankConfig].reverse().find((rank) => elo >= rank.minElo) ?? rankConfig[0];
}
