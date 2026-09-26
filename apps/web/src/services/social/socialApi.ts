import type { BlockedUser, FriendRequest, PresenceEvent, RoomInvite, SocialUser } from "@ottv2/contracts";
import { env } from "../../config/env";
import { getJson, requestJson } from "../http/httpClient";

export function getFriends() { return getJson("/social/friends") as Promise<{ friends: SocialUser[] }>; }
export function searchUsers(query: string) { return getJson(`/social/search?q=${encodeURIComponent(query)}`) as Promise<{ results: SocialUser[] }>; }
export function getRequests(direction: "incoming" | "sent") { return getJson(`/social/requests?direction=${direction}`) as Promise<{ requests: FriendRequest[] }>; }
export function sendFriendRequest(userId: string) { return requestJson<{ requestId?: string; friendshipCreated?: boolean }>(`/social/requests/${encodeURIComponent(userId)}`, { method: "POST" }); }
export function updateFriendRequest(requestId: string, action: "accept" | "reject" | "cancel") { return requestJson<void>(`/social/requests/${encodeURIComponent(requestId)}/${action}`, { method: "POST" }); }
export function removeFriend(userId: string) { return requestJson<void>(`/social/friends/${encodeURIComponent(userId)}`, { method: "DELETE" }); }
export function blockUser(userId: string) { return requestJson<void>(`/social/blocks/${encodeURIComponent(userId)}`, { method: "POST" }); }
export function unblockUser(userId: string) { return requestJson<void>(`/social/blocks/${encodeURIComponent(userId)}`, { method: "DELETE" }); }
export function getBlockedUsers() { return getJson("/social/blocks") as Promise<{ users: BlockedUser[] }>; }
export function getInvites() { return getJson("/social/invites") as Promise<{ invites: RoomInvite[] }>; }
export function createInvite(roomId: string, targetUserId: string) { return requestJson<{ invite: RoomInvite }>("/social/invites", { method: "POST", body: { roomId, targetUserId } }); }
export function acceptInvite(token: string) { return requestJson<{ room: unknown }>(`/social/invites/${encodeURIComponent(token)}/accept`, { method: "POST" }); }
export function rejectInvite(token: string) { return requestJson<void>(`/social/invites/${encodeURIComponent(token)}/reject`, { method: "POST" }); }
export function subscribeToPresence(onEvent: (event: PresenceEvent) => void, onError: () => void): () => void {
  const source = new EventSource(`${env.apiBaseUrl}/social/presence/events`, { withCredentials: true });
  source.onmessage = (message) => { try { onEvent(JSON.parse(message.data) as PresenceEvent); } catch { onError(); } };
  source.onerror = onError;
  return () => source.close();
}
