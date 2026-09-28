import type { HistoryMatchCard } from "@ottv2/contracts";

import { PieceGlyph } from "../board/PieceGlyph";

const files = ["a", "b", "c", "d", "e", "f", "g", "h", "i"] as const;
const ranks = [9, 8, 7, 6, 5, 4, 3, 2, 1] as const;

/** Read-only, canonical BLUE-bottom rendering of the final server board. */
export function FinalPositionThumbnail({ board }: { board: HistoryMatchCard["finalBoard"] }) {
  if (!board) {
    return <div className="final-position-unavailable" role="status">Vị trí cuối chưa có trong bản lưu trận này.</div>;
  }

  return (
    <div className="final-position" role="img" aria-label="Vị trí cuối cùng của bàn cờ, góc nhìn canonical Xanh ở dưới">
      <div className="final-position-label">VỊ TRÍ CUỐI · CANONICAL</div>
      <div className="final-position-board" aria-hidden="true">
        {ranks.flatMap((rank) => files.map((file) => {
          const coordinate = `${file}${rank}`;
          const piece = board[coordinate];
          const goal = coordinate === "i9" ? "blue-goal" : coordinate === "a1" ? "red-goal" : "";
          return <span className={`final-position-square ${goal} ${piece?.side.toLowerCase() ?? "empty"}`} data-coordinate={coordinate} key={coordinate}>
            {piece && <span className="final-position-piece"><PieceGlyph type={piece.type} size={18} /></span>}
          </span>;
        }))}
      </div>
      <div className="final-position-caption">Không thể thao tác · chỉ xem</div>
    </div>
  );
}
