import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { MatchmakingEventEnvelope, MatchmakingSnapshot } from "@ottv2/contracts";

import { routes } from "../app/routes";
import { Button, LoadingState, useToast } from "../components/ui";
import { ApiError } from "../services/http/apiError";
import { cancelQueue, joinRankedQueue, subscribeToQueue } from "../services/matchmaking/matchmakingApi";

type QueueState = { kind: "loading" } | { kind: "queued"; queue: MatchmakingSnapshot } | { kind: "found"; queue: MatchmakingSnapshot } | { kind: "error"; message: string };

function formatElapsed(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export default function QueuePage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [state, setState] = useState<QueueState>({ kind: "loading" });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;
    let redirectTimer: number | undefined;
    joinRankedQueue().then((result) => {
      if (!active) return;
      setState({ kind: result.queue.status === "MATCHED" ? "found" : "queued", queue: result.queue });
      unsubscribe = subscribeToQueue(result.queue.queueId, (event: MatchmakingEventEnvelope) => {
        if (!active) return;
        const next = event.payload;
        if (event.type === "MATCH_FOUND") {
          setState({ kind: "found", queue: next });
          if (next.roomId) redirectTimer = window.setTimeout(() => navigate(`/game/${encodeURIComponent(next.roomId!)}`), 700);
        } else if (next.status === "QUEUED") setState({ kind: "queued", queue: next });
      }, () => { if (active) notify("Kết nối hàng chờ bị gián đoạn. Đang thử đồng bộ lại…", "warning"); });
    }).catch((reason) => {
      if (!active) return;
      if (reason instanceof ApiError && reason.status === 401) navigate(routes.login);
      else setState({ kind: "error", message: reason instanceof ApiError ? reason.message : "Không thể vào hàng chờ Ranked." });
    });
    return () => { active = false; if (redirectTimer !== undefined) window.clearTimeout(redirectTimer); unsubscribe(); };
  }, [navigate, notify]);

  const cancel = async () => {
    if (state.kind !== "queued") return;
    setPending(true);
    try {
      const result = await cancelQueue(state.queue.queueId);
      if (result.queue.status === "CANCELLED") { notify("Đã huỷ tìm trận.", "success"); navigate(routes.home); }
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) notify("Đối thủ đã được ghép. Đang chuyển bạn vào trận…", "warning");
      else notify(reason instanceof ApiError ? reason.message : "Không thể huỷ tìm trận.", "error");
    } finally { setPending(false); }
  };

  if (state.kind === "loading") return <LoadingState fullPage label="Đang vào hàng chờ Ranked…" />;
  if (state.kind === "error") return <section className="placeholder queue-error"><p className="eyebrow">GHÉP TRẬN</p><h1>Không thể tìm trận</h1><p className="form-intro">{state.message}</p><Button onClick={() => window.location.reload()}>Thử lại</Button></section>;
  const queue = state.queue;
  if (state.kind === "found") return <section className="queue-page match-found-page" aria-live="assertive"><p className="eyebrow">ĐÃ TÌM THẤY TRẬN</p><div className="match-found-burst" aria-hidden="true">✦</div><h1>ĐÃ TÌM THẤY ĐỐI THỦ</h1><p className="queue-subtitle">Trận xếp hạng đã được máy chủ ghép.</p><div className="match-found-versus"><QueuePlayerCard label="BLUE" player={queue.player} /><strong>VS</strong><QueuePlayerCard label="RED" player={queue.opponent ?? queue.player} /></div><p className="queue-hint">Đang mở phòng đấu…</p></section>;
  return <section className="queue-page"><div className="queue-header"><div><p className="eyebrow">GHÉP TRẬN XẾP HẠNG</p><h1>Đang tìm đối thủ</h1><p className="queue-subtitle">Ghép người chơi gần Elo nhất. Khoảng tìm kiếm sẽ mở rộng theo thời gian chờ.</p></div><span className="ranked-pill">RANKED</span></div><div className="queue-scanner" aria-hidden="true"><div className="scanner-ring" /><div className="scanner-core">✊</div></div><div className="queue-stats"><div><span>RATING CỦA BẠN</span><strong>{queue.player.elo}</strong></div><div><span>KHOẢNG TÌM KIẾM</span><strong>±{queue.range}</strong></div><div><span>THỜI GIAN</span><strong>{formatElapsed(queue.elapsedMs)}</strong></div></div><div className="queue-actions"><Button variant="danger" onClick={() => void cancel()} pending={pending} pendingLabel="Đang huỷ…">Huỷ tìm trận</Button><Button variant="secondary" onClick={() => navigate(routes.home)}>Về trang chủ</Button></div><p className="queue-hint" role="status">Máy chủ sẽ giữ chỗ của bạn khi tìm thấy đối thủ.</p></section>;
}

function QueuePlayerCard({ label, player }: { label: string; player: MatchmakingSnapshot["player"] | null }) {
  return <div className={`match-found-player ${label.toLowerCase()}`}><span>{label}</span><strong>{player?.displayName ?? "Đang đồng bộ"}</strong><small>@{player?.username ?? "—"} · {player?.elo ?? "—"} Elo</small></div>;
}
