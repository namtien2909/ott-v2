import { describe, expect, it } from "vitest";
import { applyPresentationPreferences, LEGACY_SOUND_VOLUME_KEY, readAudioPreference, SFX_VOLUME_KEY } from "./preferences";

describe("B10 local presentation preferences", () => {
  beforeEach(() => localStorage.clear());

  it("keeps motion preferences local and applies them to the document", () => {
    localStorage.setItem("ottv2:reduced-motion", "on");
    localStorage.setItem("ottv2:ambient-motion", "off");
    applyPresentationPreferences();
    expect(document.documentElement.dataset.reducedMotion).toBe("true");
    expect(document.documentElement.dataset.ambientMotion).toBe("false");
  });

  it("reads the legacy SFX volume while preserving the new key contract", () => {
    localStorage.setItem(LEGACY_SOUND_VOLUME_KEY, "42");
    expect(readAudioPreference(SFX_VOLUME_KEY, 55)).toBe(42);
    localStorage.setItem(SFX_VOLUME_KEY, "73");
    expect(readAudioPreference(SFX_VOLUME_KEY, 55)).toBe(73);
  });
});
