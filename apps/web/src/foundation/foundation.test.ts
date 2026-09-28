import { describe, expect, it } from "vitest";
import { applyDesignTokens, DESIGN_TOKENS } from "./tokens";
import { createSemanticEvent, SemanticEventBus } from "./eventBus";
import { QUALITY_DPR_CAPS, QUALITY_PARTICLE_COUNTS, detectQualityTier, qualityDprCap, qualityTierController, resolveQualityPreference } from "./qualityTier";

describe("B1 shared foundation", () => {
  it("applies the 06B semantic token contract for light and dark surfaces", () => {
    applyDesignTokens("dark");
    expect(document.documentElement.style.getPropertyValue("--system-cyan")).toBe(DESIGN_TOKENS.dark["--system-cyan"]);
    expect(document.documentElement.style.getPropertyValue("--gradient-victory")).toContain("#FFC94A");
    applyDesignTokens("light");
    expect(document.documentElement.style.getPropertyValue("--bg-root")).toBe(DESIGN_TOKENS.light["--bg-root"]);
  });

  it("deduplicates eventId and drops stale state versions", () => {
    const bus = new SemanticEventBus();
    const received: string[] = [];
    bus.subscribe((event) => received.push(event.eventId));
    const current = createSemanticEvent({ eventId: "move-2", stateVersion: 2, source: "test", type: "MOVE", payload: null });
    expect(bus.emit(current)).toBe(true);
    expect(bus.emit(current)).toBe(false);
    expect(bus.emit(createSemanticEvent({ eventId: "move-1", stateVersion: 1, source: "test", type: "MOVE", payload: null }))).toBe(false);
    expect(received).toEqual(["move-2"]);
  });

  it("exposes tier budgets and a safe automatic fallback", () => {
    expect(QUALITY_PARTICLE_COUNTS).toEqual({ high: 400, medium: 150, low: 0 });
    expect(QUALITY_DPR_CAPS).toEqual({ high: 2, medium: 1.5, low: 1 });
    expect(qualityDprCap("high", 3)).toBe(2);
    expect(qualityDprCap("medium", 1)).toBe(1);
    expect(qualityDprCap("low", 3)).toBe(1);
    expect(["high", "medium", "low"]).toContain(detectQualityTier());
  });

  it("resolves quality deterministically from a mocked device profile", () => {
    expect(detectQualityTier({ hardwareConcurrency: 2, deviceMemory: 8, viewportWidth: 1440 })).toBe("low");
    expect(detectQualityTier({ hardwareConcurrency: 8, deviceMemory: 4, viewportWidth: 1440 })).toBe("medium");
    expect(detectQualityTier({ hardwareConcurrency: 8, deviceMemory: 8, viewportWidth: 1440 })).toBe("high");
    expect(resolveQualityPreference("low", { hardwareConcurrency: 8, deviceMemory: 8, viewportWidth: 1440 })).toBe("low");
  });

  it("only downgrades after a continuous three-second p95 frame window", () => {
    qualityTierController.setPreference("auto");
    qualityTierController.set("high");
    qualityTierController.resetFrameMonitor();
    for (let index = 0; index < 180; index += 1) qualityTierController.reportFrame(30, index * 16);
    expect(qualityTierController.current).toBe("high");
    qualityTierController.reportFrame(30, 3_000);
    expect(qualityTierController.current).toBe("medium");
    qualityTierController.setPreference("auto");
    qualityTierController.resetFrameMonitor();
  });
});
