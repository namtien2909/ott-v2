import {
  BOARD_COORDINATES,
  getLegalDestinations,
  type RuleState,
  type Side,
} from "@ottv2/game-rules";
import type { BotMove, BotMoveRecord, BotTurnState } from "./types.js";
import { BOT_SDK_VERSION, BOT_STATE_SCHEMA_VERSION } from "./version.js";

function publicMoves(state: RuleState, side: Side): readonly BotMove[] {
  const effectiveState: RuleState = state.currentTurn === side
    ? state
    : { ...state, currentTurn: side, status: "PLAYING", winner: null, resultReason: null };
  return BOARD_COORDINATES.flatMap((from) => getLegalDestinations(effectiveState, side, from).map((to) => ({ from, to })));
}

export function createBotTurnState(
  state: RuleState,
  side: Side,
  history: readonly BotMoveRecord[],
  clocksMs: Readonly<{ BLUE: number; RED: number }>,
  turnNumber = history.length + 1,
): BotTurnState {
  return Object.freeze({
    sdkVersion: BOT_SDK_VERSION,
    schemaVersion: BOT_STATE_SCHEMA_VERSION,
    side,
    board: Object.freeze({ ...state.board }),
    legalMoves: Object.freeze(publicMoves(state, side)),
    turnNumber,
    clocksMs: Object.freeze({ BLUE: clocksMs.BLUE, RED: clocksMs.RED }),
    history: Object.freeze(history.map((move) => ({ ...move }))),
  });
}
