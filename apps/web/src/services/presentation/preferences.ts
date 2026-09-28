export const SOUND_KEY = "ottv2:sound";
export const SFX_KEY = "ottv2:sfx";
export const REDUCED_MOTION_KEY = "ottv2:reduced-motion";
export const AMBIENT_MOTION_KEY = "ottv2:ambient-motion";
export const BGM_KEY = "ottv2:bgm";
export const COUNTDOWN_SOUND_KEY = "ottv2:countdown-sound";
export const MASTER_VOLUME_KEY = "ottv2:master-volume";
export const SFX_VOLUME_KEY = "ottv2:sfx-volume";
export const BGM_VOLUME_KEY = "ottv2:bgm-volume";
export const LEGACY_SOUND_VOLUME_KEY = "ottv2:sound-volume";

export function reducedMotionEnabled(): boolean {
  try { return localStorage.getItem(REDUCED_MOTION_KEY) === "on" || window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch { return false; }
}

export function applyPresentationPreferences(): void {
  document.documentElement.dataset.reducedMotion = reducedMotionEnabled() ? "true" : "false";
  document.documentElement.dataset.ambientMotion = localStorage.getItem(AMBIENT_MOTION_KEY) === "off" ? "false" : "true";
}

export const SYNTHESIZED_SFX_CUES = [
  "ui_hover", "ui_click", "ui_confirm", "ui_error", "select", "move", "capture", "goal_warning",
  "low_time_tick", "match_found", "countdown_tick", "countdown_go", "victory", "defeat", "elo_tick", "rank_up",
] as const;
export type SynthesizedSoundCue = typeof SYNTHESIZED_SFX_CUES[number];
/** Legacy aliases remain supported while all new event producers use the spec names. */
export type SoundCue = SynthesizedSoundCue | "click" | "matchFound" | "countdown" | "lowTime";

const cueAliases: Record<Exclude<SoundCue, SynthesizedSoundCue>, SynthesizedSoundCue> = { click: "ui_click", matchFound: "match_found", countdown: "countdown_tick", lowTime: "low_time_tick" };
const frequencies: Record<SynthesizedSoundCue, number[]> = {
  ui_hover: [420], ui_click: [560], ui_confirm: [560, 760], ui_error: [150, 110], select: [680], move: [520], capture: [180, 420],
  goal_warning: [110, 150, 110], low_time_tick: [880], match_found: [440, 660, 880], countdown_tick: [660], countdown_go: [880, 1040],
  victory: [523, 659, 784], defeat: [330, 262, 196], elo_tick: [740], rank_up: [523, 659, 1046],
};

export const BGM_TRACKS = { lobby: "/audio/bgm/lobby_loop.wav", match: "/audio/bgm/match_loop.wav" } as const;

function canonicalCue(cue: SoundCue): SynthesizedSoundCue {
  return cue in cueAliases ? cueAliases[cue as Exclude<SoundCue, SynthesizedSoundCue>] : cue as SynthesizedSoundCue;
}

let sharedAudioContext: AudioContext | null = null;
let sharedMasterGain: GainNode | null = null;
let backgroundMusic: HTMLAudioElement | null = null;
let backgroundMusicVolume = 0.18;
let backgroundMusicFadeTimer: number | null = null;

function getSharedAudioContext(): AudioContext | null {
  try {
    if (sharedAudioContext) return sharedAudioContext;
    const Context = window.AudioContext ?? window.webkitAudioContext;
    if (!Context) return null;
    sharedAudioContext = new Context();
    sharedMasterGain = sharedAudioContext.createGain();
    sharedMasterGain.connect(sharedAudioContext.destination);
    return sharedAudioContext;
  } catch { return null; }
}

function readVolume(key: string, fallback = 55, legacyKey?: string): number {
  const value = Number(localStorage.getItem(key) ?? (legacyKey ? localStorage.getItem(legacyKey) : null) ?? fallback);
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : fallback)) / 100;
}

export function readAudioPreference(key: typeof MASTER_VOLUME_KEY | typeof SFX_VOLUME_KEY | typeof BGM_VOLUME_KEY, fallback = 55): number {
  return Math.round(readVolume(key, fallback, key === SFX_VOLUME_KEY ? LEGACY_SOUND_VOLUME_KEY : undefined) * 100);
}

