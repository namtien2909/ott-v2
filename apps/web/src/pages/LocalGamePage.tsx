import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { applyMove, createInitialState, getLegalDestinations, type Coordinate, type RuleState, type Side } from "@ottv2/game-rules";
import { Button, LoadingState } from "../components/ui";
import { GameBoard } from "../components/board";
import { routes } from "../app/routes";
import { addLocalHistory, clearLocalSession, getGuestProfile, getLocalSession, setGuestProfile, setLocalSession, type LocalMode, type LocalSessionSnapshot, type LocalSessionStats } from "../services/local/localGameStorage";
import { ResultPanel } from "../components/result";

type LocalGamePageProps = { mode: LocalMode };
type SetupValues = { blueName: string; redName: string; timerSeconds: number };

const modeCopy: Record<LocalMode, { eyebrow: string; title: string; description: string; opponent: string }> = {
  GUEST: { eyebrow: "KHÁCH / NGOẠI TUYẾN", title: "Luyện tập với tư cách khách", description: "Một bàn cờ ngoại tuyến để làm quen luật. Không cần mạng và không có kết nối lại.", opponent: "Đối thủ khách" },
  AI: { eyebrow: "ĐẤU MÁY / BÌNH THƯỜNG", title: "Đấu với máy", description: "Bot thường dùng cùng luật chơi và phản hồi ổn định để bạn luyện tập.", opponent: "Bot thường" },
  OFFLINE: { eyebrow: "NGOẠI TUYẾN / HAI NGƯỜI", title: "Hai người một máy", description: "Chuyển thiết bị cho nhau sau mỗi lượt. Dữ liệu chỉ nằm trên máy này.", opponent: "Người chơi Đỏ" },
};

