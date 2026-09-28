import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { MatchEventEnvelope, MatchSnapshot } from "@ottv2/contracts";
import { createInitialState, type Coordinate, type RuleState, type Side } from "@ottv2/game-rules";
import { routes } from "../app/routes";
import { GameBoard } from "../components/board";
import { Button, LoadingState, Modal, useToast } from "../components/ui";
import { ApiError } from "../services/http/apiError";
import { fastReady, getMatch, requestRematch, setReady, submitMove, surrender, subscribeToMatch } from "../services/rooms/matchApi";
import { getTabId } from "../services/session/clientIdentity";
import { applyPresentationPreferences, playSound } from "../services/presentation/preferences";
import { createSemanticEvent, semanticEventBus, type SemanticEventType } from "../foundation/eventBus";

type OnlineState = { kind: "loading" } | { kind: "ready"; match: MatchSnapshot; viewerSide: Side | null; connection: "connecting" | "connected" | "reconnecting" | "offline"; lastEvent?: string } | { kind: "error"; message: string };

function toRuleState(match: MatchSnapshot): RuleState {
  return {
    board: match.board as RuleState["board"],
    pieceCounts: match.pieceCounts,
    currentTurn: match.currentTurn,
    status: match.status === "FINISHED" || match.status === "ABORTED" ? "FINISHED" : "PLAYING",
    winner: match.winner,
    resultReason: match.resultReason === "EXTINCTION" || match.resultReason === "GOAL_REACHED" ? match.resultReason : null,
  };
}

