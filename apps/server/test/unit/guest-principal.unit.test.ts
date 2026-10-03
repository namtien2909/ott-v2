import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { AuthService } from "../../src/modules/auth/auth.service.js";
import { registerGuestImportRoutes } from "../../src/modules/guest/guest-import.route.js";
import { GuestImportService } from "../../src/modules/guest/guest-import.service.js";
import { registerRoomRoutes } from "../../src/modules/room/room.route.js";
import { RoomManager } from "../../src/modules/room/room.manager.js";

describe("Guest principal", () => {
  it("issues an opaque bounded session and authenticates it as Guest", async () => {
    const auth = new AuthService();
    const session = auth.createGuestSession({ clientId: "browser-profile-123", displayName: "Khách Lam 123" });
    const context = await auth.authenticateAny(undefined, session.token);
    expect(context.principal).toBe("GUEST");
    expect(context.user.displayName).toBe("Khách Lam 123");
    await expect(auth.authenticateAny(session.token, undefined)).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    const second = auth.createGuestSession({ clientId: "browser-profile-123", displayName: "Tên khác" });
    const secondContext = await auth.authenticateAny(undefined, second.token);
    expect(second.token).not.toBe(session.token);
    expect(secondContext.user.id).not.toBe(context.user.id);
  });

  it("exposes a cookie-backed session endpoint without opening Ranked auth", async () => {
    const app = Fastify();
    const auth = new AuthService();
    await registerGuestImportRoutes(app, auth, new GuestImportService(), false);
    await app.ready();
    const response = await app.inject({ method: "POST", url: "/guest/session", payload: { clientId: "browser-profile-123", displayName: "Khách Lam 123" } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ principal: "GUEST", displayName: "Khách Lam 123" });
    expect(response.headers["set-cookie"]).toEqual(expect.stringContaining("ottv2_guest="));
    await app.close();
  });

  it("allows Guest custom rooms but rejects Ranked room access", async () => {
    const app = Fastify();
    const auth = new AuthService();
    const rooms = new RoomManager();
    await registerRoomRoutes(app, auth, rooms);
    await app.ready();
    const guest = auth.createGuestSession({ clientId: "browser-profile-123", displayName: "Khách Lam 123" });
    const cookie = `ottv2_guest=${encodeURIComponent(guest.token)}`;
    const normal = await app.inject({ method: "POST", url: "/rooms", headers: { cookie }, payload: { name: "Phòng khách", visibility: "PUBLIC", timerSeconds: 60, spectatorsEnabled: false } });
    expect(normal.statusCode).toBe(201);
    expect(normal.json().room.mode).toBe("UNRANKED");
    const ranked = await rooms.createRanked({ userId: "account-a", username: "a", displayName: "A" }, { userId: "account-b", username: "b", displayName: "B" });
    const denied = await app.inject({ method: "POST", url: `/rooms/${ranked.roomId}/join`, headers: { cookie }, payload: {} });
    expect(denied.statusCode).toBe(403);
    expect(denied.json()).toMatchObject({ code: "UNAUTHORIZED" });
    await app.close();
  });

  it("does not let an expired Guest cookie shadow a valid account session", async () => {
    const app = Fastify();
    const rooms = new RoomManager();
    const account = { userId: "account-a", username: "account_a", displayName: "Account A", rating: 1200 };
    const created = await rooms.create(account, { visibility: "PUBLIC", timerSeconds: 60, spectatorsEnabled: false });
    const auth = {
      authenticate: async () => ({ principal: "ACCOUNT", user: { id: account.userId, username: account.username, displayName: account.displayName, stats: { elo: 1200 } } }),
      authenticateAny: async () => { throw new Error("expired guest"); },
    } as unknown as AuthService;
    await registerRoomRoutes(app, auth, rooms);
    await app.ready();
    const response = await app.inject({ method: "POST", url: `/rooms/${created.roomId}/leave`, headers: { cookie: "ottv2_session=account; ottv2_guest=stale" } });
    expect(response.statusCode).toBe(204);
    await app.close();
  });
});
