import { describe, expect, it } from "vitest";
import { MatchSnapshotSchema } from "@ottv2/contracts";
import {
  BOARD_COORDINATES,
  createAbortedSnapshot,
  createCanonicalMatchSnapshot,
  createCanonicalRuleFixture,
  createFinishedRankedSnapshot,
  createViewerOrientation,
  mapViewportCoordinate,
} from "../fixtures/frontend-fixtures";

describe("B0 canonical frontend fixtures", () => {
  it("keeps a1 and i9 as occupied, playable setup cells", () => {
    const state = createCanonicalRuleFixture();
    expect(BOARD_COORDINATES).toHaveLength(81);
    expect(Object.values(state.board).filter(Boolean)).toHaveLength(18);
    expect(state.board.a1).toMatchObject({ side: "BLUE", type: "S" });
    expect(state.board.i9).toMatchObject({ side: "RED", type: "S" });
    expect(state.board.a2).toBeNull();
    expect(state.board.i8).toBeNull();
  });

  it("fixes orientation once per viewer, never once per turn", () => {
    const blue = createViewerOrientation("BLUE", "ONLINE");
    const red = createViewerOrientation("RED", "ONLINE");
    const ai = createViewerOrientation("RED", "AI");
    const spectator = createViewerOrientation("RED", "SPECTATOR");

    expect(blue).toMatchObject({ bottomSide: "BLUE", transform: "canonical" });
    expect(red).toMatchObject({ bottomSide: "RED", transform: "rotate-180" });
    expect(ai).toMatchObject({ bottomSide: "BLUE", transform: "canonical" });
    expect(spectator).toMatchObject({ bottomSide: "BLUE", transform: "canonical" });
    expect(mapViewportCoordinate("a1", red)).toBe("i9");
    expect(mapViewportCoordinate("a1", red)).toBe(mapViewportCoordinate("a1", red));
  });

  it("provides schema-valid playing, finished-ranked and aborted snapshots", () => {
    const playing = createCanonicalMatchSnapshot();
    const finished = createFinishedRankedSnapshot("RED", "SURRENDER");
    const aborted = createAbortedSnapshot();

    expect(MatchSnapshotSchema.safeParse(playing).success).toBe(true);
    expect(playing.status).toBe("PLAYING");
    expect(finished).toMatchObject({ status: "FINISHED", mode: "RANKED", winner: "RED", resultReason: "SURRENDER" });
    expect(finished.rating).not.toBeNull();
    expect(aborted).toMatchObject({ status: "ABORTED", winner: null, resultReason: "SERVER_INTERRUPTION" });
    expect(aborted.rating).toBeNull();
  });
});
