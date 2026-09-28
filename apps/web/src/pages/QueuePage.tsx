import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { MatchmakingEventEnvelope, MatchmakingPlayer } from "@ottv2/contracts";

import { routes } from "../app/routes";
import { Button, LoadingState, useToast } from "../components/ui";
import { ApiError } from "../services/http/apiError";
import { cancelQueue, getQueue, joinRankedQueue, subscribeToQueue } from "../services/matchmaking/matchmakingApi";
import { applyQueueEvent, formatQueueElapsed, queueStateFromSnapshot, type QueueUiState } from "./queueState";

export default function QueuePage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [state, setState] = useState<QueueUiState | { phase: "loading" | "error"; message?: string }>({ phase: "loading" });
  const [pending, setPending] = useState(false);
  const redirectTimer = useRef<number | undefined>(undefined);
  const redirected = useRef(false);

  const redirectToRoom = useCallback((roomId: string | null) => {
    if (!roomId || redirected.current) return;
    redirected.current = true;
    redirectTimer.current = window.setTimeout(() => navigate(`/room/${encodeURIComponent(roomId)}`), 650);
  }, [navigate]);

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;
    joinRankedQueue().then((result) => {
      if (!active) return;
      const initial = queueStateFromSnapshot(result.queue);
      setState(initial);
      if (initial.phase === "found") redirectToRoom(initial.queue.roomId);
      unsubscribe = subscribeToQueue(result.queue.queueId, (event: MatchmakingEventEnvelope) => {
        if (!active) return;
        setState((current) => {
          if (!("queue" in current)) return current;
          const next = applyQueueEvent(current, event);
          if (next.phase === "found") redirectToRoom(next.queue.roomId);
          return next;
        });
      }, () => { if (active) notify("Kết nối hàng chờ bị gián đoạn. Đang chờ đồng bộ lại…", "warning"); });
    }).catch((reason) => {
      if (!active) return;
      if (reason instanceof ApiError && reason.status === 401) navigate(routes.login);
      else setState({ phase: "error", message: reason instanceof ApiError ? reason.message : "Không thể vào hàng chờ Ranked." });
    });
    return () => { active = false; if (redirectTimer.current !== undefined) window.clearTimeout(redirectTimer.current); unsubscribe(); };
  }, [navigate, notify, redirectToRoom]);

  const cancel = async () => {
    if (!("queue" in state) || state.phase !== "queued") return;
    setPending(true);
    try {
      const result = await cancelQueue(state.queue.queueId);
      if (result.queue.status === "CANCELLED") { notify("Đã huỷ tìm trận.", "success"); navigate(routes.home); }
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        try {
          const synced = await getQueue(state.queue.queueId);
          const next = queueStateFromSnapshot(synced.queue);
          setState(next);
          if (next.phase === "found") { notify("Đối thủ đã được ghép. Đang mở phòng đấu…", "warning"); redirectToRoom(next.queue.roomId); }
        } catch { notify("Đối thủ đã được ghép. Đang mở phòng đấu…", "warning"); }
      } else notify(reason instanceof ApiError ? reason.message : "Không thể huỷ tìm trận.", "error");
    } finally { setPending(false); }
  };

  if (state.phase === "loading") return <LoadingState fullPage label="Đang vào hàng chờ Ranked…" />;
  if (state.phase === "error") return <section className="placeholder queue-error"><p className="eyebrow">GHÉP TRẬN</p><h1>Không thể tìm trận</h1><p className="form-intro">{state.message}</p><Button onClick={() => window.location.reload()}>Thử lại</Button></section>;
  if (state.phase === "found") return <MatchFound queue={state.queue} />;
  if (state.phase === "cancelled") return <section className="placeholder queue-error"><p className="eyebrow">GHÉP TRẬN</p><h1>Hàng chờ đã đóng</h1><Button onClick={() => navigate(routes.home)}>Về sảnh</Button></section>;
  if (!("queue" in state)) return null;
  const queue = state.queue;
  return <section className="queue-page" aria-labelledby="queue-title"><div className="queue-header"><div><p className="eyebrow">GHÉP TRẬN XẾP HẠNG</p><h1 id="queue-title">Đang tìm đối thủ</h1><p className="queue-subtitle">Khoảng tìm kiếm mở rộng theo thời gian chờ, do máy chủ quyết định.</p></div><span className="ranked-pill">RANKED</span></div><div className="queue-scanner" aria-label="Đang quét đối thủ"><div className="scanner-ring ring-one" /><div className="scanner-ring ring-two" /><div className="scanner-ring ring-three" /><FistGlyph /></div><div className="queue-stats" aria-label="Thông tin hàng chờ"><div><span>RATING CỦA BẠN</span><strong>{queue.player.elo}</strong></div><div><span>KHOẢNG TÌM KIẾM</span><strong>±{queue.range}</strong></div><div><span>THỜI GIAN</span><strong>{formatQueueElapsed(queue.elapsedMs)}</strong></div></div><div className="queue-actions"><Button variant="danger" onClick={() => void cancel()} pending={pending} pendingLabel="Đang huỷ…">Huỷ tìm trận</Button><Button variant="secondary" onClick={() => navigate(routes.home)}>Về sảnh</Button></div><p className="queue-hint" role="status">Máy chủ sẽ giữ chỗ của bạn khi tìm thấy đối thủ.</p></section>;
}

function MatchFound({ queue }: { queue: QueueUiState["queue"] }) {
  return <section className="queue-page match-found-page" aria-labelledby="match-found-title" aria-live="assertive"><p className="eyebrow">MATCH FOUND</p><div className="match-found-impact" aria-hidden="true"><span>+</span></div><h1 id="match-found-title">ĐÃ TÌM THẤY ĐỐI THỦ</h1><p className="queue-subtitle">Phòng đấu đang được mở với trạng thái server-authoritative.</p><div className="match-found-versus"><FoundPlayer side="BLUE" player={queue.player} /><strong>VS</strong><FoundPlayer side="RED" player={queue.opponent} /></div><p className="queue-hint">Đang chuyển vào waiting room…</p></section>;
}

function FoundPlayer({ side, player }: { side: "BLUE" | "RED"; player: MatchmakingPlayer | null }) {
  const name = player?.displayName ?? "Đang đồng bộ";
  return <div className={`match-found-player ${side.toLowerCase()}`}><div className="found-avatar" aria-hidden="true">{name.slice(0, 2).toUpperCase()}</div><span>{side}</span><strong>{name}</strong><small>@{player?.username ?? "—"} · {player?.elo ?? "—"} Elo</small></div>;
}

function FistGlyph() {
  return <svg className="queue-fist-glyph" viewBox="0 0 100 100" role="img" aria-label="Đang tìm đối thủ"><path d="M31 50V27c0-5 7-5 7 0v15-22c0-5 7-5 7 0v21-24c0-5 7-5 7 0v24-19c0-5 7-5 7 0v27l5-9c2-4 8-2 7 3l-4 16c-2 9-8 15-18 15H45c-8 0-14-7-14-14Z" /><path d="M38 52h29M45 42h14M45 49h17" /></svg>;
}
