import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { HistoryDetailResponse, HistoryListResponse, HistoryMatchCard } from "@ottv2/contracts";

import { routes } from "../app/routes";
import { Button, LoadingState, Modal } from "../components/ui";
import { ApiError } from "../services/http/apiError";
import { getHistory, getHistoryDetail, type HistoryFilters } from "../services/history/historyApi";
import { clearGuestHistory, getImportDecision, getLocalHistory, setImportDecision, type LocalHistoryRecord } from "../services/local/localGameStorage";
import { importGuestHistory } from "../services/guest/guestApi";

const modeFilters: Array<{ value: HistoryFilters["mode"]; label: string }> = [
  { value: "ALL", label: "Tất cả" }, { value: "RANKED", label: "Ranked" }, { value: "UNRANKED", label: "Unranked" }, { value: "GUEST", label: "Guest" }, { value: "AI", label: "Vs Máy" }, { value: "OFFLINE", label: "Offline" },
];
const resultFilters: Array<{ value: HistoryFilters["result"]; label: string }> = [{ value: "ALL", label: "Kết quả" }, { value: "WIN", label: "Thắng" }, { value: "LOSS", label: "Thua" }];
const rangeFilters: Array<{ value: HistoryFilters["range"]; label: string }> = [{ value: "ALL", label: "Tất cả thời gian" }, { value: "7D", label: "7 ngày" }, { value: "30D", label: "30 ngày" }];

type PageState = { kind: "loading" } | { kind: "ready"; data: HistoryListResponse } | { kind: "error"; message: string };

