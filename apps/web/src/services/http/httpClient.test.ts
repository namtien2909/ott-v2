import { afterEach, describe, expect, it, vi } from "vitest";

import { getJson } from "./httpClient";

describe("W5 HTTP session and network signals", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.removeEventListener("ottv2:session-expired", () => undefined);
  });

  it("signals session expiry for protected API responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "expired", code: "UNAUTHORIZED" }), { status: 401, headers: { "Content-Type": "application/json" } })));
    const listener = vi.fn();
    window.addEventListener("ottv2:session-expired", listener);
    await expect(getJson("/matches/ROOM01")).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not turn the initial auth probe into a session-expired modal", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "not signed in", code: "UNAUTHORIZED" }), { status: 401, headers: { "Content-Type": "application/json" } })));
    const listener = vi.fn();
    window.addEventListener("ottv2:session-expired", listener);
    await expect(getJson("/auth/me")).rejects.toMatchObject({ status: 401 });
    expect(listener).not.toHaveBeenCalled();
  });

  it("signals offline when the API cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    const listener = vi.fn();
    window.addEventListener("ottv2:network-state", listener);
    await expect(getJson("/matches/ROOM01")).rejects.toMatchObject({ message: "Không thể kết nối tới máy chủ." });
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: { state: "OFFLINE" } }));
  });

  it("signals degraded and emits request telemetry for server failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "degraded", code: "SERVICE_UNAVAILABLE" }), { status: 503, headers: { "Content-Type": "application/json" } })));
    const network = vi.fn();
    const telemetry = vi.fn();
    window.addEventListener("ottv2:network-state", network);
    window.addEventListener("ottv2:ui-telemetry", telemetry);
    await expect(getJson("/health")).rejects.toMatchObject({ status: 503 });
    expect(network).toHaveBeenCalledWith(expect.objectContaining({ detail: { state: "DEGRADED" } }));
    const telemetryEvent = (telemetry.mock.calls[0]?.[0] as CustomEvent).detail as { name: string; detail?: Record<string, unknown> };
    expect(telemetryEvent).toMatchObject({ name: "http_request", detail: { state: "DEGRADED", status: 503 } });
  });
});
