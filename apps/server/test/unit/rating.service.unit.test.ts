import { describe, expect, it } from "vitest";

import { calculateElo, MINIMUM_ELO } from "../../src/modules/rating/rating.service.js";

describe("W6 RatingService", () => {
  it("applies the canonical K=32 formula and preserves zero as the floor", () => {
    const equal = calculateElo({ blueElo: 1000, redElo: 1000, winner: "BLUE" });
    expect(equal).toMatchObject({ blueBefore: 1000, blueAfter: 1016, blueDelta: 16, redBefore: 1000, redAfter: 984, redDelta: -16 });
    const upset = calculateElo({ blueElo: 0, redElo: 2400, winner: "BLUE" });
    expect(upset.blueDelta).toBeGreaterThan(0);
    expect(upset.redAfter).toBeGreaterThanOrEqual(MINIMUM_ELO);
  });

  it("maps winner side independently from rating order", () => {
    const lowerRatedBlueWins = calculateElo({ blueElo: 900, redElo: 1200, winner: "BLUE" });
    expect(lowerRatedBlueWins.blueDelta).toBeGreaterThan(16);
    expect(lowerRatedBlueWins.redDelta).toBeLessThan(-16);
  });
});
