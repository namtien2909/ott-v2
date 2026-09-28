import type { CreateRoomRequest, JoinRoomRequest, RoomDetail, RoomSummary } from "@ottv2/contracts";
import { env } from "../../config/env";
import { getJson, requestJson } from "../http/httpClient";

export function getRooms(search?: string) {
  const query = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
  return getJson(`/rooms${query}`) as Promise<{ rooms: Array<RoomSummary | RoomDetail> }>;
}

export function createRoom(input: CreateRoomRequest, idempotencyKey: string) {
  return requestJson<{ room: RoomDetail }>("/rooms", { method: "POST", body: input, headers: { "Idempotency-Key": idempotencyKey } });
}

export function joinRoom(roomId: string, input: JoinRoomRequest, idempotencyKey: string) {
  return requestJson<{ room: RoomDetail }>(`/rooms/${encodeURIComponent(roomId)}/join`, { method: "POST", body: input, headers: { "Idempotency-Key": idempotencyKey } });
}

export function leaveRoom(roomId: string) {
  return requestJson<void>(`/rooms/${encodeURIComponent(roomId)}/leave`, { method: "POST" });
}

export function subscribeToRooms(onRooms: (rooms: RoomSummary[]) => void, onError: () => void): () => void {
  const source = new EventSource(`${env.apiBaseUrl}/rooms/events`, { withCredentials: true });
  source.onmessage = (message) => { try { const payload = JSON.parse(message.data) as { type?: string; rooms?: RoomSummary[] }; if (payload.type === "ROOMS_SYNC" && Array.isArray(payload.rooms)) onRooms(payload.rooms); } catch { onError(); } };
  source.onerror = onError;
  return () => source.close();
}

export { env };
