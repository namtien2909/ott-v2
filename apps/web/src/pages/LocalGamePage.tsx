import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { applyMove, createInitialState, getLegalDestinations, type Coordinate, type RuleState, type Side } from "@ottv2/game-rules";
import { Button } from "../components/ui";
import { GameBoard } from "../components/board";
import { routes } from "../app/routes";
import { addLocalHistory, getGuestProfile, setGuestProfile, type LocalMode } from "../services/local/localGameStorage";

type LocalGamePageProps = { mode: LocalMode };
type SetupValues = { blueName: string; redName: string; timerSeconds: number };

const modeCopy: Record<LocalMode, { eyebrow: string; title: string; description: string; opponent: string }> = {
  GUEST: { eyebrow: "GUEST / UNRANKED LOCAL", title: "Guest practice", description: "Một bàn cờ local để làm quen luật. Không cần mạng và không có reconnect.", opponent: "Đối thủ Guest" },
  AI: { eyebrow: "AI / NORMAL", title: "Đấu với máy", description: "Bot Normal dùng cùng game rules và phản hồi deterministic để ván đấu dễ kiểm tra.", opponent: "Bot Normal" },
  OFFLINE: { eyebrow: "OFFLINE / TWO PLAYER", title: "Hai người một máy", description: "Chuyển thiết bị cho nhau sau mỗi lượt. Dữ liệu chỉ nằm trên máy này.", opponent: "Người chơi Đỏ" },
};

