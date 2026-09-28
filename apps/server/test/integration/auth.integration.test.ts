import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app.js";
import { PrismaDatabase } from "../../src/plugins/prisma.js";

try { process.loadEnvFile?.(fileURLToPath(new URL("../../../../.env", import.meta.url))); } catch { /* local .env is optional in CI */ }

const prisma = new PrismaClient();
const env = {
  NODE_ENV: "test" as const,
  HOST: "127.0.0.1",
  PORT: 3001,
  LOG_LEVEL: "silent" as const,
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://missing:missing@127.0.0.1:5432/missing",
  CORS_ORIGINS: "http://localhost:8000",
  REALTIME_ADAPTER: "disabled" as const,
  corsOrigins: ["http://localhost:8000"],
};

function sessionCookie(response: { headers: Record<string, string | string[] | undefined> }): string {
  const raw = response.headers["set-cookie"];
  const first = Array.isArray(raw) ? raw[0] : raw;
  expect(first).toBeTruthy();
  return first!.split(";", 1)[0];
}

let app: Awaited<ReturnType<typeof buildApp>>;
const createdUsernames: string[] = [];
let sequence = 0;
function account() {
  const username = `w2test${Date.now().toString().slice(-6)}${sequence++}`.slice(0, 20);
  createdUsernames.push(username.toLowerCase());
  return { fullName: "Wave Two Player", displayName: "Wave Player", username, password: "correct-horse-battery" };
}

