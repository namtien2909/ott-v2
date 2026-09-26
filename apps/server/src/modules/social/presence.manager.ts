import type { PresenceEvent, PresenceStatus } from "@ottv2/contracts";

export type PresenceUser = { userId: string; username: string; displayName: string };
type PresenceListener = (event: PresenceEvent) => void;

export class PresenceManager {
  private readonly states = new Map<string, PresenceStatus>();
  private readonly listeners = new Map<string, { friendIds: Set<string>; listener: PresenceListener }>();

  get(userId: string): PresenceStatus { return this.states.get(userId) ?? "OFFLINE"; }

  set(user: PresenceUser, status: PresenceStatus, now = Date.now()): void {
    this.states.set(user.userId, status);
    const event: PresenceEvent = { protocolVersion: "0.1", type: "FRIEND_PRESENCE_CHANGED", timestamp: now, user: { ...user, presence: status } };
    for (const subscription of this.listeners.values()) if (subscription.friendIds.has(user.userId)) subscription.listener(event);
  }

  subscribe(viewerId: string, friendIds: string[], users: PresenceUser[], listener: PresenceListener, now = Date.now()): () => void {
    const friendSet = new Set(friendIds.filter((id) => id !== viewerId));
    this.listeners.set(viewerId, { friendIds: friendSet, listener });
    for (const user of users.filter((item) => friendSet.has(item.userId))) {
      listener({ protocolVersion: "0.1", type: "PRESENCE_SNAPSHOT", timestamp: now, user: { ...user, presence: this.get(user.userId) } });
    }
    return () => this.listeners.delete(viewerId);
  }

  stop(): void { this.listeners.clear(); this.states.clear(); }
}
