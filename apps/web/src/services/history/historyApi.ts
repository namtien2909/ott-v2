import type { HistoryDetailResponse, HistoryListResponse, HistoryMode, HistoryResultFilter, HistoryRangeFilter } from "@ottv2/contracts";

import { getJson } from "../http/httpClient";

export type HistoryFilters = { mode: "ALL" | HistoryMode; result: HistoryResultFilter; range: HistoryRangeFilter; cursor?: string };

export function getHistory(filters: HistoryFilters, signal?: AbortSignal): Promise<HistoryListResponse> {
  const params = new URLSearchParams({ mode: filters.mode, result: filters.result, range: filters.range, limit: "20" });
  if (filters.cursor) params.set("cursor", filters.cursor);
  return getJson(`/history?${params.toString()}`, signal) as Promise<HistoryListResponse>;
}

export function getHistoryDetail(matchId: string, signal?: AbortSignal): Promise<HistoryDetailResponse> {
  return getJson(`/history/${encodeURIComponent(matchId)}`, signal) as Promise<HistoryDetailResponse>;
}
