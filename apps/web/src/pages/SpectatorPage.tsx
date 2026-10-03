import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { MatchEventEnvelope, MatchEventType, MatchSnapshot } from "@ottv2/contracts";
import { type RuleState, type Side } from "@ottv2/game-rules";
import { routes } from "../app/routes";
import { GameBoard } from "../components/board";
import { Button, LoadingState, UiGlyph } from "../components/ui";
import { ApiError } from "../services/http/apiError";
import { getSpectatorMatch, requestSpectator, subscribeToSpectator, leaveSpectator } from "../services/rooms/spectatorApi";
import { ensureGuestSession } from "../services/guest/guestApi";

type SpectatorActivity = { id: string; kind: "move" | "combat" | "sync"; label: string; detail: string };
type SpectatorState =
  | { kind: "loading" }
  | { kind: "password"; message: string }
  | { kind: "ready"; roomName: string; spectatorCount: number; match: MatchSnapshot; connection: "connected" | "reconnecting"; activities: SpectatorActivity[] }
  | { kind: "error"; message: string };

const eventDescriptions: Partial<Record<MatchEventType, { kind: SpectatorActivity["kind"]; label: string }>> = {
  MATCH_SNAPSHOT: { kind: "sync", label: "Đã đồng bộ trạng thái trận" },
  STATE_RESYNC: { kind: "sync", label: "Đã resync trạng thái canonical" },
  PIECE_MOVE_ACCEPTED: { kind: "move", label: "Nước đi mới đã được chấp nhận" },
  PLAYER_SURRENDERED: { kind: "combat", label: "Một người chơi đã đầu hàng" },
  MATCH_FINISHED: { kind: "combat", label: "Trận đấu đã kết thúc" },
  MATCH_ABORTED: { kind: "combat", label: "Trận đấu bị gián đoạn" },
};

function toRuleState(match: MatchSnapshot): RuleState {
  return { board: match.board as RuleState["board"], pieceCounts: match.pieceCounts, currentTurn: match.currentTurn, status: match.status === "FINISHED" || match.status === "ABORTED" ? "FINISHED" : "PLAYING", winner: match.winner, resultReason: match.resultReason === "EXTINCTION" || match.resultReason === "GOAL_REACHED" ? match.resultReason : null };
}

