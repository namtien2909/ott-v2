import { PROTOCOL_VERSION } from "@ottv2/contracts";
import { describe, expect, it, vi } from "vitest";

import { DisabledRealtimeAdapter } from "../../src/realtime/disabled.adapter.js";

describe("DisabledRealtimeAdapter", () => {
  it("reports degradation and rejects publishing", async () => {
    const adapter = new DisabledRealtimeAdapter();
    expect(adapter.getStatus()).toEqual({ status: "degraded", reason: "not_configured" });
    await expect(adapter.publish(
      { kind: "room", roomId: "ROOM01" },
      { protocolVersion: PROTOCOL_VERSION, messageId: crypto.randomUUID(), type: "TEST", timestamp: 0, payload: {} }
    )).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });

  it("does not invoke subscription handlers", async () => {
    const adapter = new DisabledRealtimeAdapter();
    const handler = vi.fn();
    await expect(adapter.subscribe({ kind: "room", roomId: "ROOM01" }, handler)).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(handler).not.toHaveBeenCalled();
  });
});