function formatClock(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(totalSeconds / 60).toString().padStart(2, "0")}:${(totalSeconds % 60).toString().padStart(2, "0")}`;
}

function playerLabel(match: MatchSnapshot, side: Side): string {
  return match.players.find((player) => player.side === side)?.displayName ?? (side === "BLUE" ? "Người chơi Xanh" : "Người chơi Đỏ");
}

export default function GameRoomPage() {
  const { roomId = "w1-demo" } = useParams();
  const isFixture = roomId === "w1-demo" || roomId.startsWith("w1-");
  const { notify } = useToast();
  const fixtureState = useMemo(() => createInitialState(), []);
  const [viewSide, setViewSide] = useState<Side>("BLUE");
  const [online, setOnline] = useState<OnlineState>({ kind: "loading" });
  const [confirmSurrender, setConfirmSurrender] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("ottv2:sound") !== "off");
  const [countdownSound, setCountdownSound] = useState(() => localStorage.getItem("ottv2:countdown-sound") !== "off");
  const [soundVolume, setSoundVolume] = useState(() => Number(localStorage.getItem("ottv2:sound-volume") ?? 55));
  const [pending, setPending] = useState(false);
  const [lockConflict, setLockConflict] = useState(false);
  const [, setClockPulse] = useState(0);

  useEffect(() => {
    if (isFixture) return undefined;
    let active = true;
    let unsubscribe: () => void = () => undefined;
    let offlineTimer: number | undefined;
    setOnline({ kind: "loading" });
    getMatch(roomId).then((result) => {
      if (!active) return;
      const viewerSide = result.viewerSide;
      if (viewerSide) setViewSide(viewerSide);
      setOnline({ kind: "ready", match: result.match, viewerSide, connection: "connecting" });
      unsubscribe = subscribeToMatch(roomId, (event: MatchEventEnvelope) => {
        if (!active) return;
        if (offlineTimer !== undefined) window.clearTimeout(offlineTimer);
        window.dispatchEvent(new CustomEvent("ottv2:network-state", { detail: { state: "CONNECTED" } }));
        const semanticType = semanticTypeForMatchEvent(event.type);
        if (semanticType) semanticEventBus.emit(createSemanticEvent({ eventId: `${event.matchId}:${event.sequence}`, stateVersion: event.stateVersion, source: "match.realtime", type: semanticType, payload: event.payload }));
        setOnline((current) => current.kind === "ready" ? { ...current, match: event.payload, connection: "connected", lastEvent: event.type } : current);
      }, () => {
        if (!active) return;
        window.dispatchEvent(new CustomEvent("ottv2:network-state", { detail: { state: "RECONNECTING" } }));
        setOnline((current) => current.kind === "ready" ? { ...current, connection: "reconnecting" } : current);
        if (offlineTimer !== undefined) window.clearTimeout(offlineTimer);
        offlineTimer = window.setTimeout(() => {
          if (!active) return;
          window.dispatchEvent(new CustomEvent("ottv2:network-state", { detail: { state: "OFFLINE" } }));
          setOnline((current) => current.kind === "ready" ? { ...current, connection: "offline" } : current);
        }, 5000);
      });
      setOnline((current) => current.kind === "ready" ? { ...current, connection: "connected" } : current);
      return unsubscribe;
    }).catch((reason) => { if (active) setOnline({ kind: "error", message: reason instanceof ApiError ? reason.message : "Không thể kết nối match." }); });
    return () => { active = false; if (offlineTimer !== undefined) window.clearTimeout(offlineTimer); unsubscribe(); };
  }, [isFixture, roomId]);

  useEffect(() => {
    if (isFixture) return undefined;
    const tabId = getTabId();
    const storageKey = "ottv2:active-game-lock";
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("ottv2:active-game") : null;
    const readLock = (): { roomId?: string; tabId?: string; updatedAt?: number } | null => {
      try {
        const raw = localStorage.getItem(storageKey);
        return raw ? JSON.parse(raw) as { roomId?: string; tabId?: string; updatedAt?: number } : null;
      } catch { return null; }
    };
    let ownsLock = false;
    const claim = () => {
      const existing = readLock();
      const isFresh = Boolean(existing?.updatedAt && Date.now() - existing.updatedAt < 10000);
      if (isFresh && existing?.tabId && existing.tabId !== tabId) {
        setLockConflict(true);
        ownsLock = false;
        return;
      }
      const next = JSON.stringify({ roomId, tabId, updatedAt: Date.now() });
      localStorage.setItem(storageKey, next);
      ownsLock = true;
      setLockConflict(false);
      channel?.postMessage({ type: "CLAIM", roomId, tabId });
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      const next = readLock();
      if (next?.tabId && next.tabId !== tabId && next.roomId !== roomId) setLockConflict(true);
      else if (!next || next.tabId === tabId) setLockConflict(false);
    };
    const onBroadcast = (event: MessageEvent<{ type?: string; roomId?: string; tabId?: string }>) => {
      if (event.data?.tabId === tabId) return;
      if (event.data?.type === "CLAIM") setLockConflict(true);
      if (event.data?.type === "RELEASE") setLockConflict(false);
    };
    claim();
    window.addEventListener("storage", onStorage);
    channel?.addEventListener("message", onBroadcast);
    const refresh = window.setInterval(() => { if (ownsLock) claim(); }, 2000);
    return () => {
      window.clearInterval(refresh);
      window.removeEventListener("storage", onStorage);
      channel?.removeEventListener("message", onBroadcast);
      if (ownsLock) {
        const current = readLock();
        if (current?.tabId === tabId && current.roomId === roomId) localStorage.removeItem(storageKey);
        channel?.postMessage({ type: "RELEASE", roomId, tabId });
      }
      channel?.close();
    };
  }, [isFixture, roomId]);

  const currentMatch = online.kind === "ready" ? online.match : null;
  useEffect(() => {
    const event = online.kind === "ready" ? online.lastEvent : undefined;
    if (event === "MATCH_STARTED") playSound("countdown");
    else if (event === "MOVE_ACCEPTED") playSound("move");
    else if (event === "MATCH_FINISHED") playSound("victory");
  }, [online]);
  const currentStatus = currentMatch?.status;
  const currentCountdownEndsAt = currentMatch?.countdownEndsAt;
  useEffect(() => {
    if (currentStatus !== "COUNTDOWN") return undefined;
    const timer = window.setInterval(() => setClockPulse((value) => value + 1), 200);
    return () => window.clearInterval(timer);
  }, [currentStatus, currentCountdownEndsAt]);
  useEffect(() => {
    if (!currentMatch || (currentMatch.status !== "PLAYING" && currentMatch.status !== "COUNTDOWN")) return undefined;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [currentMatch]);

  const updateMatch = useCallback((match: MatchSnapshot) => setOnline((current) => current.kind === "ready" ? { ...current, match, connection: "connected" } : current), []);
  const runCommand = useCallback(async (command: () => Promise<{ match: MatchSnapshot }>, successMessage?: string) => {
    if (lockConflict || online.kind !== "ready" || online.connection !== "connected") {
      notify(lockConflict ? "Phòng đang được mở ở tab khác." : "Đang mất kết nối — thao tác tạm thời bị khoá.", "warning");
      return;
    }
    setPending(true);
    try { const result = await command(); updateMatch(result.match); if (successMessage) notify(successMessage, "success"); }
    catch (reason) { notify(reason instanceof ApiError ? reason.message : "Thao tác match thất bại.", "error"); }
    finally { setPending(false); }
  }, [lockConflict, notify, online, updateMatch]);
  useEffect(() => {
    if (online.kind !== "ready" || online.match.status !== "COUNTDOWN" || online.viewerSide === null) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || (event.target instanceof HTMLInputElement) || (event.target instanceof HTMLTextAreaElement)) return;
      event.preventDefault();
      void runCommand(() => fastReady(roomId));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [online, roomId, runCommand]);

  if (isFixture) return <FixtureRoom roomId={roomId} state={fixtureState} viewSide={viewSide} setViewSide={setViewSide} />;
  if (online.kind === "loading") return <LoadingState fullPage label="Đang kết nối Game Room…" />;
  if (online.kind === "error") return <section className="placeholder"><p className="eyebrow">LỖI KẾT NỐI</p><h1>Không thể vào phòng</h1><p className="form-intro">{online.message}</p><Link className="button primary" to={routes.home}>Về trang chủ</Link></section>;

  const match = online.match;
  const state = toRuleState(match);
  const nearSide: Side = online.viewerSide ?? "BLUE";
  const farSide: Side = nearSide === "BLUE" ? "RED" : "BLUE";
  const canPlay = match.status === "PLAYING" && online.connection === "connected" && !lockConflict && online.viewerSide !== null && match.currentTurn === online.viewerSide;
  const isReady = online.viewerSide ? Boolean(match.players.find((player) => player.side === online.viewerSide)?.ready) : false;
  const countdown = match.countdownEndsAt ? Math.max(0, Math.ceil((match.countdownEndsAt - Date.now()) / 1000)) : null;
  const resultText = match.resultReason === "TIMEOUT" ? "Hết giờ" : match.resultReason === "SURRENDER" ? "Đầu hàng" : match.resultReason === "SERVER_INTERRUPTION" ? "Trận đấu bị gián đoạn" : match.resultReason === "GOAL_REACHED" ? "Chiếm ô đích" : match.resultReason === "EXTINCTION" ? "Đối thủ mất toàn bộ Kéo" : "Kết thúc";

  return <section className="game-room-page online-game-room"><div className="game-room-header"><div><p className="eyebrow">TRẬN ĐẤU TRỰC TUYẾN</p><h1>Phòng đấu {roomId}</h1><p className="game-room-subtitle">{match.mode === "RANKED" ? "Xếp hạng" : "Không xếp hạng"} · trạng thái đồng bộ trực tiếp</p></div><div className="game-header-actions"><span className={`connection-badge ${online.connection}`} role="status"><span className="status-dot" />{connectionLabel(online.connection)}</span><Button variant="secondary" onClick={() => setSettingsOpen(true)}>⚙ <span className="visually-hidden">Mở </span>Cài đặt</Button></div></div>
    {(online.connection !== "connected" || lockConflict) && <div className={`reconnect-overlay ${lockConflict ? "tab-lock" : online.connection}`} role="status" aria-live="polite"><strong>{lockConflict ? "Phòng đang mở ở tab khác" : online.connection === "offline" ? "Mất kết nối tới trận đấu" : "Đang kết nối lại trận đấu"}</strong><span>{lockConflict ? "Đóng tab kia để tiếp tục hoặc tải lại trang sau khi tab kia kết thúc." : online.connection === "offline" ? "Trạng thái máy chủ gần nhất vẫn được giữ; bàn cờ đã bị khoá." : "Đang chờ kết nối lại và đồng bộ trạng thái mới nhất."}</span>{online.connection === "offline" && <Button variant="secondary" onClick={() => window.location.reload()}>Tải lại</Button>}</div>}
    <div className="match-status-bar" aria-live="polite"><strong>{match.status === "WAITING_READY" ? "Sẵn sàng?" : match.status === "COUNTDOWN" ? `Bắt đầu sau ${countdown ?? 0}` : match.status === "PLAYING" ? canPlay ? "LƯỢT CỦA BẠN" : "LƯỢT ĐỐI THỦ" : resultText}</strong><small>{match.status === "PLAYING" ? "Bàn cờ đang đồng bộ" : "Trạng thái trận đấu"}</small></div>
    {match.status === "WAITING_READY" && <div className="ready-panel"><p>Hai người chơi cùng nhấn Sẵn sàng để bắt đầu đếm ngược 3 giây.</p><Button onClick={() => online.viewerSide && void runCommand(() => setReady(roomId, !isReady), isReady ? "Đã huỷ sẵn sàng." : "Đã sẵn sàng.")} disabled={!online.viewerSide || pending || lockConflict || online.connection !== "connected"}>{isReady ? "Huỷ sẵn sàng" : "Sẵn sàng"}</Button></div>}
    {match.status === "COUNTDOWN" && <div className="countdown-banner" role="status" aria-live="assertive"><strong>{countdown ?? 0}</strong><span>Nhấn SPACE để bắt đầu ngay</span></div>}
    <div className="game-room-layout"><div><div className="perspective-stage"><div className="perspective-hud far" data-perspective-side={farSide}><span className="perspective-label">ĐỐI THỦ · PHÍA XA</span><PlayerHud match={match} side={farSide} low={match.clocksMs[farSide] <= 10000} /></div><GameBoard state={state} viewSide={viewSide} interactionSide={online.viewerSide} disabled={!canPlay || pending} onMove={(from: Coordinate, to: Coordinate) => { if (online.viewerSide) void runCommand(() => submitMove(roomId, from, to, match.stateVersion)); }} /><div className="perspective-hud near" data-perspective-side={nearSide}><span className="perspective-label">BẠN · PHÍA GẦN</span><PlayerHud match={match} side={nearSide} low={match.clocksMs[nearSide] <= 10000} /></div></div><div className="match-actions"><span className="turn-copy">{match.status === "PLAYING" ? canPlay ? "Đến lượt bạn — chọn quân rồi chọn ô đích." : `Đang chờ ${match.currentTurn === "BLUE" ? playerLabel(match, "BLUE") : playerLabel(match, "RED")}.` : "Bàn cờ chỉ nhận nước đi khi trận đang diễn ra."}</span>{match.status === "PLAYING" && <Button variant="danger" onClick={() => setConfirmSurrender(true)} disabled={pending || lockConflict || online.connection !== "connected"}>Đầu hàng</Button>}</div></div><aside className="game-room-info" aria-label="Thông tin trận đấu"><PerspectiveInfoCard match={match} side={farSide} /><PerspectiveInfoCard match={match} side={nearSide} />{(match.status === "FINISHED" || match.status === "ABORTED") && <div className="result-card"><span>KẾT QUẢ TRẬN ĐẤU</span><strong>{match.status === "ABORTED" ? "Trận đấu bị gián đoạn" : match.winner === online.viewerSide ? "Chiến thắng" : match.winner ? "Thất bại" : "Không có người thắng"}</strong><small>{resultText}</small>{match.mode === "RANKED" && match.rating && <small className="rating-result">Elo · XANH {formatDelta(match.rating.blueDelta)} · ĐỎ {formatDelta(match.rating.redDelta)}</small>}<div className="result-actions">{match.status === "FINISHED" && <Button onClick={() => online.viewerSide && void runCommand(() => requestRematch(roomId, match.stateVersion), "Đã gửi yêu cầu chơi lại.")} disabled={pending || lockConflict || online.connection !== "connected"}>Chơi lại</Button>}<Link className="button secondary" to={routes.home}>Về trang chủ</Link></div></div>}</aside></div>
    <Modal open={confirmSurrender} title="Bạn chắc chắn muốn đầu hàng?" description="Kết quả sẽ do máy chủ ghi nhận và không thể hoàn tác." dismissible={false} onClose={() => setConfirmSurrender(false)}><div className="modal-actions"><Button variant="secondary" onClick={() => setConfirmSurrender(false)}>Hủy</Button><Button variant="danger" onClick={() => { setConfirmSurrender(false); void runCommand(() => surrender(roomId, match.stateVersion), "Đã đầu hàng."); }}>Đầu hàng</Button></div></Modal>
    <Modal open={settingsOpen} title="Cài đặt trong trận" description="Các tuỳ chọn này chỉ thay đổi phần hiển thị và âm thanh." onClose={() => setSettingsOpen(false)}><div className="form-stack"><label className="check-row"><input type="checkbox" checked={soundEnabled} onChange={(event) => { const enabled = event.target.checked; setSoundEnabled(enabled); localStorage.setItem("ottv2:sound", enabled ? "on" : "off"); }} /> Âm thanh giao diện</label><label>Âm lượng hiệu ứng <input type="range" min="0" max="100" value={soundVolume} onChange={(event) => { const value = Number(event.target.value); setSoundVolume(value); localStorage.setItem("ottv2:sound-volume", String(value)); }} aria-valuetext={`${soundVolume}%`} /></label><label className="check-row"><input type="checkbox" checked={countdownSound} onChange={(event) => { const enabled = event.target.checked; setCountdownSound(enabled); localStorage.setItem("ottv2:countdown-sound", enabled ? "on" : "off"); }} /> Âm thanh đếm ngược</label><label className="check-row"><input type="checkbox" defaultChecked={localStorage.getItem("ottv2:reduced-motion") === "on"} onChange={(event) => { localStorage.setItem("ottv2:reduced-motion", event.target.checked ? "on" : "off"); applyPresentationPreferences(); }} /> Giảm chuyển động</label><Button variant="secondary" onClick={() => setSettingsOpen(false)}>Đóng</Button></div></Modal>
  </section>;
}

function formatDelta(delta: number): string { return `${delta >= 0 ? "+" : ""}${delta}`; }
function connectionLabel(connection: "connecting" | "connected" | "reconnecting" | "offline"): string { return connection === "connected" ? "Đã kết nối" : connection === "connecting" ? "Đang kết nối" : connection === "reconnecting" ? "Đang kết nối lại" : "Mất kết nối"; }

function semanticTypeForMatchEvent(type: MatchEventEnvelope["type"]): SemanticEventType | null {
  const mapping: Partial<Record<MatchEventEnvelope["type"], SemanticEventType>> = {
    PLAYER_READY: "READY",
    COUNTDOWN_STARTED: "COUNTDOWN",
    MATCH_STARTED: "COUNTDOWN",
    PIECE_MOVE_ACCEPTED: "MOVE",
    PLAYER_SURRENDERED: "SURRENDER",
    MATCH_FINISHED: "VICTORY",
    MATCH_ABORTED: "SERVER_INTERRUPTION",
    CLOCK_TICK: "CLOCK_WARNING",
    REMATCH_REQUESTED: "REMATCH",
  };
  return mapping[type] ?? null;
}

function PlayerHud({ match, side, low }: { match: MatchSnapshot; side: Side; low: boolean }) {
  const player = match.players.find((item) => item.side === side);
  return <div className={`player-hud ${side.toLowerCase()} ${match.currentTurn === side ? "active" : ""}`}><span className="player-side">{side === "BLUE" ? "XANH" : "ĐỎ"}</span><strong>{player?.displayName ?? "Đang chờ đối thủ"}</strong><span className={low ? "low-time" : ""}>{formatClock(match.clocksMs[side])}</span><small>{player?.connected === false ? "Mất kết nối" : player?.ready ? "Đã sẵn sàng" : "Chưa sẵn sàng"}</small></div>;
}

function PerspectiveInfoCard({ match, side }: { match: MatchSnapshot; side: Side }) {
  return <div className={`info-card ${side.toLowerCase()}-card`} data-info-side={side}><span>{side === "BLUE" ? "XANH" : "ĐỎ"} / ĐỒNG HỒ</span><strong className={match.clocksMs[side] <= 10000 ? "low-time" : ""}>{formatClock(match.clocksMs[side])}</strong><small>{playerLabel(match, side)} · {match.players.find((player) => player.side === side)?.ready ? "Đã sẵn sàng" : "Chưa sẵn sàng"}</small></div>;
}

function FixtureRoom({ roomId, state, viewSide, setViewSide }: { roomId: string; state: RuleState; viewSide: Side; setViewSide: (side: Side) => void }) {
  return <section className="game-room-page"><div className="game-room-header"><div><p className="eyebrow">BÀN CỜ LUYỆN TẬP</p><h1>Phòng đấu {roomId}</h1><p className="game-room-subtitle">Chế độ luyện tập cục bộ.</p></div><div className="view-switcher" aria-label="Đổi góc nhìn bàn cờ"><span>Góc nhìn</span><Button variant={viewSide === "BLUE" ? "primary" : "secondary"} onClick={() => setViewSide("BLUE")}>XANH</Button><Button variant={viewSide === "RED" ? "danger" : "secondary"} onClick={() => setViewSide("RED")}>ĐỎ</Button></div></div><div className="game-room-layout"><GameBoard state={state} viewSide={viewSide} /><aside className="game-room-info" aria-label="Thông tin bàn cờ"><div className="info-card blue-card"><span>XANH</span><strong>9 quân</strong><small>Luôn đi trước trong chế độ luyện tập</small></div><div className="info-card red-card"><span>ĐỎ</span><strong>9 quân</strong><small>Góc nhìn có thể xoay 180°</small></div><div className="info-card"><span>LUYỆN TẬP</span><strong>Cục bộ</strong><small>Nước đi hợp lệ được hiển thị tại chỗ.</small></div></aside></div></section>;
}