export default function LocalGamePage({ mode }: LocalGamePageProps) {
  const copy = modeCopy[mode];
  const [started, setStarted] = useState(false);
  const [state, setState] = useState<RuleState>(() => createInitialState());
  const [setup, setSetup] = useState<SetupValues>({ blueName: mode === "GUEST" ? "Guest" : "Người chơi Xanh", redName: copy.opponent, timerSeconds: 60 });
  const [guestReady, setGuestReady] = useState(mode !== "GUEST");
  const [remaining, setRemaining] = useState(60);
  const [handoff, setHandoff] = useState<Side | null>(null);
  const startedAt = useRef<number>(0);
  const recorded = useRef(false);

  useEffect(() => { if (mode !== "GUEST") return; void getGuestProfile().then((profile) => { if (!profile) return; setGuestReady(true); setSetup((current) => ({ ...current, blueName: profile.displayName })); }); }, [mode]);
  useEffect(() => {
    if (!started || state.status !== "PLAYING") return;
    const timer = window.setInterval(() => setRemaining(Math.max(0, setup.timerSeconds - Math.floor((Date.now() - startedAt.current) / 1000))), 500);
    return () => window.clearInterval(timer);
  }, [started, state.status, setup.timerSeconds]);
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
      if (move) setState((current) => applyMove(current, { side: "RED", ...move }).state);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [mode, started, state]);
  useEffect(() => {
    if (!started || state.status !== "FINISHED" || recorded.current) return;
    recorded.current = true;
    const result = state.winner === "BLUE" ? "WIN" : "LOSS";
    void addLocalHistory({ localId: crypto.randomUUID(), mode, result, playerName: setup.blueName, opponentName: setup.redName, timerSeconds: setup.timerSeconds, durationSeconds: Math.max(0, Math.floor((Date.now() - startedAt.current) / 1000)), endedAt: new Date().toISOString(), scoreDelta: result === "WIN" ? 10 : -10 });
  }, [mode, setup, started, state]);

  async function start(): Promise<void> {
    if (mode === "GUEST") await setGuestProfile({ displayName: setup.blueName.trim() });
    startedAt.current = Date.now();
    recorded.current = false;
    setRemaining(setup.timerSeconds);
    setState(createInitialState());
    setStarted(true);
  }

  function move(from: Coordinate, to: Coordinate): void {
    if (!started || state.status !== "PLAYING" || (mode === "AI" && state.currentTurn !== "BLUE")) return;
    const result = applyMove(state, { side: state.currentTurn as Side, from, to });
    if (result.kind !== "accepted") return;
    setState(result.state);
    if (mode === "OFFLINE") {
      setHandoff(result.state.currentTurn);
      window.setTimeout(() => setHandoff(null), 500);
    }
  }

  if (!started) return <section className="local-page setup-page"><div className="local-setup-card"><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p className="form-intro">{copy.description}</p>{mode === "GUEST" && <div className="guest-warning" role="status"><strong>Guest warning</strong><span>Lịch sử chỉ lưu local; không có reconnect.</span></div>}<div className="form-stack"><label>Người chơi Xanh<input value={setup.blueName} onChange={(event) => setSetup((current) => ({ ...current, blueName: event.target.value }))} minLength={2} maxLength={20} disabled={mode === "GUEST" && !guestReady} /></label>{mode !== "AI" && <label>Người chơi Đỏ<input value={setup.redName} onChange={(event) => setSetup((current) => ({ ...current, redName: event.target.value }))} minLength={2} maxLength={20} /></label>}{mode === "AI" && <div className="local-bot-card"><span>BOT HUD</span><strong>🔴 {copy.opponent}</strong><small>Độ khó Normal · không kết nối server</small></div>}<label>Thời gian mỗi bên<select value={setup.timerSeconds} onChange={(event) => setSetup((current) => ({ ...current, timerSeconds: Number(event.target.value) }))}>{[30, 60, 300].map((value) => <option value={value} key={value}>{value}s</option>)}</select></label><div className="modal-actions"><Link className="button secondary" to={routes.home}>Quay lại</Link><Button onClick={() => void start()} disabled={mode === "GUEST" && !guestReady}>Bắt đầu ván</Button></div></div></div></section>;

  const activeName = state.currentTurn === "BLUE" ? setup.blueName : setup.redName;
  const viewSide = mode === "AI" ? "BLUE" : state.currentTurn ?? "BLUE";
  return <section className="local-page local-game-page"><header className="local-game-header"><div><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p className="form-intro">Không có reconnect · local state là nguồn sự thật của ván này.</p></div><Link className="button secondary" to={routes.home}>Thoát ván</Link></header>{mode === "GUEST" && <div className="guest-warning" role="status"><strong>Đang chơi với tư cách khách</strong><span>Lịch sử local sẽ được đề nghị đồng bộ sau khi bạn đăng nhập.</span></div>}<div className="local-hud"><div className="local-player blue"><span>BLUE</span><strong>{setup.blueName}</strong><small>{state.currentTurn === "BLUE" ? "Đang đi" : "Chờ lượt"}</small></div><div className="local-turn"><small>ĐỒNG HỒ LOCAL</small><strong className={remaining <= 10 ? "low-time" : ""}>{remaining}s</strong><span>{state.status === "FINISHED" ? "Kết thúc" : activeName}</span></div><div className="local-player red"><span>RED</span><strong>{setup.redName}</strong><small>{state.currentTurn === "RED" ? "Đang đi" : "Chờ lượt"}</small></div></div>{handoff && <div className="turn-handoff" role="status" aria-live="assertive">Chuyển thiết bị cho <strong>{handoff === "BLUE" ? setup.blueName : setup.redName}</strong></div>}<div className="local-board-wrap"><GameBoard state={state} viewSide={viewSide} onMove={move} disabled={Boolean(handoff) || (mode === "AI" && state.currentTurn === "RED")} /></div>{state.status === "FINISHED" && <div className="result-card local-result"><span>LOCAL MATCH END</span><strong>{state.winner === "BLUE" ? `${setup.blueName} thắng` : `${setup.redName} thắng`}</strong><small>Kết quả đã lưu trên thiết bị này.</small><Link className="button primary" to={mode === "GUEST" ? "/guest" : routes.home}>Chơi ván mới</Link></div>}</section>;
}
