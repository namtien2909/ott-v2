import {
  BOARD_COORDINATES,
  coordinateToPosition,
  GOAL_COORDINATES,
  getLegalDestinations,
  type RuleState,
  type Side,
} from "@ottv2/game-rules";

export type LimitCriteria = Readonly<{ N: number; P: number; M: number }>;
export type LimitWinnerReason = "LIMIT_CRITERIA" | "LIMIT_EXACT_TIE";
export type LimitDecision = Readonly<{ winner: Side; reason: LimitWinnerReason; BLUE: LimitCriteria; RED: LimitCriteria }>;

function pieceCount(state: RuleState, side: Side): number {
  return state.pieceCounts[side].R + state.pieceCounts[side].P + state.pieceCounts[side].S;
}

function positionDistance(left: string, right: string): number {
  const a = coordinateToPosition(left as Parameters<typeof coordinateToPosition>[0]);
  const b = coordinateToPosition(right as Parameters<typeof coordinateToPosition>[0]);
  return Math.max(Math.abs(a.fileIndex - b.fileIndex), Math.abs(a.rankIndex - b.rankIndex));
}

function progressScore(state: RuleState, side: Side): number {
  const goal = GOAL_COORDINATES[side];
  const distances = BOARD_COORDINATES.flatMap((coordinate) => {
    const piece = state.board[coordinate];
    return piece?.side === side ? [positionDistance(coordinate, goal)] : [];
  });
  return distances.length === 0 ? 0 : 8 - Math.min(...distances);
}

function mobilityScore(state: RuleState, side: Side): number {
  if (state.status === "FINISHED") return 0;
  const effectiveState: RuleState = state.currentTurn === side
    ? state
    : { ...state, currentTurn: side };
  return BOARD_COORDINATES.reduce((total, from) => total + getLegalDestinations(effectiveState, side, from).length, 0);
}

export function scoreLimitCriteria(state: RuleState, side: Side): LimitCriteria {
  return { N: pieceCount(state, side), P: progressScore(state, side), M: mobilityScore(state, side) };
}

export function compareLimitCriteria(left: LimitCriteria, right: LimitCriteria): -1 | 0 | 1 {
  for (const key of ["N", "P", "M"] as const) {
    if (left[key] > right[key]) return 1;
    if (left[key] < right[key]) return -1;
  }
  return 0;
}

export function decideLimitWinner(blue: LimitCriteria, red: LimitCriteria): LimitDecision {
  const comparison = compareLimitCriteria(blue, red);
  return comparison > 0
    ? { winner: "BLUE", reason: "LIMIT_CRITERIA", BLUE: blue, RED: red }
    : comparison < 0
      ? { winner: "RED", reason: "LIMIT_CRITERIA", BLUE: blue, RED: red }
      : { winner: "RED", reason: "LIMIT_EXACT_TIE", BLUE: blue, RED: red };
}

/** A finite Bot limit is evaluated only after both sides have completed a turn. */
export function isFullRoundBoundary(currentTurn: Side | null, completedTurns: number): boolean {
  return currentTurn === "BLUE" && completedTurns > 0;
}