export default function HistoryPage() {
  const navigate = useNavigate();
  const { matchId } = useParams<{ matchId?: string }>();
  const [filters, setFilters] = useState<HistoryFilters>({ mode: "ALL", result: "ALL", range: "ALL" });
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [detail, setDetail] = useState<HistoryDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [localGuestRecords, setLocalGuestRecords] = useState<LocalHistoryRecord[]>([]);
  const [importingGuest, setImportingGuest] = useState(false);
  const [importError, setImportError] = useState("");

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    const controller = new AbortController();
    getHistory(filters, controller.signal).then((data) => { if (active) setState({ kind: "ready", data }); }).catch((reason) => {
      if (!active) return;
      if (reason instanceof ApiError && reason.status === 401) navigate(routes.login);
      else setState({ kind: "error", message: reason instanceof ApiError ? reason.message : "Không thể tải lịch sử đấu." });
    });
    return () => { active = false; controller.abort(); };
  }, [filters, navigate]);

  useEffect(() => {
    if (!matchId) { setDetail(null); return; }
    let active = true;
    setDetailLoading(true);
    getHistoryDetail(matchId).then((result) => { if (active) setDetail(result); }).catch((reason) => { if (active) setDetail(null); if (reason instanceof ApiError && reason.status === 401) navigate(routes.login, { replace: true }); else if (reason instanceof ApiError && reason.status === 404) navigate(routes.history, { replace: true }); }).finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [matchId, navigate]);

  useEffect(() => {
    let active = true;
    void Promise.all([getLocalHistory(), getImportDecision()]).then(([records, decision]) => {
      if (!active || decision) return;
      setLocalGuestRecords(records.filter((record) => record.mode === "GUEST"));
    });
    return () => { active = false; };
  }, []);

  async function syncGuestHistory(): Promise<void> {
    setImportingGuest(true);
    setImportError("");
    try {
      const records = localGuestRecords.map(({ localId, result, playerName, opponentName, timerSeconds, durationSeconds, endedAt, scoreDelta }) => ({ localId, mode: "GUEST" as const, result, playerName, opponentName, timerSeconds, durationSeconds, endedAt, scoreDelta }));
      await importGuestHistory(records);
      await setImportDecision("IMPORTED");
      await clearGuestHistory();
      setLocalGuestRecords([]);
    } catch (reason) {
      setImportError(reason instanceof ApiError ? reason.message : "Không thể đồng bộ lịch sử Guest.");
    } finally { setImportingGuest(false); }
  }

  async function deferGuestHistory(): Promise<void> {
    await setImportDecision("DECLINED");
    setLocalGuestRecords([]);
  }

  const updateFilter = <K extends keyof HistoryFilters>(key: K, value: HistoryFilters[K]) => setFilters((current) => ({ ...current, [key]: value, cursor: undefined }));
  const retry = () => setFilters((current) => ({ ...current }));
  const openDetail = (match: HistoryMatchCard) => navigate(`/history/${encodeURIComponent(match.matchId)}`);
  const loadMore = () => {
    if (state.kind !== "ready" || !state.data.nextCursor) return;
    const controller = new AbortController();
    getHistory({ ...filters, cursor: state.data.nextCursor }, controller.signal).then((data) => setState((current) => current.kind === "ready" ? { kind: "ready", data: { ...data, matches: [...current.data.matches, ...data.matches] } } : current)).catch(() => undefined);
  };

  return <section className="history-page">
    <header className="history-header"><div><p className="eyebrow">MATCH_DATA / HISTORY-001</p><h1>Lịch sử đấu</h1><p className="form-intro">Theo dõi rating, kết quả và những ván đấu đã hoàn tất.</p></div><Link className="button primary" to={routes.queue}>Chơi Ranked</Link></header>
    {state.kind === "ready" && <div className="history-summary" aria-label="Tóm tắt lịch sử"><div><span>ELO HIỆN TẠI</span><strong>{state.data.summary.elo}</strong></div><div><span>THẮNG – THUA</span><strong>{state.data.summary.wins}–{state.data.summary.losses}</strong></div><div><span>WIN RATE</span><strong>{state.data.summary.winRate}%</strong></div></div>}
    <div className="history-filters" aria-label="Bộ lọc lịch sử"><div className="filter-group"><span>CHẾ ĐỘ</span>{modeFilters.map((item) => <button className={`filter-chip ${filters.mode === item.value ? "active" : ""}`} type="button" key={item.value} onClick={() => updateFilter("mode", item.value)}>{item.label}</button>)}</div><div className="filter-group"><span>KẾT QUẢ</span>{resultFilters.map((item) => <button className={`filter-chip ${filters.result === item.value ? "active" : ""}`} type="button" key={item.value} onClick={() => updateFilter("result", item.value)}>{item.label}</button>)}</div><div className="filter-group"><span>THỜI GIAN</span>{rangeFilters.map((item) => <button className={`filter-chip ${filters.range === item.value ? "active" : ""}`} type="button" key={item.value} onClick={() => updateFilter("range", item.value)}>{item.label}</button>)}</div></div>
    {state.kind === "loading" && <LoadingState label="Đang tải lịch sử đấu…" />}
    {state.kind === "error" && <div className="history-state"><p className="eyebrow">HISTORY / ERROR</p><h2>Không thể tải lịch sử đấu.</h2><p>{state.message}</p><Button onClick={retry}>Thử lại</Button></div>}
    {state.kind === "ready" && state.data.matches.length === 0 && <div className="history-state"><p className="eyebrow">HISTORY / EMPTY</p><h2>Chưa có trận đấu nào.</h2><p>Hãy bắt đầu trận đầu tiên của bạn.</p><Link className="button primary" to={routes.queue}>Chơi 1vs1 Online</Link></div>}
    {state.kind === "ready" && state.data.matches.length > 0 && <div className="history-list">{state.data.matches.map((match) => <HistoryCard key={match.matchId} match={match} onOpen={() => openDetail(match)} />)}{state.data.hasMore && <Button variant="secondary" onClick={loadMore}>Tải thêm 20 trận</Button>}</div>}
    <Modal open={Boolean(matchId)} title={detailLoading ? "Đang tải Match Detail…" : detail ? "Match Detail" : "Không thể tải Match Detail"} description={detail ? `${detail.match.mode} · ${detail.match.matchId}` : undefined} onClose={() => navigate(routes.history)}>
      {detailLoading && <LoadingState label="Đang tải chi tiết…" />}{detail && <DetailPanel match={detail.match} />}{!detailLoading && !detail && <div className="history-state compact"><p>Trận đấu không tồn tại hoặc bạn không có quyền xem.</p><Button onClick={() => navigate(routes.history)}>Đóng</Button></div>}
    </Modal>
    <Modal open={localGuestRecords.length > 0} title="ĐỒNG BỘ LỊCH SỬ?" description="Lịch sử Guest đang nằm trên thiết bị này. Bạn có muốn đưa vào tài khoản hiện tại không?" onClose={() => void deferGuestHistory()}><div className="import-prompt"><p><strong>{localGuestRecords.length} ván Guest</strong> sẽ được kiểm tra trùng lặp trước khi lưu.</p>{importError && <p className="form-error" role="alert">{importError}</p>}<div className="modal-actions"><Button variant="secondary" onClick={() => void deferGuestHistory()} disabled={importingGuest}>Để sau</Button><Button onClick={() => void syncGuestHistory()} pending={importingGuest} pendingLabel="Đang đồng bộ…">Đồng bộ</Button></div></div></Modal>
  </section>;
}

