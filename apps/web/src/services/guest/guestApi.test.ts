import { describe, expect, it } from "vitest";
import { withGuestBootstrapLock } from "./guestApi";

describe("Guest bootstrap lock", () => {
  it("serializes concurrent work through the browser lock primitive", async () => {
    let tail = Promise.resolve();
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: { request: async (_name: string, _options: unknown, work: () => Promise<unknown>) => {
        const previous = tail;
        let release!: () => void;
        tail = new Promise<void>((resolve) => { release = resolve; });
        await previous;
        try { return await work(); } finally { release(); }
      } },
    });
    const order: string[] = [];
    const run = (label: string) => withGuestBootstrapLock(async () => {
      order.push(`${label}:start`);
      await new Promise((resolve) => window.setTimeout(resolve, 40));
      order.push(`${label}:end`);
    });
    await Promise.all([run("a"), run("b")]);
    expect(order.join(",")).toMatch(/^(a:start|b:start),(a:end|b:end),(a:start|b:start),(a:end|b:end)$/);
    expect(order[0]?.split(":")[0]).toBe(order[1]?.split(":")[0]);
    expect(order[2]?.split(":")[0]).toBe(order[3]?.split(":")[0]);
  });

  it("fails closed when no cross-tab lock primitive is available", async () => {
    Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
    await expect(withGuestBootstrapLock(async () => undefined)).rejects.toThrow("Không thể đồng bộ phiên khách");
  });
});
