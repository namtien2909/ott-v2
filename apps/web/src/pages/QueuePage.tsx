import { useCallback, useEffect, useRef, useState } from "react";
import { useBeforeUnload, useBlocker, useNavigate } from "react-router-dom";
import type { MatchmakingEventEnvelope, MatchmakingPlayer, MatchmakingSnapshot } from "@ottv2/contracts";

import { routes } from "../app/routes";
import { Button, LoadingState, useToast } from "../components/ui";
import { ApiError } from "../services/http/apiError";
import { cancelQueue, getQueue, subscribeToQueue } from "../services/matchmaking/matchmakingApi";
import { acquireQueueAdmission, type QueueAdmissionLease } from "../services/matchmaking/queueAdmission";
import { applyQueueEvent, formatQueueElapsed, queueStateFromSnapshot, reconcileQueueSnapshot, type QueueUiState } from "./queueState";

export default function QueuePage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [state, setState] = useState<QueueUiState | { phase: "loading" | "error"; message?: string }>({ phase: "loading" });
  const [pending, setPending] = useState(false);
  const redirectTimer = useRef<number | undefined>(undefined);
  const redirected = useRef(false);
  const lease = useRef<QueueAdmissionLease | null>(null);
  const latest = useRef<QueueUiState | null>(null);
  const mounted = useRef(false);
  const cancelling = useRef(false);
  const terminalNavigation = useRef(false);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => !terminalNavigation.current && state.phase !== "error" && state.phase !== "cancelled" && currentLocation.pathname !== nextLocation.pathname);

  useBeforeUnload(useCallback((event) => {
    if (state.phase !== "loading" && state.phase !== "queued") return;
    event.preventDefault();
    event.returnValue = "";
  }, [state.phase]));

  const redirectToRoom = useCallback((roomId: string | null) => {
    if (!roomId || redirected.current) return;
    redirected.current = true;
    redirectTimer.current = window.setTimeout(() => {
      terminalNavigation.current = true;
      void navigate(`/room/${encodeURIComponent(roomId)}`);
    }, 650);
  }, [navigate]);

  const acceptSnapshot = useCallback((queue: MatchmakingSnapshot) => {
    const next = latest.current ? reconcileQueueSnapshot(latest.current, queue) : queueStateFromSnapshot(queue);
    latest.current = next;
    lease.current?.update(next.queue);
    if (mounted.current) setState(next);
    if (next.phase === "found" && mounted.current) redirectToRoom(next.queue.roomId);
    return next;
  }, [redirectToRoom]);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    const admission = acquireQueueAdmission();
    lease.current = admission;
    redirected.current = false;
    let unsubscribe: () => void = () => undefined;
    let resyncing = false;
    admission.promise.then((result) => {
      if (!active) return;
      acceptSnapshot(result.queue);
      const queueId = result.queue.queueId;
      const resync = async () => {
        if (!active || resyncing) return;
        resyncing = true;
        try { const synced = await getQueue(queueId); if (active) acceptSnapshot(synced.queue); }
        catch { if (active) notify("Chưa đồng bộ được hàng chờ. Hãy thử lại khi có kết nối.", "warning"); }
        finally { resyncing = false; }
      };
      unsubscribe = subscribeToQueue(result.queue.queueId, (event: MatchmakingEventEnvelope) => {
        if (!active) return;
        if (!latest.current) return;
        const next = applyQueueEvent(latest.current, event);
        latest.current = next;
        admission.update(next.queue);
        setState(next);
        if (next.phase === "found") redirectToRoom(next.queue.roomId);
      }, () => { if (active) { notify("Kết nối hàng chờ bị gián đoạn. Đang đồng bộ lại…", "warning"); void resync(); } }, () => { void resync(); });
    }).catch((reason) => {
      if (!active) return;
      if (reason instanceof ApiError && reason.status === 401) { terminalNavigation.current = true; void navigate(routes.login); }
      else setState({ phase: "error", message: reason instanceof ApiError ? reason.message : "Không thể vào hàng chờ Ranked." });
    });
    return () => { active = false; mounted.current = false; if (redirectTimer.current !== undefined) window.clearTimeout(redirectTimer.current); unsubscribe(); admission.release(); };
  }, [acceptSnapshot, navigate, notify, redirectToRoom]);

  const cancel = useCallback(async (onCancelled?: () => void, onFailure?: () => void) => {
    if (cancelling.current || !lease.current) return;
    cancelling.current = true;
    setPending(true);
    const admission = lease.current;
    const complete = (queue: MatchmakingSnapshot): boolean => {
      const next = acceptSnapshot(queue);
      if (next.phase === "found") { onFailure?.(); return true; }
      if (next.phase !== "cancelled") return false;
      terminalNavigation.current = true;
      notify("Đã huỷ tìm trận.", "success");
      if (onCancelled) onCancelled();
      else void navigate(routes.home);
      return true;
    };
    try {
      const initial = (await admission.promise).queue;
      const queue = latest.current?.queue ?? initial;
      if (queue.status !== "QUEUED" && complete(queue)) return;
      try {
        const result = await cancelQueue(queue.queueId);
        if (complete(result.queue)) return;
      } catch {
        const synced = await getQueue(queue.queueId);
        if (complete(synced.queue)) return;
      }
      throw new Error("Máy chủ chưa xác nhận huỷ tìm trận. Hãy thử lại.");
    } catch (reason) {
      if (mounted.current) { onFailure?.(); notify(reason instanceof Error ? reason.message : "Không thể xác nhận huỷ tìm trận. Hãy thử lại.", "error"); }
    } finally { cancelling.current = false; if (mounted.current) setPending(false); }
  }, [acceptSnapshot, navigate, notify]);

  useEffect(() => {
    if (blocker.state === "blocked") void cancel(() => blocker.proceed(), () => blocker.reset());
  }, [blocker, cancel]);

  if (state.phase === "loading") return <LoadingState fullPage label="Đang vào hàng chờ Ranked…" />;
  if (state.phase === "error") return <section className="placeholder queue-error"><p className="eyebrow">GHÉP TRẬN</p><h1>Không thể tìm trận</h1><p className="form-intro">{state.message}</p><Button onClick={() => window.location.reload()}>Thử lại</Button></section>;
  if (state.phase === "found") return <MatchFound queue={state.queue} />;
  if (state.phase === "cancelled") return <section className="placeholder queue-error"><p className="eyebrow">GHÉP TRẬN</p><h1>Hàng chờ đã đóng</h1><Button onClick={() => navigate(routes.home)}>Về sảnh</Button></section>;
  if (!("queue" in state)) return null;
  const queue = state.queue;
  return <section className="queue-page" aria-labelledby="queue-title"><div className="queue-header"><div><p className="eyebrow">GHÉP TRẬN XẾP HẠNG</p><h1 id="queue-title">Đang tìm đối thủ</h1><p className="queue-subtitle">Khoảng tìm kiếm mở rộng theo thời gian chờ, do máy chủ quyết định.</p></div><span className="ranked-pill">RANKED</span></div><div className="queue-scanner" aria-label="Đang quét đối thủ"><div className="scanner-ring ring-one" /><div className="scanner-ring ring-two" /><div className="scanner-ring ring-three" /><FistGlyph /></div><div className="queue-stats" aria-label="Thông tin hàng chờ"><div><span>RATING CỦA BẠN</span><strong>{queue.player.elo}</strong></div><div><span>KHOẢNG TÌM KIẾM</span><strong>±{queue.range}</strong></div><div><span>THỜI GIAN</span><strong>{formatQueueElapsed(queue.elapsedMs)}</strong></div></div><div className="queue-actions"><Button variant="danger" onClick={() => void cancel()} pending={pending} pendingLabel="Đang huỷ…">Huỷ tìm trận</Button><Button variant="secondary" onClick={() => void cancel()} disabled={pending}>Về sảnh</Button></div><p className="queue-hint" role="status">Máy chủ sẽ giữ chỗ của bạn khi tìm thấy đối thủ.</p></section>;
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
