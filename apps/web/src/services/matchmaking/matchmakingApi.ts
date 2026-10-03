import { MatchmakingEventEnvelopeSchema, type MatchmakingEventEnvelope, type MatchmakingSnapshot } from "@ottv2/contracts";

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

export function subscribeToQueue(queueId: string, onEvent: (event: MatchmakingEventEnvelope) => void, onError: () => void, onOpen?: () => void): () => void {
  const source = new EventSource(`${env.apiBaseUrl}/matchmaking/queue/${encodeURIComponent(queueId)}/events?clientId=${encodeURIComponent(getClientId())}`, { withCredentials: true });
  source.onmessage = (message) => {
    try {
      const event = MatchmakingEventEnvelopeSchema.parse(JSON.parse(message.data));
      if (event.queueId === queueId && event.payload.queueId === queueId) onEvent(event);
    } catch { onError(); }
  };
  source.onerror = onError;
  source.onopen = () => onOpen?.();
  return () => source.close();
}
