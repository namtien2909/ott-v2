import { describe, expect, it } from "vitest";
import {
  applyMove,
  BOARD_COORDINATES,
  createInitialState,
  getLegalDestinations,
  rotateCoordinate180,
  type Coordinate,
  type Piece,
  type PieceType,
  type RuleState,
  type Side,
} from "@ottv2/game-rules";

type FixturePiece = readonly [Coordinate, Side, PieceType];

function stateWith(...pieces: FixturePiece[]): RuleState {
  const board = Object.fromEntries(BOARD_COORDINATES.map((coordinate) => [coordinate, null])) as Record<Coordinate, Piece | null>;
  const pieceCounts = {
    BLUE: { R: 0, P: 0, S: 0 },
    RED: { R: 0, P: 0, S: 0 },
  } as Record<Side, Record<PieceType, number>>;

  const ordinals: Record<Side, Record<PieceType, number>> = {
    BLUE: { R: 0, P: 0, S: 0 },
    RED: { R: 0, P: 0, S: 0 },
  };
  for (const [coordinate, side, type] of pieces) {
    ordinals[side][type] += 1;
    const piece = { id: `${side.toLowerCase()}-${type.toLowerCase()}-${ordinals[side][type]}`, side, type } as const;
    board[coordinate] = piece;
    pieceCounts[side][type] += 1;
  }

  return {
    board,
    pieceCounts,
    currentTurn: "BLUE",
    status: "PLAYING",
    winner: null,
    resultReason: null,
  };
}

function withTurn(state: RuleState, currentTurn: Side): RuleState {
  return { ...state, currentTurn };
}

function expectAccepted(state: RuleState, command: { side: Side; from: Coordinate; to: Coordinate }) {
  const result = applyMove(state, command);
  expect(result.kind).toBe("accepted");
  if (result.kind !== "accepted") throw new Error(`Expected accepted move, got ${result.error.code}`);
  return result;
}

function expectRejected(state: RuleState, command: { side: Side; from: Coordinate; to: Coordinate }, code: string) {
  const result = applyMove(state, command);
  expect(result).toMatchObject({ kind: "rejected", error: { code } });
  expect(result.state).toBe(state);
  return result;
}

