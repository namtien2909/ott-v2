import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { MatchRating, MatchResultReason } from "@ottv2/contracts";
import type { Side } from "@ottv2/game-rules";

import { RankBadge } from "../profile/RankBadge";
import { Button } from "../ui";
import { playSound, reducedMotionEnabled } from "../../services/presentation/preferences";

export type ResultMode = "RANKED" | "UNRANKED" | "AI" | "OFFLINE" | "GUEST";
export type RematchState = "idle" | "pending" | "requested" | "opponent_requested" | "accepting";

export type ResultStats = Readonly<{
  moves: number;
  captures: number;
  piecesLost: number;
  durationSeconds: number;
}>;

export type ResultPanelProps = Readonly<{
  status: "FINISHED" | "ABORTED";
  winner: Side | null;
  viewerSide: Side | null;
  resultReason: MatchResultReason;
  mode: ResultMode;
  rating?: MatchRating | null;
  stats: ResultStats;
  rematchState?: RematchState;
  onRematch?: () => void;
  onRejectRematch?: () => void;
  onBack: () => void;
}>;

type Outcome = "victory" | "defeat" | "neutral";

const reasonCopy: Record<Exclude<MatchResultReason, null>, string> = {
  EXTINCTION: "Đối thủ đã mất toàn bộ quân.",
  GOAL_REACHED: "Bạn đã chiếm ô đích.",
  TIMEOUT: "Đối thủ đã hết thời gian.",
  SURRENDER: "Đối thủ đã đầu hàng.",
  DISCONNECT_TIMEOUT: "Đối thủ không kết nối lại.",
  SERVER_INTERRUPTION: "Máy chủ đã khởi động lại hoặc kết nối trận bị mất.",
};

function outcomeFor({ status, winner, viewerSide }: Pick<ResultPanelProps, "status" | "winner" | "viewerSide">): Outcome {
  if (status === "ABORTED" || !winner || !viewerSide) return "neutral";
  return winner === viewerSide ? "victory" : "defeat";
}

