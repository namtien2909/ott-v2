import { describe, expect, it } from "vitest";

import { PresenceManager } from "../../src/modules/social/presence.manager.js";
import { INVITE_TTL_MS, normalizePair } from "../../src/modules/social/social.service.js";

describe("W8 social contracts", () => {
  it("normalizes reciprocal friendship keys", () => {
    expect(normalizePair("user-b", "user-a")).toBe(normalizePair("user-a", "user-b"));
  });

  it("fans presence only to subscribed friends and never includes a room id", () => {
    const presence = new PresenceManager();
    const friendEvents: unknown[] = [];
    const strangerEvents: unknown[] = [];
    const user = { userId: "u1", username: "blue", displayName: "Blue" };
    const stop = presence.subscribe("viewer", ["u1"], [user], (event) => friendEvents.push(event), 100);
    presence.subscribe("stranger", ["u2"], [user], (event) => strangerEvents.push(event), 100);
    presence.set(user, "IN_GAME", 200);
    expect(friendEvents).toHaveLength(2);
    expect(friendEvents.at(-1)).toMatchObject({ type: "FRIEND_PRESENCE_CHANGED", user: { userId: "u1", presence: "IN_GAME" } });
    expect(strangerEvents).toHaveLength(0);
    expect(JSON.stringify(friendEvents)).not.toContain("roomId");
    stop();
    presence.stop();
  });

  it("keeps the invite TTL explicit for expiry checks", () => {
    expect(INVITE_TTL_MS).toBe(5 * 60 * 1000);
  });
});
