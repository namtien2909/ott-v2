import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { HistoryDetailResponse, HistoryListResponse, HistoryMatchCard } from "@ottv2/contracts";

import { routes } from "../app/routes";
import { Button, LoadingState, Modal } from "../components/ui";
import { ApiError } from "../services/http/apiError";
import { getHistory, getHistoryDetail, type HistoryFilters } from "../services/history/historyApi";
import { clearGuestHistory, getImportDecision, getLocalHistory, setImportDecision, type LocalHistoryRecord } from "../services/local/localGameStorage";
import { importGuestHistory } from "../services/guest/guestApi";
import { FinalPositionThumbnail } from "../components/history/FinalPositionThumbnail";

const modeFilters: Array<{ value: HistoryFilters["mode"]; label: string }> = [
  { value: "ALL", label: "Tất cả" }, { value: "RANKED", label: "Xếp hạng" }, { value: "UNRANKED", label: "Không xếp hạng" }, { value: "GUEST", label: "Khách" }, { value: "AI", label: "Đấu máy" }, { value: "OFFLINE", label: "Ngoại tuyến" },
];
const resultFilters: Array<{ value: HistoryFilters["result"]; label: string }> = [{ value: "ALL", label: "Kết quả" }, { value: "WIN", label: "Thắng" }, { value: "LOSS", label: "Thua" }];
const rangeFilters: Array<{ value: HistoryFilters["range"]; label: string }> = [{ value: "ALL", label: "Tất cả thời gian" }, { value: "7D", label: "7 ngày" }, { value: "30D", label: "30 ngày" }];

type PageState = { kind: "loading" } | { kind: "ready"; data: HistoryListResponse } | { kind: "error"; message: string };

