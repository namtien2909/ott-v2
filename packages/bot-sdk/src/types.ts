import type { Board, Coordinate, PieceType, Side } from "@ottv2/game-rules";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type BotMove = Readonly<{ from: Coordinate; to: Coordinate }>;

export type BotMoveRecord = Readonly<{
  side: Side;
  from: Coordinate;
  to: Coordinate;
  captured: PieceType | null;
}>;

/** Public state passed to choose_move(state, memory). No opponent memory/logs. */
export type BotTurnState = Readonly<{
  sdkVersion: string;
  schemaVersion: string;
  side: Side;
  board: Board;
  legalMoves: readonly BotMove[];
  turnNumber: number;
  clocksMs: Readonly<{ BLUE: number; RED: number }>;
  history: readonly BotMoveRecord[];
}>;

export type BotInvocationRequest = Readonly<{
  source: string;
  state: BotTurnState;
  memory: JsonValue;
  seed: number;
}>;

export type BotInvocationResult = Readonly<{
  move: BotMove;
  memory: JsonValue;
}>;
