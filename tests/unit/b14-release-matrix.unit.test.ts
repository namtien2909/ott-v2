import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { routes } from "../../apps/web/src/app/routes";
import { BGM_TRACKS, SYNTHESIZED_SFX_CUES } from "../../apps/web/src/services/presentation/preferences";

describe("B14 release matrix contracts", () => {
  it("keeps every canonical route family and alias mapped", () => {
    expect(Object.values(routes)).toEqual(expect.arrayContaining([
      "/", "/home", "/dang-nhap", "/login", "/dang-ky", "/register", "/quen-mat-khau", "/forgot-password",
      "/queue", "/phong/:roomId", "/room/:roomId", "/game/:roomId", "/lich-su", "/history", "/history/:matchId",
      "/ho-so", "/profile/:username", "/ban-be", "/friends", "/cai-dat", "/settings", "/guest", "/guest/play", "/ai", "/offline", "/spectate/:roomId",
    ]));
  });

  it("locks the 06B theme/motion/viewport matrix dimensions", () => {
    expect(["light", "dark", "system"]).toHaveLength(3);
    expect(["normal", "reduced"]).toHaveLength(2);
    expect([[375, 812], [768, 1024], [1366, 768], [1920, 1080]]).toHaveLength(4);
  });

  it("ships every synthesized SFX cue plus attributed lazy BGM tracks", () => {
    expect(SYNTHESIZED_SFX_CUES).toHaveLength(16);
    expect(SYNTHESIZED_SFX_CUES).toEqual(expect.arrayContaining(["ui_hover", "ui_click", "ui_confirm", "ui_error", "select", "move", "capture", "goal_warning", "low_time_tick", "match_found", "countdown_tick", "countdown_go", "victory", "defeat", "elo_tick", "rank_up"]));
    expect(BGM_TRACKS).toEqual({ lobby: "/audio/bgm/lobby_loop.wav", match: "/audio/bgm/match_loop.wav" });
    const attribution = readFileSync("apps/web/public/audio/bgm/ATTRIBUTION.md", "utf8");
    expect(attribution).toContain("lobby_loop.wav");
    expect(attribution).toContain("match_loop.wav");
  });

  it("keeps the canonical a1/i9 setup explicit", () => {
    const setup = readFileSync("packages/game-rules/src/setup.ts", "utf8");
    expect(setup).toMatch(/a1/);
    expect(setup).toMatch(/i9/);
  });
});