export default function HistoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { matchId } = useParams<{ matchId?: string }>();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [retryNonce, setRetryNonce] = useState(0);
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
  }, [filters, navigate, retryNonce]);

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

  const updateFilter = <K extends "mode" | "result" | "range">(key: K, value: HistoryFilters[K]) => {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    next.delete("cursor");
    setSearchParams(next, { replace: true });
  };
  const retry = () => setRetryNonce((current) => current + 1);
  const closeDetail = () => navigate({ pathname: routes.history, search: location.search });
  const openDetail = (match: HistoryMatchCard) => navigate({ pathname: `/history/${encodeURIComponent(match.matchId)}`, search: location.search });
  const loadMore = () => {
    if (state.kind !== "ready" || !state.data.nextCursor) return;
    const controller = new AbortController();
    getHistory({ ...filters, cursor: state.data.nextCursor }, controller.signal).then((data) => setState((current) => current.kind === "ready" ? { kind: "ready", data: { ...data, matches: [...current.data.matches, ...data.matches] } } : current)).catch(() => undefined);
  };

  return <section className="history-page">
    <header className="history-header"><div><p className="eyebrow">LỊCH SỬ THI ĐẤU</p><h1>Lịch sử đấu</h1><p className="form-intro">Theo dõi Elo, kết quả và những ván đấu đã hoàn tất.</p></div><Link className="button primary" to={routes.queue}>Chơi xếp hạng</Link></header>
    {state.kind === "ready" && <div className="history-summary" aria-label="Tóm tắt lịch sử"><div><span>ELO HIỆN TẠI</span><strong>{state.data.summary.elo}</strong></div><div><span>THẮNG – THUA</span><strong>{state.data.summary.wins}–{state.data.summary.losses}</strong></div><div><span>WIN RATE</span><strong>{state.data.summary.winRate}%</strong></div></div>}
    <div className="history-filters" aria-label="Bộ lọc lịch sử"><div className="filter-group"><span>CHẾ ĐỘ</span>{modeFilters.map((item) => <button className={`filter-chip ${filters.mode === item.value ? "active" : ""}`} type="button" key={item.value} onClick={() => updateFilter("mode", item.value)}>{item.label}</button>)}</div><div className="filter-group"><span>KẾT QUẢ</span>{resultFilters.map((item) => <button className={`filter-chip ${filters.result === item.value ? "active" : ""}`} type="button" key={item.value} onClick={() => updateFilter("result", item.value)}>{item.label}</button>)}</div><div className="filter-group"><span>THỜI GIAN</span>{rangeFilters.map((item) => <button className={`filter-chip ${filters.range === item.value ? "active" : ""}`} type="button" key={item.value} onClick={() => updateFilter("range", item.value)}>{item.label}</button>)}</div></div>
    {state.kind === "loading" && <HistoryLoadingSkeleton />}
    {state.kind === "error" && <div className="history-state"><p className="eyebrow">KẾT NỐI</p><h2>Không thể tải lịch sử đấu.</h2><p>{state.message}</p><Button onClick={retry}>Thử lại</Button></div>}
    {state.kind === "ready" && state.data.matches.length === 0 && <div className="history-state"><p className="eyebrow">CHƯA CÓ DỮ LIỆU</p><h2>Chưa có trận đấu nào.</h2><p>Hãy bắt đầu trận đầu tiên của bạn.</p><Link className="button primary" to={routes.queue}>Chơi 1vs1 Online</Link></div>}
    {state.kind === "ready" && state.data.matches.length > 0 && <div className="history-list">{state.data.matches.map((match) => <HistoryCard key={match.matchId} match={match} onOpen={() => openDetail(match)} />)}{state.data.hasMore && <Button variant="secondary" onClick={loadMore}>Tải thêm 20 trận</Button>}</div>}
    <Modal open={Boolean(matchId)} title={detailLoading ? "Đang tải chi tiết trận…" : detail ? "Chi tiết trận đấu" : "Không thể tải chi tiết trận"} description={detail ? `${formatMode(detail.match.mode)} · ${detail.match.matchId}` : undefined} onClose={closeDetail}>
      {detailLoading && <LoadingState label="Đang tải chi tiết…" />}{detail && <DetailPanel match={detail.match} />}{!detailLoading && !detail && <div className="history-state compact"><p>Trận đấu không tồn tại hoặc bạn không có quyền xem.</p><Button onClick={() => navigate(routes.history)}>Đóng</Button></div>}
    </Modal>
    <Modal open={localGuestRecords.length > 0} title="ĐỒNG BỘ LỊCH SỬ?" description="Lịch sử Guest đang nằm trên thiết bị này. Bạn có muốn đưa vào tài khoản hiện tại không?" onClose={() => void deferGuestHistory()}><div className="import-prompt"><p><strong>{localGuestRecords.length} ván Guest</strong> sẽ được kiểm tra trùng lặp trước khi lưu.</p>{importError && <p className="form-error" role="alert">{importError}</p>}<div className="modal-actions"><Button variant="secondary" onClick={() => void deferGuestHistory()} disabled={importingGuest}>Để sau</Button><Button onClick={() => void syncGuestHistory()} pending={importingGuest} pendingLabel="Đang đồng bộ…">Đồng bộ</Button></div></div></Modal>
  </section>;
}

function HistoryLoadingSkeleton() {
  return <div className="history-loading" role="status" aria-label="Đang tải lịch sử đấu">
    <div className="history-summary history-summary-skeleton" aria-hidden="true">{[1, 2, 3].map((item) => <div key={item}><span /><strong /></div>)}</div>
    <div className="history-list" aria-hidden="true">{[1, 2, 3].map((item) => <div className="history-card history-card-skeleton" key={item}><span /><div><span /><strong /><small /></div><div><span /><small /></div></div>)}</div>
    <span className="visually-hidden">Đang tải lịch sử đấu…</span>
  </div>;
}

