import { BOT_SDK_VERSION } from "./version.js";

/**
 * The checked-in equal-budget preset. Runtime probes are feasibility evidence;
 * production adapters must still enforce these limits at their own boundary.
 */
export const DEFAULT_BOT_LIMITS = Object.freeze({
  manifestVersion: "r3-2026-10-03",
  sdkVersion: BOT_SDK_VERSION,
  schemaVersion: "1",
  sourceBytes: 64 * 1024,
  memoryBytes: 8 * 1024,
  memoryDepth: 32,
  outputBytes: 16 * 1024,
  outputIncludesMemory: true,
  privateLogBytes: 16 * 1024,
  uploadBytes: 64 * 1024,
  preflightMs: 250,
  perTurnMs: 500,
  wholeMatchMs: 30_000,
  maxTurns: 120,
  maxPlies: 120,
  maxRounds: 60,
  wholeMatchClockMode: "ACTIVE_COMPUTE",
  // CPython-WASI bootstrap is host/runtime overhead, not player-turn fuel.
  // The per-turn budget below remains the equal budget for Bot code.
  wasmStartupFuel: 2_000_000_000,
  wasmFuel: 300_000_000,
  wasmEpochTicks: 500,
  wasmMemoryPages: 1024,
  wasmStackBytes: 1 * 1024 * 1024,
  ioBytes: 0,
  network: false,
  filesystem: false,
  secrets: false,
  applicationMounts: false,
  deterministicSeed: true,
  admission: "single",
} as const);

export type BotLimitManifest = typeof DEFAULT_BOT_LIMITS;