describe("W2 auth/profile flow", () => {
  beforeAll(async () => {
    app = await buildApp({ env, database: new PrismaDatabase(prisma) });
  });

  afterAll(async () => {
    if (createdUsernames.length) await prisma.user.deleteMany({ where: { usernameNormalized: { in: createdUsernames } } });
    await app.close();
    await prisma.$disconnect();
  });

  it("validates registration and reveals a non-persisted Recovery Code once", async () => {
    const invalid = await app.inject({ method: "POST", url: "/auth/register", payload: { fullName: "A", displayName: "A", username: "bad", password: "short" } });
    expect(invalid.statusCode).toBe(400);
    const input = account();
    const response = await app.inject({ method: "POST", url: "/auth/register", payload: input });
    expect(response.statusCode).toBe(201);
    const body = response.json() as { user: { username: string }; recoveryCode: string };
    expect(body.user.username).toBe(input.username);
    expect(body.recoveryCode).toMatch(/^OTTV2-/);
    const row = await prisma.user.findUniqueOrThrow({ where: { usernameNormalized: input.username.toLowerCase() } });
    expect(row.passwordHash).not.toBe(input.password);
    expect(row.recoveryCodeHash).not.toBe(body.recoveryCode);
    expect(row.recoveryUsedAt).toBeNull();
  });

  it("persists an allowed avatar preset and exposes it in the public profile", async () => {
    const input = account();
    const registered = await app.inject({ method: "POST", url: "/auth/register", payload: input });
    const cookie = sessionCookie(registered);
    const updated = await app.inject({ method: "PATCH", url: "/profiles/me", headers: { cookie }, payload: { avatarPreset: "fox" } });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().user.avatarPreset).toBe("fox");
    const publicResponse = await app.inject({ method: "GET", url: `/profiles/${input.username}` });
    expect(publicResponse.json().profile.avatarPreset).toBe("fox");
  });

  it("allows multiple sessions and revokes only the logged-out session", async () => {
    const input = account();
    const registered = await app.inject({ method: "POST", url: "/auth/register", payload: input });
    const firstCookie = sessionCookie(registered);
    const second = await app.inject({ method: "POST", url: "/auth/login", payload: { username: input.username.toUpperCase(), password: input.password, remember: false } });
    const secondCookie = sessionCookie(second);
    await app.inject({ method: "POST", url: "/auth/logout", headers: { cookie: firstCookie } });
    expect((await app.inject({ method: "GET", url: "/auth/me", headers: { cookie: firstCookie } })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/auth/me", headers: { cookie: secondCookie } })).statusCode).toBe(200);
  });

  it("resets password with a one-time code and revokes previous sessions", async () => {
    const input = account();
    const registered = await app.inject({ method: "POST", url: "/auth/register", payload: input });
    const oldCookie = sessionCookie(registered);
    const code = (registered.json() as { recoveryCode: string }).recoveryCode;
    const recovered = await app.inject({ method: "POST", url: "/auth/recover", payload: { username: input.username, recoveryCode: code, newPassword: "new-correct-password" } });
    expect(recovered.statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/auth/me", headers: { cookie: oldCookie } })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/auth/login", payload: { username: input.username, password: "new-correct-password", remember: false } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/auth/recover", payload: { username: input.username, recoveryCode: code, newPassword: "third-password" } })).statusCode).toBe(401);
  });

  it("keeps private fields private in the public profile response", async () => {
    const input = account();
    await app.inject({ method: "POST", url: "/auth/register", payload: input });
    const self = await app.inject({ method: "GET", url: "/profiles/me", headers: { cookie: sessionCookie(await app.inject({ method: "POST", url: "/auth/login", payload: { username: input.username, password: input.password } })) } });
    expect(self.statusCode).toBe(200);
    expect(self.json().user).toHaveProperty("fullName");
    const publicResponse = await app.inject({ method: "GET", url: `/profiles/${input.username}` });
    expect(publicResponse.statusCode).toBe(200);
    const publicProfile = publicResponse.json().profile as Record<string, unknown>;
    expect(publicProfile).toMatchObject({ username: input.username, displayName: input.displayName });
    expect(publicProfile).not.toHaveProperty("fullName");
    expect(publicProfile).not.toHaveProperty("passwordHash");
    expect(publicProfile).not.toHaveProperty("recoveryCodeHash");
  });

  it("exposes relationship data while keeping presence private from non-friends", async () => {
    const viewerInput = account();
    const targetInput = account();
    const viewerRegistration = await app.inject({ method: "POST", url: "/auth/register", payload: viewerInput });
    const targetRegistration = await app.inject({ method: "POST", url: "/auth/register", payload: targetInput });
    const viewerCookie = sessionCookie(viewerRegistration);
    const targetCookie = sessionCookie(targetRegistration);
    const targetId = targetRegistration.json().user.id as string;

    const anonymous = await app.inject({ method: "GET", url: `/profiles/${targetInput.username}` });
    expect(anonymous.statusCode).toBe(200);
    expect(anonymous.json().profile).toMatchObject({ userId: targetId, friendCount: 0, recentForm: [], isFriend: false, requestStatus: null });
    expect(anonymous.json().profile).not.toHaveProperty("presence");

    const sent = await app.inject({ method: "POST", url: `/social/requests/${targetId}`, headers: { cookie: viewerCookie } });
    expect(sent.statusCode).toBe(201);
    const requestId = sent.json().requestId as string;
    expect((await app.inject({ method: "POST", url: `/social/requests/${requestId}/accept`, headers: { cookie: targetCookie } })).statusCode).toBe(204);
    await app.inject({ method: "GET", url: "/social/friends", headers: { cookie: targetCookie } });

    const friendView = await app.inject({ method: "GET", url: `/profiles/${targetInput.username}`, headers: { cookie: viewerCookie } });
    expect(friendView.statusCode).toBe(200);
    expect(friendView.json().profile).toMatchObject({ isFriend: true, friendCount: 1, presence: "ONLINE" });
  });

  it("persists presence privacy and enforces block/unblock in both directions", async () => {
    const viewerInput = account();
    const targetInput = account();
    const viewerRegistration = await app.inject({ method: "POST", url: "/auth/register", payload: viewerInput });
    const targetRegistration = await app.inject({ method: "POST", url: "/auth/register", payload: targetInput });
    const viewerCookie = sessionCookie(viewerRegistration);
    const targetCookie = sessionCookie(targetRegistration);
    const targetId = targetRegistration.json().user.id as string;
    const viewerId = viewerRegistration.json().user.id as string;

    const hidden = await app.inject({ method: "PATCH", url: "/profiles/me", headers: { cookie: targetCookie }, payload: { presenceVisibility: "NOBODY" } });
    expect(hidden.statusCode).toBe(200);
    expect(hidden.json().user.privacy.presenceVisibility).toBe("NOBODY");
    const hiddenSearch = await app.inject({ method: "GET", url: `/social/search?q=${targetInput.username}`, headers: { cookie: viewerCookie } });
    expect(hiddenSearch.json().results[0]).not.toHaveProperty("presence");

    const sent = await app.inject({ method: "POST", url: `/social/requests/${targetId}`, headers: { cookie: viewerCookie } });
    const requestId = sent.json().requestId as string;
    await app.inject({ method: "POST", url: `/social/requests/${requestId}/accept`, headers: { cookie: targetCookie } });
    await app.inject({ method: "GET", url: "/social/friends", headers: { cookie: targetCookie } });
    const hiddenFriendView = await app.inject({ method: "GET", url: `/profiles/${targetInput.username}`, headers: { cookie: viewerCookie } });
    expect(hiddenFriendView.json().profile).toMatchObject({ isFriend: true });
    expect(hiddenFriendView.json().profile).not.toHaveProperty("presence");

    const unhidden = await app.inject({ method: "PATCH", url: "/profiles/me", headers: { cookie: targetCookie }, payload: { presenceVisibility: "FRIENDS" } });
    expect(unhidden.json().user.privacy.presenceVisibility).toBe("FRIENDS");
    const visibleFriendView = await app.inject({ method: "GET", url: `/profiles/${targetInput.username}`, headers: { cookie: viewerCookie } });
    expect(visibleFriendView.json().profile).toHaveProperty("presence");

    expect((await app.inject({ method: "POST", url: `/social/blocks/${targetId}`, headers: { cookie: viewerCookie } })).statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: `/social/search?q=${viewerInput.username}`, headers: { cookie: targetCookie } })).json().results).toHaveLength(0);
    expect((await app.inject({ method: "POST", url: `/social/requests/${viewerId}`, headers: { cookie: targetCookie } })).statusCode).toBe(403);
    const blockedProfile = await app.inject({ method: "GET", url: `/profiles/${targetInput.username}`, headers: { cookie: viewerCookie } });
    expect(blockedProfile.json().profile).toMatchObject({ isFriend: false, requestStatus: null });

    expect((await app.inject({ method: "DELETE", url: `/social/blocks/${targetId}`, headers: { cookie: viewerCookie } })).statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: `/social/search?q=${targetInput.username}`, headers: { cookie: viewerCookie } })).json().results).toHaveLength(1);
  });

  it("keeps the current session on password change and progressively throttles failures", async () => {
    const input = account();
    const registered = await app.inject({ method: "POST", url: "/auth/register", payload: input });
    const currentCookie = sessionCookie(registered);
    const secondLogin = await app.inject({ method: "POST", url: "/auth/login", payload: { username: input.username, password: input.password } });
    const otherCookie = sessionCookie(secondLogin);
    const changed = await app.inject({ method: "POST", url: "/auth/password", headers: { cookie: currentCookie }, payload: { currentPassword: input.password, newPassword: "changed-correct-password" } });
    expect(changed.statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: "/auth/me", headers: { cookie: currentCookie } })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/auth/me", headers: { cookie: otherCookie } })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/auth/login", payload: { username: input.username, password: input.password } })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/auth/login", payload: { username: input.username, password: "changed-correct-password" } })).statusCode).toBe(200);

    const throttleInput = account();
    await app.inject({ method: "POST", url: "/auth/register", payload: throttleInput });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await app.inject({ method: "POST", url: "/auth/login", payload: { username: throttleInput.username, password: "wrong-password" } })).statusCode).toBe(401);
    }
    expect((await app.inject({ method: "POST", url: "/auth/login", payload: { username: throttleInput.username, password: "wrong-password" } })).statusCode).toBe(429);
  });
});