function HistoryCard({ match, onOpen }: { match: HistoryMatchCard; onOpen: () => void }) {
  const resultLabel = match.result === "WIN" ? "THẮNG" : match.result === "LOSS" ? "THUA" : "GIÁN ĐOẠN";
  return <button className={`history-card ${match.result.toLowerCase()}`} type="button" onClick={onOpen}><div className="history-card-result"><strong>{resultLabel}</strong><span>{formatMode(match.mode)}</span></div><div className="history-card-versus"><div><small>BẠN · {formatSide(match.viewer.side)}</small><strong>{match.viewer.displayName}</strong><span>{match.viewer.ratingAfter ?? match.viewer.ratingBefore ?? "—"}</span></div><b>VS</b><div><small>ĐỐI THỦ · {match.opponent ? formatSide(match.opponent.side) : "—"}</small><strong>{match.opponent?.displayName ?? "Không có đối thủ"}</strong><span>{match.opponent?.ratingAfter ?? match.opponent?.ratingBefore ?? "—"}</span></div></div><div className="history-card-meta"><span>{match.result === "ABORTED" ? "Trận bị gián đoạn" : formatReason(match.resultReason)}</span><span>{match.timerSeconds}s/người · {formatDate(match.endedAt)}</span>{match.ratingDelta !== null && <b>{match.ratingDelta > 0 ? "+" : ""}{match.ratingDelta} Elo</b>}</div></button>;
}

function DetailPanel({ match }: { match: HistoryDetailResponse["match"] }) {
  return <div className="history-detail"><div className="detail-result"><span>{match.result === "ABORTED" ? "GIÁN ĐOẠN" : match.result === "WIN" ? "THẮNG" : "THUA"}</span><strong>{match.result === "ABORTED" ? "Trận bị gián đoạn" : match.result === "WIN" ? "Bạn thắng" : "Bạn thua"}</strong></div><FinalPositionThumbnail board={match.finalBoard} /><dl><div><dt>Mã trận</dt><dd>{match.matchId}</dd></div><div><dt>Phòng</dt><dd>{match.roomId}</dd></div><div><dt>Kết quả</dt><dd>{formatReason(match.resultReason)}</dd></div><div><dt>Thời lượng</dt><dd>{formatDuration(match.durationSeconds)}</dd></div><div><dt>Bắt đầu</dt><dd>{match.startedAt ? formatDate(match.startedAt) : "—"}</dd></div><div><dt>Kết thúc</dt><dd>{formatDate(match.endedAt)}</dd></div><div><dt>Thời gian</dt><dd>{match.timerSeconds}s/người</dd></div><div><dt>Elo thay đổi</dt><dd>{match.ratingDelta === null ? "—" : `${match.ratingDelta > 0 ? "+" : ""}${match.ratingDelta}`}</dd></div></dl><div className="detail-players">{match.players.map((player) => <div key={player.userId}><span>{formatSide(player.side)}</span><strong>{player.displayName}</strong><small>@{player.username} · {player.ratingBefore ?? "—"} → {player.ratingAfter ?? "—"}</small></div>)}</div></div>;
}

function parseFilters(params: URLSearchParams): HistoryFilters {
  const mode = params.get("mode");
  const result = params.get("result");
  const range = params.get("range");
  return {
    mode: mode === "RANKED" || mode === "UNRANKED" || mode === "GUEST" || mode === "AI" || mode === "OFFLINE" ? mode : "ALL",
    result: result === "WIN" || result === "LOSS" ? result : "ALL",
    range: range === "7D" || range === "30D" ? range : "ALL",
  };
}

function formatDate(value: string): string { return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function formatDuration(seconds: number): string { return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`; }
function formatSide(side: "BLUE" | "RED"): string { return side === "BLUE" ? "Xanh" : "Đỏ"; }
function formatMode(mode: HistoryMatchCard["mode"]): string { return ({ RANKED: "Xếp hạng", UNRANKED: "Thường", GUEST: "Khách", AI: "Đấu máy", OFFLINE: "Ngoại tuyến" } as const)[mode]; }
function formatReason(reason: string | null): string { return reason ? ({ GOAL_REACHED: "Chiếm ô đích", SURRENDER: "Đầu hàng", TIMEOUT: "Hết giờ", DISCONNECTED: "Mất kết nối", DISCONNECT_TIMEOUT: "Đối thủ không kết nối lại", SERVER_INTERRUPTION: "Máy chủ bị gián đoạn", EXTINCTION: "Đối thủ mất toàn bộ Kéo", ABORTED: "Đã hủy" } as Record<string, string>)[reason] ?? reason.replaceAll("_", " ") : "—"; }