describe("OTTv2 W1 game rules", () => {
  it("creates the exact 9x9 setup with BLUE to move", () => {
    const state = createInitialState();
    const pieces = Object.values(state.board).filter((piece): piece is Piece => piece !== null);
    expect(BOARD_COORDINATES).toHaveLength(81);
    expect(pieces).toHaveLength(18);
    expect(state.board.a1).toMatchObject({ id: "blue-s-3", side: "BLUE", type: "S" });
    expect(state.board.i9).toMatchObject({ id: "red-s-3", side: "RED", type: "S" });
    expect(state.board.a2).toBeNull();
    expect(state.board.i8).toBeNull();
    expect(state.pieceCounts).toEqual({
      BLUE: { R: 3, P: 3, S: 3 },
      RED: { R: 3, P: 3, S: 3 },
    });
    expect(state.currentTurn).toBe("BLUE");
    expect(state.board.b1).toMatchObject({ id: "blue-r-1", side: "BLUE", type: "R" });
    expect(state.board.i9).toMatchObject({ id: "red-s-3", side: "RED", type: "S" });
  });

  it("keeps setup deterministic and exposes the 180 degree coordinate mapping", () => {
    expect(createInitialState()).toEqual(createInitialState());
    expect(rotateCoordinate180("a1")).toBe("i9");
    expect(rotateCoordinate180("i9")).toBe("a1");
    expect(rotateCoordinate180("a9")).toBe("i1");
    expect(rotateCoordinate180("e5")).toBe("e5");
  });

  it("accepts every in-bounds one-step direction from the center", () => {
    const state = stateWith(["e5", "BLUE", "R"]);
    expect(getLegalDestinations(state, "BLUE", "e5")).toEqual([
      "d4", "e4", "f4", "d5", "f5", "d6", "e6", "f6",
    ]);
  });

  it("limits corner movement to in-bounds adjacent squares", () => {
    expect(getLegalDestinations(stateWith(["a1", "BLUE", "R"]), "BLUE", "a1")).toEqual(["b1", "a2", "b2"]);
    expect(getLegalDestinations(stateWith(["i9", "BLUE", "R"]), "BLUE", "i9")).toEqual(["h8", "i8", "h9"]);
  });

  it("rejects invalid distance, empty source, ownership, turn and bounds", () => {
    const state = stateWith(["e5", "BLUE", "R"], ["a1", "RED", "S"]);
    expectRejected(state, { side: "BLUE", from: "e5", to: "e5" }, "NOT_ONE_STEP");
    expectRejected(state, { side: "BLUE", from: "e5", to: "g5" }, "NOT_ONE_STEP");
    expectRejected(state, { side: "BLUE", from: "e5", to: "z9" as Coordinate }, "OUT_OF_BOUNDS");
    expectRejected(state, { side: "BLUE", from: "d4", to: "d5" }, "NO_PIECE");
    expectRejected(state, { side: "RED", from: "e5", to: "e6" }, "WRONG_TURN");
    expectRejected(state, { side: "BLUE", from: "a1", to: "a2" }, "NOT_OWNER");
  });

  it("rejects friendly blocks", () => {
    expectRejected(
      stateWith(["e5", "BLUE", "R"], ["f6", "BLUE", "P"]),
      { side: "BLUE", from: "e5", to: "f6" },
      "FRIENDLY_BLOCK",
    );
  });

  it.each(["R", "P", "S"] as const)("rejects same-type %s blocks", (type) => {
    expectRejected(
      stateWith(["e5", "BLUE", type], ["f6", "RED", type]),
      { side: "BLUE", from: "e5", to: "f6" },
      "SAME_TYPE_BLOCK",
    );
  });

  it.each([
    ["R", "P"],
    ["P", "S"],
    ["S", "R"],
  ] as const)("rejects losing %s against %s", (attacker, defender) => {
    expectRejected(
      stateWith(["e5", "BLUE", attacker], ["f6", "RED", defender]),
      { side: "BLUE", from: "e5", to: "f6" },
      "LOSING_ATTACKER",
    );
  });

  it.each([
    ["R", "S"],
    ["P", "R"],
    ["S", "P"],
  ] as const)("applies the %s captures %s relation", (attacker, defender) => {
    const state = stateWith(["e5", "BLUE", attacker], ["f6", "RED", defender]);
    const result = expectAccepted(state, { side: "BLUE", from: "e5", to: "f6" });
    expect(result.move.capturedPieceId).toBe(`red-${defender.toLowerCase()}-1`);
    expect(result.state.board.e5).toBeNull();
    expect(result.state.board.f6).toMatchObject({ side: "BLUE", type: attacker });
    expect(result.state.pieceCounts.RED[defender]).toBe(0);
  });

  it("applies the capture matrix for RED as well as BLUE", () => {
    const result = expectAccepted(
      withTurn(stateWith(["e5", "RED", "R"], ["f6", "BLUE", "S"]), "RED"),
      { side: "RED", from: "e5", to: "f6" },
    );
    expect(result.state.board.f6).toMatchObject({ side: "RED", type: "R" });
    expect(result.state.pieceCounts.BLUE.S).toBe(0);
  });

  it("switches turn only after a non-terminal accepted move", () => {
    const result = expectAccepted(createInitialState(), { side: "BLUE", from: "b1", to: "b2" });
    expect(result.state.currentTurn).toBe("RED");
    expectRejected(result.state, { side: "BLUE", from: "c1", to: "c2" }, "WRONG_TURN");
  });

  it.each([
    ["S", "BLUE", "EXTINCTION"],
    ["P", "BLUE", "EXTINCTION"],
    ["R", "BLUE", "EXTINCTION"],
  ] as const)("reports BLUE extinction when the final RED %s is captured", (defender, winner, reason) => {
    const state = stateWith(["e5", "BLUE", defender === "S" ? "R" : defender === "R" ? "P" : "S"], ["f6", "RED", defender]);
    const result = expectAccepted(state, { side: "BLUE", from: "e5", to: "f6" });
    expect(result.state).toMatchObject({ status: "FINISHED", winner, resultReason: reason, currentTurn: null });
  });

  it.each([
    ["S", "RED"],
    ["P", "RED"],
    ["R", "RED"],
  ] as const)("reports RED extinction when the final BLUE %s is captured", (defender, winner) => {
    const attacker = defender === "S" ? "R" : defender === "R" ? "P" : "S";
    const state = withTurn(stateWith(["e5", "RED", attacker], ["f6", "BLUE", defender]), "RED");
    const result = expectAccepted(state, { side: "RED", from: "e5", to: "f6" });
    expect(result.state).toMatchObject({ status: "FINISHED", winner, resultReason: "EXTINCTION", currentTurn: null });
  });

  it("reports both goal wins and rejects the wrong goal square", () => {
    const blueGoal = expectAccepted(
      stateWith(
        ["h8", "BLUE", "R"], ["a2", "BLUE", "P"], ["b2", "BLUE", "S"],
        ["a9", "RED", "S"], ["b9", "RED", "R"], ["c9", "RED", "P"],
      ),
      { side: "BLUE", from: "h8", to: "i9" },
    );
    expect(blueGoal.state).toMatchObject({ winner: "BLUE", resultReason: "GOAL_REACHED", status: "FINISHED" });

    const redGoal = expectAccepted(
      withTurn(
        stateWith(
          ["b2", "RED", "R"], ["h8", "RED", "P"], ["g8", "RED", "S"],
          ["i1", "BLUE", "S"], ["h1", "BLUE", "R"], ["g1", "BLUE", "P"],
        ),
        "RED",
      ),
      { side: "RED", from: "b2", to: "a1" },
    );
    expect(redGoal.state).toMatchObject({ winner: "RED", resultReason: "GOAL_REACHED", status: "FINISHED" });

    const wrongBlueGoal = expectAccepted(
      stateWith(
        ["b2", "BLUE", "R"], ["a2", "BLUE", "P"], ["b1", "BLUE", "S"],
        ["i1", "RED", "S"], ["h1", "RED", "R"], ["g1", "RED", "P"],
      ),
      { side: "BLUE", from: "b2", to: "a1" },
    );
    expect(wrongBlueGoal.state.winner).toBeNull();
    expect(wrongBlueGoal.state.status).toBe("PLAYING");

    const wrongRedGoal = expectAccepted(
      withTurn(
        stateWith(
          ["h8", "RED", "R"], ["g8", "RED", "P"], ["f8", "RED", "S"],
          ["i1", "BLUE", "S"], ["h1", "BLUE", "R"], ["g1", "BLUE", "P"],
        ),
        "RED",
      ),
      { side: "RED", from: "h8", to: "i9" },
    );
    expect(wrongRedGoal.state.winner).toBeNull();
    expect(wrongRedGoal.state.status).toBe("PLAYING");
  });

  it("rejects moves after a terminal result", () => {
    const finished = expectAccepted(stateWith(["h8", "BLUE", "R"], ["a9", "RED", "S"]), { side: "BLUE", from: "h8", to: "i9" }).state;
    expectRejected(finished, { side: "BLUE", from: "i9", to: "i8" }, "GAME_OVER");
  });

  it("does not mutate input state and creates independent initial states", () => {
    const state = createInitialState();
    const before = structuredClone(state);
    const result = applyMove(state, { side: "BLUE", from: "b1", to: "b2" });
    expect(state).toEqual(before);
    expect(result.state).not.toBe(state);

    const first = createInitialState();
    const second = createInitialState();
    (first.board as Record<Coordinate, Piece | null>).b1 = null;
    expect(second.board.b1).not.toBeNull();
  });
});
