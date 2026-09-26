export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h", "i"] as const;
export type File = typeof FILES[number];

export const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type Rank = typeof RANKS[number];

export type Coordinate = `${File}${Rank}`;
export type Side = "BLUE" | "RED";
export type PieceType = "R" | "P" | "S";
export type RuleStatus = "PLAYING" | "FINISHED";
export type ResultReason = "EXTINCTION" | "GOAL_REACHED" | null;

export type Piece = Readonly<{
  id: string;
  side: Side;
  type: PieceType;
}>;

export type Board = Readonly<Record<Coordinate, Piece | null>>;
export type SidePieceCounts = Readonly<Record<PieceType, number>>;
export type PieceCounts = Readonly<Record<Side, SidePieceCounts>>;

export type RuleState = Readonly<{
  board: Board;
  pieceCounts: PieceCounts;
  currentTurn: Side | null;
  status: RuleStatus;
  winner: Side | null;
  resultReason: ResultReason;
}>;

export type MoveCommand = Readonly<{
  side: Side;
  from: Coordinate;
  to: Coordinate;
}>;

export type MoveRejectionCode =
  | "OUT_OF_BOUNDS"
  | "NOT_ONE_STEP"
  | "NO_PIECE"
  | "NOT_OWNER"
  | "WRONG_TURN"
  | "GAME_OVER"
  | "FRIENDLY_BLOCK"
  | "SAME_TYPE_BLOCK"
  | "LOSING_ATTACKER";

export type MoveError = Readonly<{
  code: MoveRejectionCode;
}>;

export type MoveSummary = Readonly<{
  pieceId: string;
  side: Side;
  from: Coordinate;
  to: Coordinate;
  capturedPieceId: string | null;
}>;

export type MoveResult =
  | Readonly<{
      kind: "accepted";
      state: RuleState;
      move: MoveSummary;
    }>
  | Readonly<{
      kind: "rejected";
      state: RuleState;
      error: MoveError;
    }>;
