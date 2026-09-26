import type { MatchEventEnvelope, MatchSnapshot, RoomDetail } from "@ottv2/contracts";
import { env } from "../../config/env";
import { getJson, requestJson } from "../http/httpClient";

export function requestSpectator(roomId: string, password?: string) {
  return requestJson<{ role: "SPECTATOR"; room: RoomDetail }>(`/rooms/${encodeURIComponent(roomId)}/spectate`, { method: "POST", body: password ? { password } : {} });
}

export function getSpectatorMatch(roomId: string) {
  return getJson(`/matches/${encodeURIComponent(roomId)}/spectator`) as Promise<{ role: "SPECTATOR"; room: RoomDetail; match: MatchSnapshot; viewerSide: null; spectatorCount: number }>;
}

export function leaveSpectator(roomId: string) {
  return requestJson<void>(`/rooms/${encodeURIComponent(roomId)}/spectate/leave`, { method: "POST" });
}

export function subscribeToSpectator(roomId: string, onEvent: (event: MatchEventEnvelope) => void, onError: () => void): () => void {
  const source = new EventSource(`${env.apiBaseUrl}/matches/${encodeURIComponent(roomId)}/spectator/events`, { withCredentials: true });
  source.onmessage = (message) => { try { onEvent(JSON.parse(message.data) as MatchEventEnvelope); } catch { onError(); } };
  source.onerror = onError;
  return () => source.close();
}
