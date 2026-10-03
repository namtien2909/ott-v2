import { describe, expect, it } from "vitest";
import { BotOutputValidationError, createIsolatedRuntimeHarness, RuntimeCancelledError, RuntimeNotProvenError, type RuntimeSecurityProfile } from "../../packages/bot-sdk/src/index.js";

const validSource = "def choose_move(state, memory):\n    return {'from': 'a1', 'to': 'b2'}\n";

describe("R3 isolated runtime gate", () => {
  it("does not execute source while no isolated adapter is proven", async () => {
    const harness = createIsolatedRuntimeHarness();
    expect(harness.preflight(validSource)).toMatchObject({ ready: false, runtime: "NOT_PROVEN", source: { ok: true } });
    await expect(harness.runTurn({ source: validSource, state: {} as never, memory: null, seed: 1 }, new AbortController().signal)).rejects.toBeInstanceOf(RuntimeNotProvenError);
  });

  it("rejects an adapter that grants network, filesystem, secrets or app mounts", () => {
    const unsafe = { isolation: "WASMTIME_SUPERVISOR", sourceParser: "ISOLATED_PARSER", network: true, filesystem: false, secrets: false, applicationMounts: false } as unknown as RuntimeSecurityProfile;
    expect(() => createIsolatedRuntimeHarness({ profile: unsafe, execute: async () => ({ move: { from: "a1", to: "b2" }, memory: null }) })).toThrow("security profile");
    const missing = { isolation: "NATIVE_PYTHON", sourceParser: "ISOLATED_PARSER", network: undefined, filesystem: false, secrets: false, applicationMounts: false } as unknown as RuntimeSecurityProfile;
    expect(() => createIsolatedRuntimeHarness({ profile: missing, execute: async () => ({ move: { from: "a1", to: "b2" }, memory: null }) })).toThrow("security profile");
  });

  it("fails source preflight before an adapter can receive invalid code", async () => {
    let invoked = false;
    const harness = createIsolatedRuntimeHarness({
      profile: { isolation: "WASMTIME_SUPERVISOR", sourceParser: "ISOLATED_PARSER", network: false, filesystem: false, secrets: false, applicationMounts: false },
      execute: async () => { invoked = true; return { move: { from: "a1", to: "b2" }, memory: null }; },
    });
    await expect(harness.runTurn({ source: "import os\ndef choose_move(state, memory):\n    return None\n", state: {} as never, memory: null, seed: 1 }, new AbortController().signal)).rejects.toThrow();
    expect(invoked).toBe(false);
  });

  it("never advertises production Ready from a test adapter", () => {
    const harness = createIsolatedRuntimeHarness({
      profile: { isolation: "WASMTIME_SUPERVISOR", sourceParser: "ISOLATED_PARSER", network: false, filesystem: false, secrets: false, applicationMounts: false },
      execute: async () => ({ move: { from: "a1", to: "b2" }, memory: null }),
    });
    expect(harness.preflight(validSource)).toMatchObject({ ready: false, runtime: "TEST_ADAPTER_ONLY" });
  });

  it("validates adapter output against legal moves and bounded JSON memory", async () => {
    const harness = createIsolatedRuntimeHarness({
      profile: { isolation: "WASMTIME_SUPERVISOR", sourceParser: "ISOLATED_PARSER", network: false, filesystem: false, secrets: false, applicationMounts: false },
      execute: async () => ({ move: { from: "a1", to: "a1" }, memory: null }),
    });
    await expect(harness.runTurn({ source: validSource, state: { legalMoves: [{ from: "a1", to: "b2" }] } as never, memory: null, seed: 1 }, new AbortController().signal)).rejects.toBeInstanceOf(BotOutputValidationError);
  });

  it("rejects memory deeper than the manifest and non-finite values", async () => {
    const harness = createIsolatedRuntimeHarness({
      profile: { isolation: "WASMTIME_SUPERVISOR", sourceParser: "ISOLATED_PARSER", network: false, filesystem: false, secrets: false, applicationMounts: false },
      execute: async () => ({ move: { from: "a1", to: "b2" }, memory: { nested: { value: Number.NaN } } }),
    });
    await expect(harness.runTurn({ source: validSource, state: { legalMoves: [{ from: "a1", to: "b2" }] } as never, memory: null, seed: 1 }, new AbortController().signal)).rejects.toBeInstanceOf(BotOutputValidationError);
  });

  it("rejects memory and output that exceed the frozen byte budgets", async () => {
    const oversizedMemory = "x".repeat(9000);
    const memoryHarness = createIsolatedRuntimeHarness({
      profile: { isolation: "WASMTIME_SUPERVISOR", sourceParser: "ISOLATED_PARSER", network: false, filesystem: false, secrets: false, applicationMounts: false },
      execute: async () => ({ move: { from: "a1", to: "b2" }, memory: oversizedMemory }),
    });
    await expect(memoryHarness.runTurn({ source: validSource, state: { legalMoves: [{ from: "a1", to: "b2" }] } as never, memory: null, seed: 1 }, new AbortController().signal)).rejects.toBeInstanceOf(BotOutputValidationError);

    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    const cycleHarness = createIsolatedRuntimeHarness({
      profile: { isolation: "WASMTIME_SUPERVISOR", sourceParser: "ISOLATED_PARSER", network: false, filesystem: false, secrets: false, applicationMounts: false },
      execute: async () => ({ move: { from: "a1", to: "b2" }, memory: cyclic }),
    });
    await expect(cycleHarness.runTurn({ source: validSource, state: { legalMoves: [{ from: "a1", to: "b2" }] } as never, memory: null, seed: 1 }, new AbortController().signal)).rejects.toBeInstanceOf(BotOutputValidationError);

    const outputHarness = createIsolatedRuntimeHarness({
      profile: { isolation: "WASMTIME_SUPERVISOR", sourceParser: "ISOLATED_PARSER", network: false, filesystem: false, secrets: false, applicationMounts: false },
      execute: async () => ({ move: { from: "a1", to: "b2" }, memory: null, diagnostic: "x".repeat(17000) } as never),
    });
    await expect(outputHarness.runTurn({ source: validSource, state: { legalMoves: [{ from: "a1", to: "b2" }] } as never, memory: null, seed: 1 }, new AbortController().signal)).rejects.toBeInstanceOf(BotOutputValidationError);
  });

  it("rejects a 33-level memory chain while allowing the 32-level boundary", async () => {
    const chain = (levels: number) => { let value: unknown = null; for (let index = 0; index < levels; index += 1) value = { nested: value }; return value; };
    const valid = createIsolatedRuntimeHarness({
      profile: { isolation: "WASMTIME_SUPERVISOR", sourceParser: "ISOLATED_PARSER", network: false, filesystem: false, secrets: false, applicationMounts: false },
      execute: async () => ({ move: { from: "a1", to: "b2" }, memory: chain(32) as never }),
    });
    await expect(valid.runTurn({ source: validSource, state: { legalMoves: [{ from: "a1", to: "b2" }] } as never, memory: null, seed: 1 }, new AbortController().signal)).resolves.toBeTruthy();
    const invalid = createIsolatedRuntimeHarness({
      profile: { isolation: "WASMTIME_SUPERVISOR", sourceParser: "ISOLATED_PARSER", network: false, filesystem: false, secrets: false, applicationMounts: false },
      execute: async () => ({ move: { from: "a1", to: "b2" }, memory: chain(33) as never }),
    });
    await expect(invalid.runTurn({ source: validSource, state: { legalMoves: [{ from: "a1", to: "b2" }] } as never, memory: null, seed: 1 }, new AbortController().signal)).rejects.toBeInstanceOf(BotOutputValidationError);
  });

  it("does not commit a result when cancellation is already requested", async () => {
    const controller = new AbortController();
    controller.abort();
    const harness = createIsolatedRuntimeHarness({
      profile: { isolation: "WASMTIME_SUPERVISOR", sourceParser: "ISOLATED_PARSER", network: false, filesystem: false, secrets: false, applicationMounts: false },
      execute: async () => ({ move: { from: "a1", to: "b2" }, memory: null }),
    });
    await expect(harness.runTurn({ source: validSource, state: { legalMoves: [{ from: "a1", to: "b2" }] } as never, memory: null, seed: 1 }, controller.signal)).rejects.toBeInstanceOf(RuntimeCancelledError);
  });

  it("fences a result that arrives after the adapter is cancelled", async () => {
    const controller = new AbortController();
    const harness = createIsolatedRuntimeHarness({
      profile: { isolation: "WASMTIME_SUPERVISOR", sourceParser: "ISOLATED_PARSER", network: false, filesystem: false, secrets: false, applicationMounts: false },
      execute: async () => {
        controller.abort();
        return { move: { from: "a1", to: "b2" }, memory: null };
      },
    });
    await expect(harness.runTurn({ source: validSource, state: { legalMoves: [{ from: "a1", to: "b2" }] } as never, memory: null, seed: 1 }, controller.signal)).rejects.toBeInstanceOf(RuntimeCancelledError);
  });
});
