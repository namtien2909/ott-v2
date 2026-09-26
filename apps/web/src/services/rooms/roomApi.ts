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

export { env };
