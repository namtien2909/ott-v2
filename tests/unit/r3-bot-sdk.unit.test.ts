import { describe, expect, it } from "vitest";
import { BOARD_COORDINATES, createInitialState, getLegalDestinations, rotateCoordinate180, type RuleState } from "@ottv2/game-rules";
import {
  BOT_SDK_VERSION,
  DEFAULT_BOT_LIMITS,
  createBotTurnState,
  digestSource,
  decideLimitWinner,
  isFullRoundBoundary,
  scoreLimitCriteria,
  validateBotSource,
} from "../../packages/bot-sdk/src/index.js";

describe("R3 Bot SDK/scorer harness", () => {
  it("publishes a canonical, JSON-safe turn state with legal moves", () => {
    const state = createInitialState();
    const turn = createBotTurnState(state, "BLUE", [], { BLUE: 30_000, RED: 30_000 });
    expect(turn.sdkVersion).toBe(BOT_SDK_VERSION);
    expect(turn.side).toBe("BLUE");
    expect(turn.board.a1?.side).toBe("BLUE");
    expect(turn.legalMoves).toContainEqual({ from: "a1", to: "b2" });
    expect(JSON.parse(JSON.stringify(turn))).toEqual(turn);
    expect(getLegalDestinations(state, "BLUE", "a1")).toContain("b2");
  });

  it("rejects unsafe or incompatible source before any runtime is invoked", () => {
    expect(validateBotSource("def choose_move(state, memory):\n    return {'from':'a1','to':'b2'}\n")).toMatchObject({ ok: true });
    expect(validateBotSource("import os\ndef choose_move(state, memory):\n    return None\n")).toMatchObject({ ok: false, code: "IMPORT_NOT_ALLOWED" });
    expect(validateBotSource("import js\ndef choose_move(state, memory):\n    return None\n")).toMatchObject({ ok: false, code: "IMPORT_NOT_ALLOWED" });
    expect(validateBotSource("import pyodide_js\ndef choose_move(state, memory):\n    return None\n")).toMatchObject({ ok: false, code: "IMPORT_NOT_ALLOWED" });
    expect(validateBotSource("import builtins\ndef choose_move(state, memory):\n    return None\n")).toMatchObject({ ok: false, code: "IMPORT_NOT_ALLOWED" });
    expect(validateBotSource("import time\ndef choose_move(state, memory):\n    return None\n")).toMatchObject({ ok: false, code: "IMPORT_NOT_ALLOWED" });
    expect(validateBotSource("def choose_move(state, memory):\n    while True: pass\n")).toMatchObject({ ok: false, code: "UNBOUNDED_LOOP" });
    expect(validateBotSource("# def choose_move(state, memory):\nimport math, decimal\ndef choose_move(state, memory):\n    return None\n")).toMatchObject({ ok: false, code: "IMPORT_NOT_ALLOWED" });
    expect(validateBotSource("payload = '''def choose_move(state, memory):'''\ndef choose_move(state, memory):\n    return None\n")).toMatchObject({ ok: true });
    expect(validateBotSource("# while True: pass\ndef choose_move(state, memory):\n    return None\n")).toMatchObject({ ok: true });
    expect(validateBotSource("def choose_move(state, memory):\n    return f'{__import__(\"os\")}'\n")).toMatchObject({ ok: false, code: "UNSUPPORTED_SYNTAX" });
    expect(validateBotSource("def choose_move(state, memory):\n    return state.__getattribute__('x')\n")).toMatchObject({ ok: false, code: "FORBIDDEN_API" });
    expect(validateBotSource("import json\ndef choose_move(state, memory):\n    return json.decoder.JSONDecoder.__closure__\n")).toMatchObject({ ok: false, code: "FORBIDDEN_API" });
    expect(validateBotSource("def choose_move(state, memory):\n    return state.__ｇｅｔａｔｔｒｉｂｕｔｅ__('x')\n")).toMatchObject({ ok: false, code: "FORBIDDEN_API" });
    expect(validateBotSource("import json\ndef choose_move(state, memory):\n    return json.decoder.JSONDecoder.__ｃｌｏｓｕｒｅ__\n")).toMatchObject({ ok: false, code: "FORBIDDEN_API" });
  });

  it("records a cryptographic source digest without executing the source", async () => {
    const digest = await digestSource("def choose_move(state, memory):\n    return None\n");
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("computes lexicographic N/P/M and RED exact-tie priority", () => {
    const state = createInitialState();
    const blue = scoreLimitCriteria(state, "BLUE");
    const red = scoreLimitCriteria(state, "RED");
    expect(blue.N).toBe(9);
    expect(red.N).toBe(9);
    expect(blue.P).toBe(0);
    expect(red.P).toBe(0);
    expect(blue.M).toBeGreaterThan(0);
    expect(red.M).toBeGreaterThan(0);
    expect(decideLimitWinner(blue, blue)).toMatchObject({ winner: "RED", reason: "LIMIT_EXACT_TIE" });
  });

  it("freezes equal visible limits in a versioned manifest", () => {
    expect(DEFAULT_BOT_LIMITS.sdkVersion).toBe(BOT_SDK_VERSION);
    expect(DEFAULT_BOT_LIMITS.sourceBytes).toBeGreaterThan(0);
    expect(DEFAULT_BOT_LIMITS.perTurnMs).toBeGreaterThan(0);
    expect(DEFAULT_BOT_LIMITS.wholeMatchMs).toBeGreaterThan(DEFAULT_BOT_LIMITS.perTurnMs);
    expect(DEFAULT_BOT_LIMITS.wasmStartupFuel).toBeGreaterThan(DEFAULT_BOT_LIMITS.wasmFuel);
    expect(DEFAULT_BOT_LIMITS.network).toBe(false);
  });

  it("keeps the finite-limit boundary and criterion ordering explicit", () => {
    expect(isFullRoundBoundary("BLUE", 2)).toBe(true);
    expect(isFullRoundBoundary("RED", 1)).toBe(false);
    expect(decideLimitWinner({ N: 10, P: 0, M: 0 }, { N: 9, P: 99, M: 99 }).winner).toBe("BLUE");
    expect(decideLimitWinner({ N: 9, P: 5, M: 0 }, { N: 9, P: 4, M: 99 }).winner).toBe("BLUE");
    expect(decideLimitWinner({ N: 9, P: 5, M: 2 }, { N: 9, P: 5, M: 3 }).winner).toBe("RED");
  });

  it("covers mirrored sides, goal progress and extinction-count fixtures", () => {
    const state = createInitialState();
    const mirroredBoard = Object.fromEntries(BOARD_COORDINATES.map((coordinate) => [coordinate, null])) as RuleState["board"];
    for (const coordinate of BOARD_COORDINATES) {
      const piece = state.board[coordinate];
      if (piece) mirroredBoard[rotateCoordinate180(coordinate)] = { ...piece, side: piece.side === "BLUE" ? "RED" : "BLUE" };
    }
    const mirrored: RuleState = { ...state, board: mirroredBoard, currentTurn: "RED" };
    expect(scoreLimitCriteria(state, "BLUE")).toEqual(scoreLimitCriteria(mirrored, "RED"));
    const nearGoal: RuleState = { ...state, board: { ...state.board, i8: { id: "blue-near-goal", side: "BLUE", type: "R" } } };
    expect(scoreLimitCriteria(nearGoal, "BLUE").P).toBe(7);
    expect(scoreLimitCriteria({ ...state, pieceCounts: { ...state.pieceCounts, RED: { R: 0, P: 0, S: 0 } } }, "RED").N).toBe(0);
  });
});