function formatClock(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(totalSeconds / 60).toString().padStart(2, "0")}:${(totalSeconds % 60).toString().padStart(2, "0")}`;
}

function playerName(match: MatchSnapshot, side: Side): string { return match.players.find((player) => player.side === side)?.displayName ?? (side === "BLUE" ? "Người chơi Xanh" : "Người chơi Đỏ"); }
function sideLabel(side: Side | null): string { return side === "BLUE" ? "Xanh" : side === "RED" ? "Đỏ" : "—"; }
function statusLabel(status: MatchSnapshot["status"]): string { return ({ WAITING_READY: "Đang chờ sẵn sàng", COUNTDOWN: "Đếm ngược", PLAYING: "Đang thi đấu", FINISHED: "Đã kết thúc", ABORTED: "Đã gián đoạn" } as const)[status]; }
function snapshotActivity(match: MatchSnapshot, type: "MATCH_SNAPSHOT" | "STATE_RESYNC"): SpectatorActivity {
  return { id: `${match.matchId}:${type}:${match.stateVersion}`, kind: "sync", label: eventDescriptions[type]?.label ?? "Đã đồng bộ trạng thái trận", detail: `Phiên bản ${match.stateVersion} · sequence ${match.sequence}` };
}
function eventActivity(event: MatchEventEnvelope): SpectatorActivity | null {
  const description = eventDescriptions[event.type];
  return description ? { id: `${event.matchId}:${event.sequence}:${event.type}`, ...description, detail: `Phiên bản ${event.stateVersion} · sequence ${event.sequence}` } : null;
}
function appendActivity(current: SpectatorActivity[], next: SpectatorActivity | null): SpectatorActivity[] {
  if (!next || current.some((item) => item.id === next.id)) return current;
  return [next, ...current].slice(0, 12);
}
function isSnapshotCurrentOrNewer(next: MatchSnapshot, current: MatchSnapshot): boolean {
  return next.matchId === current.matchId && next.roomId === current.roomId && next.stateVersion >= current.stateVersion && next.sequence >= current.sequence;
}
function spectatorErrorMessage(reason: unknown): string {
  if (!(reason instanceof ApiError)) return "Không thể kết nối chế độ xem. Vui lòng thử lại.";
  const status = reason.status ?? 0;
  if (status === 403) return "Phòng này không cho phép người xem.";
  if (status === 404) return "Phòng đấu không tồn tại hoặc đã đóng.";
  if (status === 409) return "Phòng xem đã đủ người.";
  if (status >= 500) return "Dịch vụ xem trận đang tạm thời không khả dụng.";
  return "Không thể tải chế độ xem. Vui lòng thử lại.";
}

export default function SpectatorPage() {
  const { roomId = "" } = useParams<{ roomId: string }>();
  const [state, setState] = useState<SpectatorState>({ kind: "loading" });
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const resyncInFlight = useRef(false);
  const connectInFlight = useRef<Promise<void> | null>(null);
  const spectatorLifecycle = useRef(0);
  const activeSpectatorRoom = useRef<string | null>(null);

  const connect = useCallback((nextPassword?: string): Promise<void> => {
    if (connectInFlight.current) return connectInFlight.current;
    const operation = (async (): Promise<void> => {
    setPending(true);
    setState({ kind: "loading" });
    try {
      await ensureGuestSession().catch(() => undefined);
      await requestSpectator(roomId, nextPassword);
      const result = await getSpectatorMatch(roomId);
      setState({ kind: "ready", roomName: result.room.name, spectatorCount: result.spectatorCount, match: result.match, connection: "connected", activities: [snapshotActivity(result.match, "MATCH_SNAPSHOT")] });
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) setState({ kind: "password", message: "Phòng này cần mật khẩu để xem. Kiểm tra lại mật khẩu rồi thử lại." });
      else setState({ kind: "error", message: spectatorErrorMessage(reason) });
    } finally { setPending(false); }
    })();
    connectInFlight.current = operation;
    operation.finally(() => { if (connectInFlight.current === operation) connectInFlight.current = null; }).catch(() => undefined);
    return operation;
  }, [roomId]);

  const resync = useCallback(async (): Promise<void> => {
    if (resyncInFlight.current) return;
    resyncInFlight.current = true;
    try {
      const result = await getSpectatorMatch(roomId);
      setState((current) => {
        if (current.kind !== "ready" || !isSnapshotCurrentOrNewer(result.match, current.match)) return current;
        return { ...current, roomName: result.room.name, spectatorCount: result.spectatorCount, match: result.match, connection: "connected", activities: appendActivity(current.activities, snapshotActivity(result.match, "STATE_RESYNC")) };
      });
      window.dispatchEvent(new CustomEvent("ottv2:network-state", { detail: { state: "CONNECTED" } }));
    } catch {
      // EventSource keeps retrying; keep the last canonical snapshot visible while reconnecting.
    } finally { resyncInFlight.current = false; }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) { setState({ kind: "error", message: "Thiếu Room ID." }); return undefined; }
    if (activeSpectatorRoom.current && activeSpectatorRoom.current !== roomId) void leaveSpectator(activeSpectatorRoom.current).catch(() => undefined);
    activeSpectatorRoom.current = roomId;
    const lifecycle = spectatorLifecycle.current + 1;
    spectatorLifecycle.current = lifecycle;
    void connect();
    return () => {
      window.setTimeout(() => {
        if (spectatorLifecycle.current !== lifecycle) return;
        activeSpectatorRoom.current = null;
        void leaveSpectator(roomId).catch(() => undefined);
      }, 0);
    };
  }, [connect, roomId]);
  useEffect(() => {
    if (state.kind !== "ready") return undefined;
    let active = true;
    const unsubscribe = subscribeToSpectator(roomId, (event: MatchEventEnvelope) => {
      if (!active) return;
      setState((current) => {
        if (current.kind !== "ready" || !isSnapshotCurrentOrNewer(event.payload, current.match)) return current;
        return { ...current, match: event.payload, connection: "connected", activities: appendActivity(current.activities, eventActivity(event)) };
      });
      window.dispatchEvent(new CustomEvent("ottv2:network-state", { detail: { state: "CONNECTED" } }));
    }, () => {
      if (!active) return;
      setState((current) => current.kind === "ready" ? { ...current, connection: "reconnecting" } : current);
      window.dispatchEvent(new CustomEvent("ottv2:network-state", { detail: { state: "RECONNECTING" } }));
      void resync();
    });
    return () => { active = false; unsubscribe(); };
  }, [resync, roomId, state.kind]);

  if (state.kind === "loading") return <LoadingState fullPage label="Đang kết nối chế độ xem…" />;
  if (state.kind === "password") return <section className="spectator-page spectator-state"><div className="spectator-card"><p className="eyebrow">PHÒNG RIÊNG TƯ</p><h1>Cần mật khẩu phòng</h1><p className="form-intro">Phòng này giới hạn người xem. Nhập mật khẩu để tiếp tục.</p><form className="form-stack" onSubmit={(event: FormEvent) => { event.preventDefault(); void connect(password); }}><label>Mật khẩu phòng<input autoFocus value={password} onChange={(event) => setPassword(event.target.value)} maxLength={12} /></label><p className="form-error" role="alert">{state.message}</p><div className="modal-actions"><Link className="button secondary" to={routes.home}>Quay lại</Link><Button type="submit" pending={pending}>Xem trận</Button></div></form></div></section>;
  if (state.kind === "error") return <section className="placeholder spectator-error"><p className="eyebrow">KHÔNG THỂ XEM TRẬN</p><h1>Không thể xem trận</h1><p className="form-intro">{state.message}</p><div className="result-actions"><Button variant="secondary" onClick={() => void connect()}>Thử lại</Button><Link className="button primary" to={routes.home}>Về sảnh</Link></div></section>;

  const match = state.match;
  const board = toRuleState(match);
  const resultText = match.status === "ABORTED" ? "Trận bị gián đoạn" : match.winner ? `${playerName(match, match.winner)} thắng` : match.status === "FINISHED" ? "Trận kết thúc" : `Lượt phe ${sideLabel(match.currentTurn)}`;
  const moveActivities = state.activities.filter((activity) => activity.kind === "move");
  const combatActivities = state.activities.filter((activity) => activity.kind === "combat");
  return <section className="game-room-page spectator-page"><div className="game-room-header"><div><p className="eyebrow"><UiGlyph name="spectator" size={14} /> ĐANG XEM</p><h1>{state.roomName}</h1><p className="game-room-subtitle">Chế độ xem · bàn cờ chuẩn</p></div><div className="game-header-actions"><span className="spectator-count"><UiGlyph name="spectator" size={14} /> {state.spectatorCount} người xem</span><Link className="button secondary" to={routes.home}>Rời phòng</Link></div></div>{state.connection === "reconnecting" && <div className="reconnect-overlay reconnecting" role="status" aria-live="polite"><strong>Đang kết nối lại chế độ xem</strong><span>Đang chờ resync trạng thái canonical mới nhất.</span></div>}<div className="spectator-banner" role="status"><strong>Chế độ xem</strong><span>Bàn cờ luôn đặt Xanh ở phía dưới. Không thể chọn quân hoặc gửi lệnh trong trận.</span></div><div className="match-hud" aria-label="HUD người xem"><SpectatorHud match={match} side="BLUE" /><div className="match-center-status"><strong>{resultText}</strong><small>{statusLabel(match.status)} · phiên bản {match.stateVersion}</small></div><SpectatorHud match={match} side="RED" /></div><div className="game-room-layout spectator-layout"><div><GameBoard state={board} viewSide="BLUE" interactionSide={null} disabled /><p className="spectator-readonly" role="note"><UiGlyph name="spectator" size={14} /> Chỉ xem · nước đi và ô hợp lệ đã bị khoá.</p></div><aside className="game-room-info" aria-label="Thông tin chế độ xem"><div className="info-card blue-card"><span>XANH / ĐỒNG HỒ</span><strong>{formatClock(match.clocksMs.BLUE)}</strong><small>{playerName(match, "BLUE")}</small></div><div className="info-card red-card"><span>ĐỎ / ĐỒNG HỒ</span><strong>{formatClock(match.clocksMs.RED)}</strong><small>{playerName(match, "RED")}</small></div><div className="result-card"><span>NGƯỜI XEM</span><strong>{state.spectatorCount}</strong><small>Cập nhật trực tiếp theo trạng thái trận đấu.</small></div></aside></div><div className="spectator-feed-grid"><ActivityFeed title="Nhật ký nước đi" empty="Chưa có nước đi mới." activities={moveActivities} /><ActivityFeed title="Combat feed" empty="Chưa có diễn biến kết quả." activities={combatActivities} /></div></section>;
}

function ActivityFeed({ title, empty, activities }: { title: string; empty: string; activities: SpectatorActivity[] }) { return <section className="info-card spectator-feed-card" aria-label={title}><span>{title.toUpperCase()}</span>{activities.length === 0 ? <p className="spectator-feed-empty">{empty}</p> : <ol>{activities.map((activity) => <li key={activity.id}><strong>{activity.label}</strong><small>{activity.detail}</small></li>)}</ol>}</section>; }

function SpectatorHud({ match, side }: { match: MatchSnapshot; side: Side }) { return <div className={`player-hud ${side.toLowerCase()} ${match.currentTurn === side ? "active" : ""}`}><span className="player-side">{side === "BLUE" ? "XANH" : "ĐỎ"}</span><strong>{playerName(match, side)}</strong><span>{formatClock(match.clocksMs[side])}</span><small>CHỈ XEM</small></div>; }
