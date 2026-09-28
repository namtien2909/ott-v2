import { describe, expect, it } from "vitest";

import { deriveRank, RANK_TIERS } from "./rankConfig";

describe("profile rank config", () => {
  it.each([
    [0, "bronze"],
    [799, "bronze"],
    [800, "silver"],
    [1199, "gold"],
    [1200, "platinum"],
    [1400, "diamond"],
    [1600, "master"],
    [9999, "master"],
  ])("derives %s for Elo %s", (elo, expected) => {
    expect(deriveRank(elo).id).toBe(expected);
  });

  it("keeps every tier shape-distinct with a chevron count", () => {
    expect(RANK_TIERS.map((tier) => tier.chevrons)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("fails safe for invalid Elo", () => {
    expect(deriveRank(Number.NaN).id).toBe("bronze");
    expect(deriveRank(-100).id).toBe("bronze");
  });
});
