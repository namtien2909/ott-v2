export const SOUND_KEY = "ottv2:sound";
export const REDUCED_MOTION_KEY = "ottv2:reduced-motion";
export const AMBIENT_MOTION_KEY = "ottv2:ambient-motion";

export function reducedMotionEnabled(): boolean {
  try { return localStorage.getItem(REDUCED_MOTION_KEY) === "on" || window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch { return false; }
}

export function applyPresentationPreferences(): void {
  document.documentElement.dataset.reducedMotion = reducedMotionEnabled() ? "true" : "false";
  document.documentElement.dataset.ambientMotion = localStorage.getItem(AMBIENT_MOTION_KEY) === "off" ? "false" : "true";
}

export type SoundCue = "click" | "matchFound" | "countdown" | "lowTime" | "move" | "capture" | "victory" | "defeat";

const frequencies: Record<SoundCue, number[]> = { click: [560], matchFound: [440, 660, 880], countdown: [660], lowTime: [880], move: [520], capture: [180, 420], victory: [523, 659, 784], defeat: [330, 262, 196] };

export function playSound(cue: SoundCue): void {
  try {
    if (localStorage.getItem(SOUND_KEY) === "off" || (cue === "countdown" && localStorage.getItem("ottv2:countdown-sound") === "off")) return;
    const Context = window.AudioContext ?? window.webkitAudioContext;
    if (!Context) return;
    const context = new Context();
    const now = context.currentTime;
    frequencies[cue].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = cue === "capture" || cue === "defeat" ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      const start = now + index * 0.07;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime((cue === "lowTime" ? 0.025 : 0.04) * Math.max(0, Math.min(100, Number(localStorage.getItem("ottv2:sound-volume") ?? 55))) / 55, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start); oscillator.stop(start + 0.14);
    });
    window.setTimeout(() => void context.close(), 500);
  } catch { /* Audio is optional and must never block UI. */ }
}

declare global { interface Window { webkitAudioContext?: typeof AudioContext } }