function masterVolume(): number { return readVolume(MASTER_VOLUME_KEY, 100); }
function sfxVolume(): number { return readVolume(SFX_VOLUME_KEY, 55, LEGACY_SOUND_VOLUME_KEY); }
function bgmVolume(): number { return readVolume(BGM_VOLUME_KEY, 30); }

export function playSound(cue: SoundCue): void {
  try {
    const normalized = canonicalCue(cue);
    if (localStorage.getItem(SOUND_KEY) === "off" || localStorage.getItem(SFX_KEY) === "off" || ((normalized === "countdown_tick" || normalized === "countdown_go") && localStorage.getItem(COUNTDOWN_SOUND_KEY) === "off")) return;
    const context = getSharedAudioContext();
    if (!context || !sharedMasterGain) return;
    const masterGain = sharedMasterGain;
    if (context.state === "suspended") void context.resume().catch(() => undefined);
    const now = context.currentTime;
    frequencies[normalized].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = normalized === "capture" || normalized === "defeat" || normalized === "ui_error" ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      const start = now + index * 0.07;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime((normalized === "low_time_tick" ? 0.025 : 0.04) * masterVolume() * sfxVolume(), start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
      oscillator.connect(gain).connect(masterGain);
      oscillator.start(start); oscillator.stop(start + 0.14);
    });
  } catch { /* Audio is optional and must never block UI. */ }
}

export function notifyAudioPreferenceChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ottv2:audio-preferences"));
}

/** BGM is opt-in and lazy. Missing assets/autoplay restrictions are silent. */
export function setBackgroundMusic(source: string | null, volume = 0.18): void {
  try {
    if (backgroundMusicFadeTimer !== null) window.clearInterval(backgroundMusicFadeTimer);
    if (localStorage.getItem(SOUND_KEY) === "off" || localStorage.getItem(BGM_KEY) === "off" || !source) {
      backgroundMusic?.pause();
      backgroundMusic = null;
      return;
    }
    const targetVolume = Math.max(0, Math.min(1, volume)) * masterVolume() * bgmVolume();
    backgroundMusicVolume = targetVolume;
    const absoluteSource = new URL(source, window.location.href).href;
    if (backgroundMusic?.src === absoluteSource) {
      backgroundMusic.volume = targetVolume;
      void backgroundMusic.play().catch(() => undefined);
      return;
    }
    const previous = backgroundMusic;
    const next = new Audio(source);
    next.loop = true;
    next.preload = "none";
    next.volume = 0;
    backgroundMusic = next;
    void next.play().then(() => {
      const startedAt = performance.now();
      backgroundMusicFadeTimer = window.setInterval(() => {
        const progress = Math.min(1, (performance.now() - startedAt) / 800);
        next.volume = targetVolume * progress;
        if (previous) previous.volume = targetVolume * (1 - progress);
        if (progress >= 1) {
          if (backgroundMusicFadeTimer !== null) window.clearInterval(backgroundMusicFadeTimer);
          backgroundMusicFadeTimer = null;
          previous?.pause();
        }
      }, 40);
    }).catch(() => undefined);
  } catch { /* optional BGM cannot affect gameplay */ }
}

/** Temporarily lower BGM under a result/capture SFX layer. */
export function duckBackgroundMusic(ducked: boolean): void {
  try { if (backgroundMusic) backgroundMusic.volume = ducked ? backgroundMusicVolume * 0.5 : backgroundMusicVolume; }
  catch { /* optional */ }
}

export function stopBackgroundMusic(): void {
  try { if (backgroundMusicFadeTimer !== null) window.clearInterval(backgroundMusicFadeTimer); backgroundMusicFadeTimer = null; backgroundMusic?.pause(); backgroundMusic = null; } catch { /* optional */ }
}

export function disposeSharedAudio(): void {
  try { stopBackgroundMusic(); void sharedAudioContext?.close(); } catch { /* optional */ }
  sharedAudioContext = null;
  sharedMasterGain = null;
}

declare global { interface Window { webkitAudioContext?: typeof AudioContext } }
