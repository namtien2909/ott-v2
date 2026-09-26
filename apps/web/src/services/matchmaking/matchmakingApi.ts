import type { MatchmakingEventEnvelope, MatchmakingSnapshot } from "@ottv2/contracts";

import { env } from "../../config/env";
import { getJson, requestJson } from "../http/httpClient";
import { getClientId } from "../session/clientIdentity";

export function joinRankedQueue() {
  return requestJson<{ queue: MatchmakingSnapshot }>("/matchmaking/queue", { method: "POST", body: { mode: "RANKED" }, headers: { "X-Client-Id": getClientId() } });
}

export function getQueue(queueId: string) {
  return getJson(`/matchmaking/queue/${encodeURIComponent(queueId)}`) as Promise<{ queue: MatchmakingSnapshot }>;
}

export function cancelQueue(queueId: string) {
  return requestJson<{ queue: MatchmakingSnapshot }>(`/matchmaking/queue/${encodeURIComponent(queueId)}`, { method: "DELETE", headers: { "X-Client-Id": getClientId() } });
}

export function subscribeToQueue(queueId: string, onEvent: (event: MatchmakingEventEnvelope) => void, onError: () => void): () => void {
  const source = new EventSource(`${env.apiBaseUrl}/matchmaking/queue/${encodeURIComponent(queueId)}/events?clientId=${encodeURIComponent(getClientId())}`, { withCredentials: true });
  source.onmessage = (message) => { try { onEvent(JSON.parse(message.data) as MatchmakingEventEnvelope); } catch { onError(); } };
  source.onerror = onError;
  return () => source.close();
}
