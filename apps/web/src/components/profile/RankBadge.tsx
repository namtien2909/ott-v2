import { deriveRank } from "./rankConfig";

export function RankBadge({ elo }: { elo: number }) {
  const rank = deriveRank(elo);

  return (
    <span className="rank-badge" data-rank={rank.id} aria-label={`Hạng ${rank.label}, Elo ${elo}`}>
      <span className="rank-badge-shield" aria-hidden="true">◆</span>
      <span className="rank-badge-copy">
        <strong>{rank.label}</strong>
        <span className="rank-badge-chevrons" aria-hidden="true">{"›".repeat(rank.chevrons)}</span>
      </span>
    </span>
  );
}