export default function LocalGamePage({ mode }: LocalGamePageProps) {
  const navigate = useNavigate();
  const copy = modeCopy[mode];
  const [started, setStarted] = useState(false);
  const [state, setState] = useState<RuleState>(() => createInitialState());
  const [setup, setSetup] = useState<SetupValues>({ blueName: mode === "GUEST" ? "Khách" : "Người chơi Xanh", redName: copy.opponent, timerSeconds: 60 });
  const [guestReady, setGuestReady] = useState(mode !== "GUEST");
  const [remaining, setRemaining] = useState(60);
  const [clocks, setClocks] = useState<Record<Side, number>>({ BLUE: 60, RED: 60 });
  const [handoff, setHandoff] = useState<Side | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [restoredSession, setRestoredSession] = useState(false);
  const [moveStats, setMoveStats] = useState<LocalSessionStats>({ moves: 0, captures: 0, piecesLost: 0 });
  const startedAt = useRef<number>(0);
  const turnStartedAt = useRef<number>(0);
  const recorded = useRef(false);
  const sessionRef = useRef<LocalSessionSnapshot | null>(null);

  useEffect(() => {
    let active = true;
    setSessionLoading(true);
    setSessionError("");
    getLocalSession(mode).then((session) => {
      if (!active || !session || session.mode !== mode || session.state.status !== "PLAYING") return;
      setSetup(session.setup);
      setState(session.state);
      setClocks(session.clocks);
      setRemaining(session.remaining);
      setMoveStats(session.stats ?? { moves: 0, captures: 0, piecesLost: 0 });
      startedAt.current = Date.now();
      turnStartedAt.current = Date.now();
      recorded.current = false;
      setRestoredSession(true);
      setStarted(true);
    }).catch(() => { if (active) setSessionError("Không thể đọc phiên local đã lưu. Bạn có thể thử lại hoặc bắt đầu ván mới."); }).finally(() => { if (active) setSessionLoading(false); });
    return () => { active = false; };
  }, [mode]);

  useEffect(() => { if (mode !== "GUEST") return; void getGuestProfile().then((profile) => { if (!profile) return; setGuestReady(true); setSetup((current) => ({ ...current, blueName: profile.displayName })); }); }, [mode]);
  useEffect(() => {
    if (!started || state.status !== "PLAYING") return;
    const updateClock = () => {
      const side = state.currentTurn;
      if (!side) return;
      const nextRemaining = Math.max(0, clocks[side] - Math.floor((Date.now() - turnStartedAt.current) / 1000));
      setRemaining(nextRemaining);
      if (nextRemaining === 0) {
        setTimedOut(true);
        setState((current) => current.status === "PLAYING" ? { ...current, status: "FINISHED", currentTurn: null, winner: side === "BLUE" ? "RED" : "BLUE", resultReason: null } : current);
      }
    };
    updateClock();
    const timer = window.setInterval(updateClock, 500);
    return () => window.clearInterval(timer);
  }, [clocks, started, state.currentTurn, state.status]);
  useEffect(() => {
    if (!started || state.status !== "PLAYING") return undefined;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [started, state.status]);
  useEffect(() => {
    if (!started || mode !== "AI" || state.status !== "PLAYING" || state.currentTurn !== "RED") return;
    const timer = window.setTimeout(() => {
      const moves: Array<{ from: Coordinate; to: Coordinate }> = [];
      for (const [from, piece] of Object.entries(state.board) as Array<[Coordinate, RuleState["board"][Coordinate]]>) {
        if (piece?.side !== "RED") continue;
        const to = getLegalDestinations(state, "RED", from)[0];
        if (to) { moves.push({ from, to }); break; }
      }
      const move = moves[0];
      if (move) {
        const elapsed = Math.floor((Date.now() - turnStartedAt.current) / 1000);
        const nextClock = Math.max(0, clocks.RED - elapsed);
        if (nextClock === 0) {
          setTimedOut(true);
          setState((current) => ({ ...current, status: "FINISHED", currentTurn: null, winner: "BLUE", resultReason: null }));
          return;
        }
        setClocks((current) => ({ ...current, RED: nextClock }));
        turnStartedAt.current = Date.now();
        const defender = state.board[move.to];
        const result = applyMove(state, { side: "RED", ...move });
        if (result.kind === "accepted") {
          setMoveStats((current) => ({ moves: current.moves + 1, captures: current.captures, piecesLost: current.piecesLost + (defender && defender.side === "BLUE" ? 1 : 0) }));
          setState(result.state);
        }
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [clocks, mode, started, state]);
  useEffect(() => {
    if (!started || state.status !== "FINISHED" || recorded.current) return;
    recorded.current = true;
    const result = state.winner === "BLUE" ? "WIN" : "LOSS";
    void clearLocalSession(mode);
    void addLocalHistory({ localId: crypto.randomUUID(), mode, result, playerName: setup.blueName, opponentName: setup.redName, timerSeconds: setup.timerSeconds, durationSeconds: Math.max(0, Math.floor((Date.now() - startedAt.current) / 1000)), endedAt: new Date().toISOString(), scoreDelta: result === "WIN" ? 10 : -10 });
  }, [mode, setup, started, state]);

  useEffect(() => {
    sessionRef.current = { mode, setup, state, clocks, remaining, stats: moveStats, savedAt: new Date().toISOString() };
  }, [clocks, mode, moveStats, remaining, setup, state]);

  useEffect(() => {
    if (!started || state.status !== "PLAYING") return undefined;
    const persist = () => { if (sessionRef.current) void setLocalSession(sessionRef.current); };
    persist();
    const timer = window.setInterval(persist, 2000);
    return () => window.clearInterval(timer);
  }, [mode, started, state.status]);

  async function start(): Promise<void> {
    if (mode === "GUEST") await setGuestProfile({ displayName: setup.blueName.trim() });
    startedAt.current = Date.now();
    turnStartedAt.current = Date.now();
    recorded.current = false;
    setRestoredSession(false);
    setTimedOut(false);
    setMoveStats({ moves: 0, captures: 0, piecesLost: 0 });
    setClocks({ BLUE: setup.timerSeconds, RED: setup.timerSeconds });
    setRemaining(setup.timerSeconds);
    setState(createInitialState());
    setStarted(true);
  }

  function move(from: Coordinate, to: Coordinate): void {
    if (!started || state.status !== "PLAYING" || (mode === "AI" && state.currentTurn !== "BLUE")) return;
    const side = state.currentTurn as Side;
    const elapsed = Math.floor((Date.now() - turnStartedAt.current) / 1000);
    const nextClock = Math.max(0, clocks[side] - elapsed);
    if (nextClock === 0) {
      setTimedOut(true);
      setState((current) => ({ ...current, status: "FINISHED", currentTurn: null, winner: side === "BLUE" ? "RED" : "BLUE", resultReason: null }));
      return;
    }
    const defender = state.board[to];
    const result = applyMove(state, { side, from, to });
    if (result.kind !== "accepted") return;
    setMoveStats((current) => ({ moves: current.moves + 1, captures: current.captures + (side === "BLUE" && defender?.side === "RED" ? 1 : 0), piecesLost: current.piecesLost + (side === "RED" && defender?.side === "BLUE" ? 1 : 0) }));
    setClocks((current) => ({ ...current, [side]: nextClock }));
    turnStartedAt.current = Date.now();
    setRemaining(result.state.currentTurn ? clocks[result.state.currentTurn] : nextClock);
    setState(result.state);
    if (mode === "OFFLINE") {
      setHandoff(result.state.currentTurn);
      window.setTimeout(() => setHandoff(null), 500);
    }
  }

  if (sessionLoading) return <section className="local-page setup-page"><LoadingState fullPage label="Đang kiểm tra phiên local…" /></section>;
  if (!started) return <section className="local-page setup-page"><div className="local-setup-card"><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p className="form-intro">{copy.description}</p>{sessionError && <div className="form-error local-session-error" role="alert"><strong>{sessionError}</strong><Button variant="secondary" onClick={() => window.location.reload()}>Thử lại</Button></div>}{mode === "GUEST" && <div className="guest-warning" role="status"><strong>Bạn đang chơi với tư cách khách</strong><span>Lịch sử chỉ lưu trên thiết bị này; không có kết nối lại.</span></div>}<div className="form-stack"><label>Người chơi Xanh<input value={setup.blueName} onChange={(event) => setSetup((current) => ({ ...current, blueName: event.target.value }))} minLength={2} maxLength={20} disabled={mode === "GUEST" && !guestReady} /></label>{mode !== "AI" && <label>Người chơi Đỏ<input value={setup.redName} onChange={(event) => setSetup((current) => ({ ...current, redName: event.target.value }))} minLength={2} maxLength={20} /></label>}{mode === "AI" && <div className="local-bot-card"><span>HỒ SƠ BOT</span><strong><span className="bot-mark" aria-hidden="true">AI</span> {copy.opponent}</strong><small>Độ khó bình thường · không kết nối máy chủ</small></div>}<label>Thời gian mỗi bên<select value={setup.timerSeconds} onChange={(event) => setSetup((current) => ({ ...current, timerSeconds: Number(event.target.value) }))}>{[30, 60, 300].map((value) => <option value={value} key={value}>{value}s</option>)}</select></label><div className="modal-actions"><Link className="button secondary" to={routes.home}>Quay lại</Link><Button onClick={() => void start()} disabled={mode === "GUEST" && !guestReady}>Bắt đầu ván</Button></div></div></div></section>;

  const activeName = state.currentTurn === "BLUE" ? setup.blueName : setup.redName;
  const viewSide: Side = "BLUE";
  const interactionSide: Side | null = mode === "AI" && state.currentTurn === "RED" ? null : state.currentTurn;
  const leaveGame = () => { if (state.status === "PLAYING" && !window.confirm("Bạn có thay đổi chưa lưu. Rời ván sẽ kết thúc phiên local hiện tại?")) return; void clearLocalSession(mode); navigate(routes.home); };
  const resetLocalGame = () => { setRestoredSession(false); setStarted(false); setState(createInitialState()); setMoveStats({ moves: 0, captures: 0, piecesLost: 0 }); };
  return <section className="local-page local-game-page"><header className="local-game-header"><div><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p className="form-intro">Không có kết nối lại · trạng thái local là nguồn sự thật của ván này.</p></div><Button variant="secondary" onClick={leaveGame}>Thoát ván</Button></header>{restoredSession && <div className="local-session-resumed" role="status">Đã khôi phục ván local trên thiết bị này.</div>}{mode === "GUEST" && <div className="guest-warning" role="status"><strong>Đang chơi với tư cách khách</strong><span>Lịch sử local sẽ được đề nghị đồng bộ sau khi bạn đăng nhập.</span></div>}<div className="local-hud"><div className="local-player blue"><span>XANH</span><strong>{setup.blueName}</strong><small>{state.currentTurn === "BLUE" ? "Đang đi" : "Chờ lượt"}</small></div><div className="local-turn"><small>ĐỒNG HỒ LOCAL</small><strong className={remaining <= 10 ? "low-time" : ""}>{remaining}s</strong><span>{state.status === "FINISHED" ? "Kết thúc" : activeName}</span></div><div className="local-player red"><span>ĐỎ</span><strong>{setup.redName}</strong><small>{state.currentTurn === "RED" ? "Đang đi" : "Chờ lượt"}</small></div></div>{handoff && <div className="turn-handoff" role="status" aria-live="assertive">Chuyển thiết bị cho <strong>{handoff === "BLUE" ? setup.blueName : setup.redName}</strong></div>}<div className="local-board-wrap"><GameBoard state={state} viewSide={viewSide} interactionSide={interactionSide} onMove={move} disabled={Boolean(handoff) || interactionSide === null} /></div>{state.status === "FINISHED" && <ResultPanel status="FINISHED" winner={state.winner} viewerSide="BLUE" resultReason={timedOut ? "TIMEOUT" : state.resultReason === "EXTINCTION" || state.resultReason === "GOAL_REACHED" ? state.resultReason : null} mode={mode} stats={{ ...moveStats, durationSeconds: Math.max(0, Math.floor((Date.now() - startedAt.current) / 1000)) }} onBack={() => navigate(routes.home)} onRematch={resetLocalGame} />}</section>;
}
