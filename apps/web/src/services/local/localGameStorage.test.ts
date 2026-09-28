import { beforeEach, describe, expect, it } from "vitest";
import { createInitialState } from "@ottv2/game-rules";
import { clearLocalSession, getLocalSession, setLocalSession, type LocalSessionSnapshot } from "./localGameStorage";

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
});

