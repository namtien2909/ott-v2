import {
  BOARD_COORDINATES,
  createInitialState,
  rotateCoordinate180,
  type Coordinate,
  type RuleState,
  type Side,
} from "@ottv2/game-rules";
import { MatchSnapshotSchema, type MatchSnapshot } from "@ottv2/contracts";

/**
 * B0 canonical values.  These fixtures are deliberately boring and stable:
 * tests and later UI waves must derive from the same setup/orientation/result
 * contract instead of re-creating an almost-identical board inline.
 */
export const CANONICAL_MATCH_ID = "00000000-0000-4000-8000-000000000001";
export const CANONICAL_ROOM_ID = "B0ROOM";
export const CANONICAL_TIMER_SECONDS = 300;
export const CANONICAL_CLOCK_MS = CANONICAL_TIMER_SECONDS * 1000;

export type ViewerOrientation = Readonly<{
  viewerSide: Side;
  bottomSide: Side;
  transform: "canonical" | "rotate-180";
}>;

/** A fresh W1 rule state with a1/i9 occupied as normal playable cells. */
export function createCanonicalRuleFixture(): RuleState {
  return createInitialState();
}

/**
 * Online orientation is fixed for the viewer.  AI/offline never rotate per
 * turn; spectators use the canonical Blue-at-bottom presentation.
 */
export function createViewerOrientation(viewerSide: Side, context: "ONLINE" | "AI" | "OFFLINE" | "SPECTATOR" = "ONLINE"): ViewerOrientation {
  if (context === "SPECTATOR") {
    return { viewerSide, bottomSide: "BLUE", transform: "canonical" };
  }
  if (context === "ONLINE" && viewerSide === "RED") {
    return { viewerSide, bottomSide: "RED", transform: "rotate-180" };
  }
  return { viewerSide, bottomSide: "BLUE", transform: "canonical" };
}

export function mapViewportCoordinate(coordinate: Coordinate, orientation: ViewerOrientation): Coordinate {
  return orientation.transform === "rotate-180" ? rotateCoordinate180(coordinate) : coordinate;
}

function createPlayers(blueReady = true, redReady = true): MatchSnapshot["players"] {
  return [
    { userId: "user-blue", username: "blue_player", displayName: "Blue Player", side: "BLUE", ready: blueReady, connected: true },
    { userId: "user-red", username: "red_player", displayName: "Red Player", side: "RED", ready: redReady, connected: true },
  ];
}

/** A schema-valid initial snapshot shared by contract, UI and E2E tests. */
export function createCanonicalMatchSnapshot(overrides: Partial<MatchSnapshot> = {}): MatchSnapshot {
  const rule = createCanonicalRuleFixture();
  return MatchSnapshotSchema.parse({
    matchId: CANONICAL_MATCH_ID,
    roomId: CANONICAL_ROOM_ID,
    mode: "UNRANKED",
    status: "PLAYING",
    players: createPlayers(),
    board: rule.board,
    pieceCounts: rule.pieceCounts,
    currentTurn: rule.currentTurn,
    winner: rule.winner,
    resultReason: rule.resultReason,
    clocksMs: { BLUE: CANONICAL_CLOCK_MS, RED: CANONICAL_CLOCK_MS },
    timerSeconds: CANONICAL_TIMER_SECONDS,
    countdownEndsAt: null,
    startedAt: 1_700_000_000_000,
    endedAt: null,
    sequence: 1,
    stateVersion: 1,
    rating: null,
    ...overrides,
  });
}

export function createFinishedRankedSnapshot(
  winner: Side = "BLUE",
  resultReason: "EXTINCTION" | "GOAL_REACHED" | "TIMEOUT" | "SURRENDER" = "GOAL_REACHED",
): MatchSnapshot {
  return createCanonicalMatchSnapshot({
    mode: "RANKED",
    status: "FINISHED",
    currentTurn: null,
    winner,
    resultReason,
    endedAt: 1_700_000_012_000,
    sequence: 42,
    stateVersion: 42,
    rating: {
      blueBefore: 1200,
      blueAfter: winner === "BLUE" ? 1216 : 1184,
      blueDelta: winner === "BLUE" ? 16 : -16,
      redBefore: 1200,
      redAfter: winner === "RED" ? 1216 : 1184,
      redDelta: winner === "RED" ? 16 : -16,
    },
  });
}

export function createAbortedSnapshot(reason: "DISCONNECT_TIMEOUT" | "SERVER_INTERRUPTION" = "SERVER_INTERRUPTION"): MatchSnapshot {
  return createCanonicalMatchSnapshot({
    status: "ABORTED",
    currentTurn: null,
    winner: null,
    resultReason: reason,
    endedAt: 1_700_000_012_000,
    sequence: 7,
    stateVersion: 7,
  });
}

export { BOARD_COORDINATES };
