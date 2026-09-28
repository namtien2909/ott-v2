import { BOARD_COORDINATES } from "./coordinates.js";
import type { Board, Piece, PieceCounts, PieceType, RuleState, Side } from "./types.js";

type SetupEntry = readonly [coordinate: string, type: PieceType];

const BLUE_SETUP: readonly SetupEntry[] = [
  ["b1", "R"], ["c1", "P"], ["d1", "S"],
  ["e1", "R"], ["f1", "P"], ["g1", "S"],
  ["h1", "R"], ["i1", "P"], ["a1", "S"],
];

const RED_SETUP: readonly SetupEntry[] = [
  ["a9", "P"], ["b9", "R"], ["c9", "S"],
  ["d9", "P"], ["e9", "R"], ["f9", "S"],
  ["g9", "P"], ["h9", "R"], ["i9", "S"],
];

function emptyBoard(): Record<string, Piece | null> {
  return Object.fromEntries(BOARD_COORDINATES.map((coordinate) => [coordinate, null]));
}

function emptyCounts(): Record<Side, Record<PieceType, number>> {
  return {
    BLUE: { R: 3, P: 3, S: 3 },
    RED: { R: 3, P: 3, S: 3 },
  };
}

function placeSetup(board: Record<string, Piece | null>, side: Side, setup: readonly SetupEntry[]): void {
  const ordinals: Record<PieceType, number> = { R: 0, P: 0, S: 0 };
  for (const [coordinate, type] of setup) {
    ordinals[type] += 1;
    board[coordinate] = { id: `${side.toLowerCase()}-${type.toLowerCase()}-${ordinals[type]}`, side, type };
  }
}

export function createInitialState(): RuleState {
  const board = emptyBoard();
  placeSetup(board, "BLUE", BLUE_SETUP);
  placeSetup(board, "RED", RED_SETUP);
  const pieceCounts = emptyCounts();
  return {
    board: board as Board,
    pieceCounts: pieceCounts as PieceCounts,
    currentTurn: "BLUE",
    status: "PLAYING",
    winner: null,
    resultReason: null,
  };
}
