import { describe, expect, it } from "vitest";
import { deferred } from "../../packages/test-utils/src/index.js";

describe("test bootstrap", () => {
  it("resolves deterministic async fixtures", async () => {
    const fixture = deferred<string>();
    fixture.resolve("ready");
    await expect(fixture.promise).resolves.toBe("ready");
  });
});
