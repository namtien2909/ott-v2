import { beforeEach, describe, expect, it } from "vitest";
import { createInitialState } from "@ottv2/game-rules";
import { clearLocalSession, getGuestProfile, getLocalSession, migrateLegacyGuestSessionToOffline, setLocalSession, type LocalSessionSnapshot } from "./localGameStorage";

describe("local session persistence", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips an in-progress mode and clears it after leave/finish", async () => {
    const session: LocalSessionSnapshot = {
      mode: "OFFLINE",
      setup: { blueName: "Xanh", redName: "Đỏ", timerSeconds: 60 },
      state: createInitialState(),
      clocks: { BLUE: 52, RED: 60 },
      remaining: 52,
      savedAt: new Date().toISOString(),
    };
    await setLocalSession(session);
    await expect(getLocalSession("OFFLINE")).resolves.toMatchObject({ mode: "OFFLINE", remaining: 52, setup: session.setup });
    await clearLocalSession("OFFLINE");
    await expect(getLocalSession("OFFLINE")).resolves.toBeNull();
  });

  it("creates one stable Guest identity when no profile exists", async () => {
    await expect(getGuestProfile()).resolves.toMatchObject({ displayName: expect.stringMatching(/^Khách /) });
    const first = await getGuestProfile();
    const second = await getGuestProfile();
    expect(first).toEqual(second);
  });

  it("copies a legacy Guest session into Offline2P without deleting the source", async () => {
    const legacy: LocalSessionSnapshot = {
      mode: "GUEST",
      setup: { blueName: "Khách", redName: "Đỏ", timerSeconds: 60 },
      state: createInitialState(),
      clocks: { BLUE: 52, RED: 60 },
      remaining: 52,
      savedAt: new Date().toISOString(),
    };
    await setLocalSession(legacy);
    const migrated = await migrateLegacyGuestSessionToOffline();
    expect(migrated?.mode).toBe("OFFLINE");
    await expect(getLocalSession("GUEST")).resolves.toMatchObject({ mode: "GUEST" });
    await expect(getLocalSession("OFFLINE")).resolves.toMatchObject({ mode: "OFFLINE" });
    await clearLocalSession("OFFLINE");
    await expect(migrateLegacyGuestSessionToOffline()).resolves.toBeNull();
  });
});