function reasonFor(reason: MatchResultReason, outcome: Outcome): string {
  if (reason === "SERVER_INTERRUPTION" || reason === "DISCONNECT_TIMEOUT" || outcome === "neutral") {
    return reason ? reasonCopy[reason] : "Không có thay đổi điểm xếp hạng.";
  }
  if (reason === "GOAL_REACHED") return outcome === "victory" ? "Bạn đã chiếm ô đích." : "Đối thủ đã chiếm ô đích.";
  if (reason === "TIMEOUT") return outcome === "victory" ? "Đối thủ đã hết thời gian." : "Bạn đã hết thời gian.";
  if (reason === "SURRENDER") return outcome === "victory" ? "Đối thủ đã đầu hàng." : "Bạn đã đầu hàng.";
  return outcome === "victory" && reason ? reasonCopy[reason] : "Bạn đã mất toàn bộ quân.";
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60).toString().padStart(2, "0")}:${(safe % 60).toString().padStart(2, "0")}`;
}

function formatDelta(delta: number): string {
  return `${delta >= 0 ? "+" : ""}${delta}`;
}

function ratingForViewer(rating: MatchRating | null | undefined, viewerSide: Side | null) {
  if (!rating || !viewerSide) return null;
  return viewerSide === "BLUE"
    ? { before: rating.blueBefore, after: rating.blueAfter, delta: rating.blueDelta }
    : { before: rating.redBefore, after: rating.redAfter, delta: rating.redDelta };
}

function AnimatedElo({ before, after }: { before: number; after: number }) {
  const [value, setValue] = useState(before);
  useEffect(() => {
    if (reducedMotionEnabled() || before === after) {
      setValue(after);
      return undefined;
    }
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 1200);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(before + (after - before) * eased));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [after, before]);
  return <strong className="result-elo-value" aria-label={`Elo sau trận ${after}`}>{value}</strong>;
}

export function ResultPanel({ status, winner, viewerSide, resultReason, mode, rating, stats, rematchState = "idle", onRematch, onRejectRematch, onBack }: ResultPanelProps) {
  const outcome = outcomeFor({ status, winner, viewerSide });
  const viewerRating = useMemo(() => ratingForViewer(rating, viewerSide), [rating, viewerSide]);
  const showRating = mode === "RANKED" && viewerRating !== null && outcome !== "neutral";
  const title = outcome === "victory" ? "CHIẾN THẮNG" : outcome === "defeat" ? "THUA CUỘC" : "TRẬN ĐẤU BỊ GIÁN ĐOẠN";
  const message = reasonFor(resultReason, outcome);
  const showOpponentPrompt = rematchState === "opponent_requested" || rematchState === "accepting";
  const resultClass = `result-panel result-${outcome} ${outcome === "defeat" ? "result-board-muted" : ""}`;

  useEffect(() => {
    if (outcome === "victory") playSound("victory");
    if (outcome === "defeat") playSound("defeat");
  }, [outcome]);

  return <section className={resultClass} aria-labelledby="match-result-title" aria-live="polite">
    {outcome === "victory" && <div className="result-fireworks" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <i key={index} style={{ "--burst-index": index } as CSSProperties} />)}</div>}
    {outcome === "defeat" && <div className="result-embers" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <i key={index} style={{ "--ember-index": index } as CSSProperties} />)}</div>}
    <div className="result-panel-heading">
      <p className="eyebrow">KẾT QUẢ TRẬN ĐẤU</p>
      <h2 id="match-result-title">{title}</h2>
      <p className="result-reason">{message}</p>
    </div>
    {showOpponentPrompt && <div className="rematch-request" role="alert"><strong>Đối thủ muốn chơi lại</strong><span>Trận chơi lại sẽ là Không xếp hạng.</span><div className="result-actions"><Button variant="secondary" onClick={onRejectRematch} disabled={rematchState === "accepting"}>Từ chối</Button><Button onClick={onRematch} pending={rematchState === "accepting"} pendingLabel="Đang đồng ý…">Đồng ý</Button></div></div>}
    {showRating && viewerRating && <div className={`result-elo-card ${viewerRating.delta >= 0 ? "rating-up" : "rating-down"}`}>
      <div className="result-elo-heading"><span>ĐIỂM XẾP HẠNG</span><span className="result-elo-delta">{formatDelta(viewerRating.delta)}</span></div>
      <div className="result-elo-value-row"><AnimatedElo before={viewerRating.before} after={viewerRating.after} /><span>Elo</span></div>
      <div className="result-elo-range"><span>{viewerRating.before}</span><span aria-hidden="true">→</span><span>{viewerRating.after}</span></div>
      <div className="result-rank-row"><RankBadge elo={viewerRating.after} /><span>{viewerRating.delta >= 0 ? "Phong độ đang lên" : "Giữ nhịp và trở lại mạnh hơn"}</span></div>
    </div>}
    <div className="result-stats" aria-label="Thống kê trận đấu">
      <div><span>SỐ NƯỚC ĐI</span><strong>{stats.moves}</strong></div>
      <div><span>QUÂN ĂN ĐƯỢC</span><strong>{stats.captures}</strong></div>
      <div><span>QUÂN BỊ MẤT</span><strong>{stats.piecesLost}</strong></div>
      <div><span>THỜI GIAN VÁN</span><strong>{formatDuration(stats.durationSeconds)}</strong></div>
    </div>
    {rematchState === "requested" && <p className="rematch-status" role="status">Đã gửi yêu cầu chơi lại. Đang chờ đối thủ…</p>}
    <div className="result-actions">
      {onRematch && !showOpponentPrompt && outcome !== "neutral" && <Button onClick={onRematch} pending={rematchState === "pending"} disabled={rematchState === "requested"} pendingLabel="Đang gửi…">{rematchState === "requested" ? "Đã gửi yêu cầu" : "ĐẤU LẠI"}</Button>}
      <Button variant="secondary" onClick={onBack}>Về sảnh</Button>
    </div>
  </section>;
}