function HistoryCard({ match, onOpen }: { match: HistoryMatchCard; onOpen: () => void }) {
  const resultLabel = match.result === "WIN" ? "WIN" : match.result === "LOSS" ? "LOSS" : "NEUTRAL";
  return <button className={`history-card ${match.result.toLowerCase()}`} type="button" onClick={onOpen}><div className="history-card-result"><strong>{resultLabel}</strong><span>{match.mode}</span></div><div className="history-card-versus"><div><small>BẠN · {match.viewer.side}</small><strong>{match.viewer.displayName}</strong><span>{match.viewer.ratingAfter ?? match.viewer.ratingBefore ?? "—"}</span></div><b>VS</b><div><small>ĐỐI THỦ · {match.opponent?.side ?? "—"}</small><strong>{match.opponent?.displayName ?? "Không có đối thủ"}</strong><span>{match.opponent?.ratingAfter ?? match.opponent?.ratingBefore ?? "—"}</span></div></div><div className="history-card-meta"><span>{match.result === "ABORTED" ? "Server interruption" : match.resultReason?.replaceAll("_", " ") ?? "Match End"}</span><span>{match.timerSeconds}s/người · {formatDate(match.endedAt)}</span>{match.ratingDelta !== null && <b>{match.ratingDelta > 0 ? "+" : ""}{match.ratingDelta} Elo</b>}</div></button>;
}

function DetailPanel({ match }: { match: HistoryDetailResponse["match"] }) {
  return <div className="history-detail"><div className="detail-result"><span>{match.result === "ABORTED" ? "NEUTRAL" : match.result}</span><strong>{match.result === "ABORTED" ? "Trận bị gián đoạn" : match.result === "WIN" ? "Bạn thắng" : "Bạn thua"}</strong></div><dl><div><dt>Match ID</dt><dd>{match.matchId}</dd></div><div><dt>Room</dt><dd>{match.roomId}</dd></div><div><dt>Kết quả</dt><dd>{match.resultReason?.replaceAll("_", " ") ?? "—"}</dd></div><div><dt>Thời lượng</dt><dd>{formatDuration(match.durationSeconds)}</dd></div><div><dt>Bắt đầu</dt><dd>{match.startedAt ? formatDate(match.startedAt) : "—"}</dd></div><div><dt>Kết thúc</dt><dd>{formatDate(match.endedAt)}</dd></div><div><dt>Timer</dt><dd>{match.timerSeconds}s/người</dd></div><div><dt>Elo thay đổi</dt><dd>{match.ratingDelta === null ? "—" : `${match.ratingDelta > 0 ? "+" : ""}${match.ratingDelta}`}</dd></div></dl><div className="detail-players">{match.players.map((player) => <div key={player.userId}><span>{player.side}</span><strong>{player.displayName}</strong><small>@{player.username} · {player.ratingBefore ?? "—"} → {player.ratingAfter ?? "—"}</small></div>)}</div></div>;
}

function formatDate(value: string): string { return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function formatDuration(seconds: number): string { return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`; }
