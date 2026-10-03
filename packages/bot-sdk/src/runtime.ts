import type { BotInvocationRequest, BotInvocationResult } from "./types.js";
import { DEFAULT_BOT_LIMITS, type BotLimitManifest } from "./manifest.js";
import { utf8ByteLength, validateBotSource, type SourceValidation } from "./source-validation.js";

export type RuntimeSecurityProfile = Readonly<{
  isolation: "WASMTIME_SUPERVISOR" | "PYODIDE_MODULE_WORKER";
  sourceParser: "ISOLATED_PARSER";
  network: false;
  filesystem: false;
  secrets: false;
  applicationMounts: false;
}>;

export type IsolatedRuntimeAdapter = Readonly<{
  profile: RuntimeSecurityProfile;
  execute(request: BotInvocationRequest, signal: RuntimeAbortSignal): Promise<BotInvocationResult>;
}>;

export type RuntimeAbortSignal = Readonly<{ aborted: boolean }>;

export type RuntimePreflight = Readonly<{
  source: SourceValidation;
  ready: boolean;
  runtime: "NOT_PROVEN" | "TEST_ADAPTER_ONLY";
  limits: BotLimitManifest;
}>;

export class RuntimeNotProvenError extends Error {
  constructor() {
    super("Chưa có runtime cô lập đã được kiểm chứng cho Bot.");
    this.name = "RuntimeNotProvenError";
  }
}

export class BotOutputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BotOutputValidationError";
  }
}

export class RuntimeCancelledError extends Error {
  constructor() {
    super("Bot invocation was cancelled before commit.");
    this.name = "RuntimeCancelledError";
  }
}

function isJsonValue(value: unknown, depth: number, maxDepth: number, seen = new WeakSet<object>()): value is BotInvocationResult["memory"] {
  if (depth > maxDepth) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "object") {
    if (seen.has(value) || Object.prototype.toString.call(value) !== "[object Object]" && !Array.isArray(value)) return false;
    seen.add(value);
    const valid = Array.isArray(value)
      ? value.every((item) => isJsonValue(item, depth + 1, maxDepth, seen))
      : Object.values(value).every((item) => isJsonValue(item, depth + 1, maxDepth, seen));
    seen.delete(value);
    return valid;
  }
  return false;
}

function validateOutput(request: BotInvocationRequest, result: unknown, limits: BotLimitManifest): asserts result is BotInvocationResult {
  if (!result || typeof result !== "object" || !("move" in result) || !("memory" in result)) throw new BotOutputValidationError("Bot trả về payload không hợp lệ.");
  const candidate = result as BotInvocationResult;
  if (!candidate.move || typeof candidate.move.from !== "string" || typeof candidate.move.to !== "string") throw new BotOutputValidationError("Bot trả về move không hợp lệ.");
  if (!request.state.legalMoves.some((move) => move.from === candidate.move.from && move.to === candidate.move.to)) throw new BotOutputValidationError("Bot trả về nước đi không hợp lệ.");
  if (!isJsonValue(candidate.memory, 0, limits.memoryDepth)) throw new BotOutputValidationError("Bot trả về memory không phải JSON hữu hạn.");
  let memoryJson: string;
  let outputJson: string;
  try {
    memoryJson = JSON.stringify(candidate.memory);
    outputJson = JSON.stringify(candidate);
  } catch {
    throw new BotOutputValidationError("Bot trả về JSON không thể serialize.");
  }
  const memoryBytes = utf8ByteLength(memoryJson);
  const outputBytes = utf8ByteLength(outputJson);
  if (memoryBytes > limits.memoryBytes) throw new BotOutputValidationError("Bot vượt giới hạn memory.");
  if (outputBytes > limits.outputBytes) throw new BotOutputValidationError("Bot vượt giới hạn output.");
}

function assertProfile(profile: RuntimeSecurityProfile): void {
  if (
    (profile.isolation !== "WASMTIME_SUPERVISOR" && profile.isolation !== "PYODIDE_MODULE_WORKER")
    || profile.sourceParser !== "ISOLATED_PARSER"
    || profile.network !== false
    || profile.filesystem !== false
    || profile.secrets !== false
    || profile.applicationMounts !== false
  ) throw new Error("Runtime security profile is unsafe or not proven.");
}

export function createIsolatedRuntimeHarness(adapter?: IsolatedRuntimeAdapter, limits: BotLimitManifest = DEFAULT_BOT_LIMITS) {
  if (adapter) assertProfile(adapter.profile);
  return {
    limits,
    preflight(source: string): RuntimePreflight {
      const validation = validateBotSource(source);
      return { source: validation, ready: false, runtime: adapter ? "TEST_ADAPTER_ONLY" : "NOT_PROVEN", limits };
    },
    async runTurn(request: BotInvocationRequest, signal: RuntimeAbortSignal): Promise<BotInvocationResult> {
      const validation = validateBotSource(request.source);
      if (!validation.ok) throw new Error(validation.message);
      if (!adapter) throw new RuntimeNotProvenError();
      if (signal.aborted) throw new RuntimeCancelledError();
      const result = await adapter.execute(request, signal);
      if (signal.aborted) throw new RuntimeCancelledError();
      validateOutput(request, result, limits);
      return result;
    },
  };
}
