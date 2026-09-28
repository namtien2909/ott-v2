import { useEffect, useState } from "react";

export type QualityTier = "high" | "medium" | "low";
export type QualityPreference = "auto" | QualityTier;
export const QUALITY_PARTICLE_COUNTS: Readonly<Record<QualityTier, number>> = { high: 400, medium: 150, low: 0 };
export const QUALITY_DPR_CAPS: Readonly<Record<QualityTier, number>> = { high: 2, medium: 1.5, low: 1 };
export const QUALITY_STORAGE_KEY = "ottv2:quality-tier";

const tiers: readonly QualityTier[] = ["high", "medium", "low"];

function isTier(value: string | null): value is QualityTier {
  return value !== null && tiers.includes(value as QualityTier);
}

function isPreference(value: string | null): value is QualityPreference {
  return value === "auto" || isTier(value);
}

export type QualityEnvironment = {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  saveData?: boolean;
  reducedMotion?: boolean;
  viewportWidth?: number;
};

export function readQualityPreference(): QualityPreference {
  try {
    const value = localStorage.getItem(QUALITY_STORAGE_KEY);
    return isPreference(value) ? value : "auto";
  } catch { return "auto"; }
}

export function detectQualityTier(environment?: QualityEnvironment): QualityTier {
  if (typeof window === "undefined" && !environment) return "medium";
  const source = environment ?? {
    hardwareConcurrency: typeof navigator === "undefined" ? 4 : navigator.hardwareConcurrency,
    deviceMemory: typeof navigator === "undefined" ? 4 : (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    saveData: typeof navigator === "undefined" ? false : (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData,
    reducedMotion: typeof window === "undefined" ? false : window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.reducedMotion === "true",
    viewportWidth: typeof window === "undefined" ? 1024 : window.innerWidth,
  };
  const memory = source.deviceMemory ?? 4;
  const concurrency = source.hardwareConcurrency ?? 4;
  if (source.reducedMotion || source.saveData || memory <= 2 || concurrency <= 2) return "low";
  if (memory <= 4 || concurrency <= 4 || (source.viewportWidth ?? 1024) < 700) return "medium";
  return "high";
}

export function resolveQualityPreference(preference: QualityPreference, environment?: QualityEnvironment): QualityTier {
  return preference === "auto" ? detectQualityTier(environment) : preference;
}

export function qualityDprCap(tier: QualityTier, devicePixelRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio): number {
  return Math.min(QUALITY_DPR_CAPS[tier], Math.max(1, Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1));
}

class QualityTierController {
  private preference: QualityPreference = readQualityPreference();
  private tier: QualityTier = resolveQualityPreference(this.preference);
  private readonly listeners = new Set<(tier: QualityTier) => void>();
  private frameSamples: number[] = [];
  private frameWindowStartedAt: number | null = null;

  get current(): QualityTier { return this.tier; }
  get selected(): QualityPreference { return this.preference; }
  subscribe(listener: (tier: QualityTier) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  set(tier: QualityTier, persist = false): void {
    if (this.tier === tier) return;
    this.tier = tier;
    if (persist) {
      this.preference = tier;
      try { localStorage.setItem(QUALITY_STORAGE_KEY, tier); } catch { /* optional */ }
    }
    if (typeof document !== "undefined") document.documentElement.dataset.qualityTier = tier;
    this.listeners.forEach((listener) => listener(tier));
  }

  setPreference(preference: QualityPreference): void {
    const previous = this.tier;
    this.preference = preference;
    try { localStorage.setItem(QUALITY_STORAGE_KEY, preference); } catch { /* optional */ }
    this.set(resolveQualityPreference(preference), false);
    if (typeof document !== "undefined") document.documentElement.dataset.qualityTier = this.tier;
    if (preference === "auto" && previous !== this.tier && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ottv2:quality-tier-changed", { detail: { tier: this.tier, previous } }));
    }
  }

  reportFrame(durationMs: number, sampledAt = performance.now()): void {
    if (this.preference !== "auto" || this.tier === "low" || !Number.isFinite(durationMs)) return;
    if (this.frameWindowStartedAt === null) this.frameWindowStartedAt = sampledAt;
    this.frameSamples.push(durationMs);
    if (sampledAt - this.frameWindowStartedAt < 3_000) return;
    const sorted = [...this.frameSamples].sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    this.frameSamples = [];
    this.frameWindowStartedAt = sampledAt;
    if (p95 > 24) {
      const previous = this.tier;
      this.set(this.tier === "high" ? "medium" : "low");
      if (this.tier !== previous && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("ottv2:quality-downgrade", { detail: { from: previous, to: this.tier } }));
      }
    }
  }

  /** Test/diagnostic hook: clears the rolling frame window without changing preference. */
  resetFrameMonitor(): void {
    this.frameSamples = [];
    this.frameWindowStartedAt = null;
  }
}

export const qualityTierController = new QualityTierController();

export function useQualityTier(): QualityTier {
  const [tier, setTier] = useState<QualityTier>(qualityTierController.current);
  useEffect(() => qualityTierController.subscribe(setTier), []);
  return tier;
}

export function applyQualityTier(tier: QualityTier = qualityTierController.current): void {
  qualityTierController.set(tier);
  if (typeof document !== "undefined") document.documentElement.dataset.qualityTier = tier;
}

export function applyQualityPreference(preference: QualityPreference): void {
  qualityTierController.setPreference(preference);
}
