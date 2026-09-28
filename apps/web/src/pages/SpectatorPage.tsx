import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { MatchEventEnvelope, MatchSnapshot } from "@ottv2/contracts";
import { type RuleState, type Side } from "@ottv2/game-rules";
import { routes } from "../app/routes";
import { GameBoard } from "../components/board";
import { Button, LoadingState } from "../components/ui";
import { ApiError } from "../services/http/apiError";
import { getSpectatorMatch, requestSpectator, subscribeToSpectator, leaveSpectator } from "../services/rooms/spectatorApi";

type SpectatorState = { kind: "loading" } | { kind: "password"; message: string } | { kind: "ready"; roomName: string; spectatorCount: number; match: MatchSnapshot; lastEvent: string } | { kind: "error"; message: string };

function toRuleState(match: MatchSnapshot): RuleState {
  return { board: match.board as RuleState["board"], pieceCounts: match.pieceCounts, currentTurn: match.currentTurn, status: match.status === "FINISHED" || match.status === "ABORTED" ? "FINISHED" : "PLAYING", winner: match.winner, resultReason: match.resultReason === "EXTINCTION" || match.resultReason === "GOAL_REACHED" ? match.resultReason : null };
}

function formatClock(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(totalSeconds / 60).toString().padStart(2, "0")}:${(totalSeconds % 60).toString().padStart(2, "0")}`;
}

function playerName(match: MatchSnapshot, side: Side): string { return match.players.find((player) => player.side === side)?.displayName ?? (side === "BLUE" ? "Blue" : "Red"); }

export default function SpectatorPage() {
  const { roomId = "" } = useParams<{ roomId: string }>();
  const [state, setState] = useState<SpectatorState>({ kind: "loading" });
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const connect = useCallback(async (nextPassword?: string): Promise<void> => {
    setPending(true);
    setState({ kind: "loading" });
    try {
      await requestSpectator(roomId, nextPassword);
      const result = await getSpectatorMatch(roomId);
      setState({ kind: "ready", roomName: result.room.name, spectatorCount: result.spectatorCount, match: result.match, lastEvent: "MATCH_SNAPSHOT" });
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) setState({ kind: "password", message: reason.message });
      else setState({ kind: "error", message: reason instanceof ApiError ? reason.message : "Không thể vào spectator." });
    } finally { setPending(false); }
  }, [roomId]);

  useEffect(() => { if (!roomId) { setState({ kind: "error", message: "Thiếu Room ID." }); return; } void connect(); return () => { void leaveSpectator(roomId).catch(() => undefined); }; }, [connect, roomId]);
  useEffect(() => {
    if (state.kind !== "ready") return undefined;
    let active = true;
    const unsubscribe = subscribeToSpectator(roomId, (event: MatchEventEnvelope) => { if (active) setState((current) => current.kind === "ready" ? { ...current, match: event.payload, lastEvent: event.type } : current); }, () => { if (active) setState((current) => current.kind === "ready" ? { ...current, lastEvent: "RECONNECTING" } : current); });
    return () => { active = false; unsubscribe(); };
  }, [roomId, state.kind]);

  if (state.kind === "loading") return <LoadingState fullPage label="Đang kết nối spectator…" />;
  if (state.kind === "password") return <section className="spectator-page spectator-state"><div className="spectator-card"><p className="eyebrow">PHÒNG RIÊNG TƯ</p><h1>Cần mật khẩu phòng</h1><p className="form-intro">Phòng này giới hạn người xem. Nhập mật khẩu để tiếp tục.</p><form className="form-stack" onSubmit={(event: FormEvent) => { event.preventDefault(); void connect(password); }}><label>Mật khẩu phòng<input autoFocus value={password} onChange={(event) => setPassword(event.target.value)} maxLength={12} /></label><p className="form-error" role="alert">{state.message}</p><div className="modal-actions"><Link className="button secondary" to={routes.home}>Quay lại</Link><Button type="submit" pending={pending}>Xem trận</Button></div></form></div></section>;
  if (state.kind === "error") return <section className="placeholder"><p className="eyebrow">KHÔNG THỂ XEM TRẬN</p><h1>Không thể xem trận</h1><p className="form-intro">{state.message}</p><Link className="button primary" to={routes.home}>Về trang chủ</Link></section>;

  const match = state.match;
  const board = toRuleState(match);
  const resultText = match.status === "ABORTED" ? "Trận bị gián đoạn" : match.winner ? `${playerName(match, match.winner)} thắng` : match.status === "FINISHED" ? "Trận kết thúc" : `Lượt ${match.currentTurn ?? "—"}`;
  return <section className="game-room-page spectator-page"><div className="game-room-header"><div><p className="eyebrow">👁 ĐANG XEM / SPECTATOR</p><h1>{state.roomName}</h1><p className="game-room-subtitle">Chế độ xem · bàn cờ chuẩn</p></div><div className="game-header-actions"><span className="spectator-count">👁 {state.spectatorCount} người xem</span><Link className="button secondary" to={routes.home}>Rời phòng</Link></div></div><div className="spectator-banner" role="status"><strong>Chế độ xem</strong><span>Bàn cờ luôn đặt XANH ở phía dưới. Không thể chọn quân hoặc gửi lệnh trong trận.</span></div><div className="match-hud" aria-label="HUD người xem"><SpectatorHud match={match} side="BLUE" /><div className="match-center-status"><strong>{resultText}</strong><small>{match.status} · v{match.stateVersion}</small></div><SpectatorHud match={match} side="RED" /></div><div className="game-room-layout spectator-layout"><div><GameBoard state={board} viewSide="BLUE" disabled /><p className="spectator-readonly" role="note">👁 Chỉ xem · nước đi và ô hợp lệ đã bị khoá.</p></div><aside className="game-room-info" aria-label="Thông tin spectator"><div className="info-card blue-card"><span>XANH / ĐỒNG HỒ</span><strong>{formatClock(match.clocksMs.BLUE)}</strong><small>{playerName(match, "BLUE")}</small></div><div className="info-card red-card"><span>ĐỎ / ĐỒNG HỒ</span><strong>{formatClock(match.clocksMs.RED)}</strong><small>{playerName(match, "RED")}</small></div><div className="result-card"><span>NGƯỜI XEM</span><strong>{state.spectatorCount}</strong><small>Cập nhật trực tiếp theo trạng thái trận đấu.</small></div></aside></div></section>;
}

function SpectatorHud({ match, side }: { match: MatchSnapshot; side: Side }) { return <div className={`player-hud ${side.toLowerCase()}`}><span className="player-side">{side}</span><strong>{playerName(match, side)}</strong><span>{formatClock(match.clocksMs[side])}</span><small>CHỈ XEM</small></div>; }
