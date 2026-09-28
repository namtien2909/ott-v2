import type { PieceType } from "@ottv2/game-rules";

const labels: Record<PieceType, string> = { R: "Đấm", P: "Bao", S: "Kéo" };

/** Small line-art glyphs; side color is supplied by the token, not the glyph. */
export function PieceGlyph({ type, size = 28 }: { type: PieceType; size?: number }) {
  return <svg className="piece-glyph" data-glyph={type} width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={labels[type]} focusable="false">
    {type === "R" && <path d="M8 14V9.5a2 2 0 0 1 4 0v3.3V7.4a2 2 0 0 1 4 0v5.4V6.9a2 2 0 1 1 4 0v6.2l.6-2.2a2 2 0 0 1 3.8 1.1l-1.6 7.2A7.2 7.2 0 0 1 15.8 25H13a5 5 0 0 1-4.4-2.6L6 17.7a2.1 2.1 0 0 1 2-3.1Z" />}
    {type === "P" && <path d="M10 26c-1.3-2.2-2.4-4.8-3-7.2-.6-2.4.8-4.1 2.6-3.4l2.3.9-1.2-7.7a1.9 1.9 0 0 1 3.8-.6l1 6.2-.2-9a1.9 1.9 0 0 1 3.8-.1l.5 8.8.5-7.2a1.9 1.9 0 0 1 3.8.2l-.1 8 .8-4.7a1.9 1.9 0 1 1 3.8.7l-1.2 8.2A7.8 7.8 0 0 1 19.1 26H10Z" />}
    {type === "S" && <path d="M13.2 15.5 8.4 7.2a2.2 2.2 0 0 1 3.8-2.2l4.2 7.3 4.2-7.3a2.2 2.2 0 1 1 3.8 2.2l-4.8 8.3 4.6 8.7a2.2 2.2 0 0 1-3.9 2l-3.9-7.4-3.9 7.4a2.2 2.2 0 1 1-3.9-2l4.6-8.7Z" />}
  </svg>;
}
