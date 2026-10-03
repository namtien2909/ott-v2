import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { transferableAbortController } from "node:util";
import { createMemoryRouter, Link, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchmakingEventEnvelope, MatchmakingSnapshot } from "@ottv2/contracts";

import QueuePage from "./QueuePage";
import * as matchmakingApi from "../services/matchmaking/matchmakingApi";
import { ApiError } from "../services/http/apiError";
import { ToastProvider } from "../components/ui";

vi.mock("../services/matchmaking/matchmakingApi", () => ({ joinRankedQueue: vi.fn(), getQueue: vi.fn(), cancelQueue: vi.fn(), subscribeToQueue: vi.fn() }));

function renderQueue(strict = false) {
  const element = <><Link to="/">Đi tới trang chủ</Link><QueuePage /></>;
  const router = createMemoryRouter([
    { path: "/queue", element: strict ? <StrictMode>{element}</StrictMode> : element },
    { path: "/", element: <h1>Sảnh</h1> },
    { path: "/room/:roomId", element: <h1>Phòng đã ghép</h1> },
  ], { initialEntries: ["/", "/queue"] });
  return { ...render(<ToastProvider><RouterProvider router={router} /></ToastProvider>), router };
}

const queue: MatchmakingSnapshot = {
  queueId: "00000000-0000-4000-8000-000000000005", mode: "RANKED", status: "QUEUED",
  player: { userId: "u1", username: "blue", displayName: "Blue", elo: 1000 }, opponent: null,
  range: 100, elapsedMs: 0, joinedAt: 1000, roomId: null, matchId: null,
};
const matched: MatchmakingSnapshot = {
  ...queue, status: "MATCHED", roomId: "ABC234", matchId: "00000000-0000-4000-8000-000000000006",
  opponent: { userId: "u2", username: "red", displayName: "Red", elo: 1000 },
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => { resolve = accept; });
  return { promise, resolve };
}

describe("R1 queue exit", () => {
  beforeEach(() => {
    // jsdom signals are not accepted by Node's native Request, used by the data router.
    vi.stubGlobal("AbortController", class {
      private controller = transferableAbortController();
      signal = this.controller.signal;
      abort(reason?: unknown) { this.controller.abort(reason); }
    });
    vi.clearAllMocks();
    vi.mocked(matchmakingApi.joinRankedQueue).mockResolvedValue({ queue });
    vi.mocked(matchmakingApi.subscribeToQueue).mockReturnValue(vi.fn());
    vi.mocked(matchmakingApi.getQueue).mockResolvedValue({ queue });
    vi.mocked(matchmakingApi.cancelQueue).mockResolvedValue({ queue: { ...queue, status: "CANCELLED" } });
  });
  afterEach(async () => { cleanup(); await new Promise((resolve) => window.setTimeout(resolve, 5)); vi.unstubAllGlobals(); });

  it("awaits authoritative cancellation for Về sảnh and disables duplicate exits", async () => {
    const response = deferred<{ queue: MatchmakingSnapshot }>();
    const cancel = vi.mocked(matchmakingApi.cancelQueue).mockReturnValue(response.promise);
    const { router } = renderQueue();
    fireEvent.click(await screen.findByRole("button", { name: "Về sảnh" }));
    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
    expect(router.state.location.pathname).toBe("/queue");
    expect(screen.getByRole("button", { name: "Đang huỷ…" })).toBeDisabled();
    await act(async () => response.resolve({ queue: { ...queue, status: "CANCELLED" } }));
    expect(router.state.location.pathname).toBe("/");
  });

  it("cleans up an admission that resolves after the page leaves", async () => {
    const admission = deferred<{ queue: MatchmakingSnapshot }>();
    vi.mocked(matchmakingApi.joinRankedQueue).mockReturnValue(admission.promise);
    const view = renderQueue();
    view.unmount();
    await act(async () => admission.resolve({ queue }));
    await waitFor(() => expect(matchmakingApi.cancelQueue).toHaveBeenCalledWith(queue.queueId));
  });

  it("resyncs canonical status after a failed cancellation without claiming success", async () => {
    vi.mocked(matchmakingApi.cancelQueue).mockRejectedValue(new ApiError("Mất kết nối"));
    vi.mocked(matchmakingApi.getQueue).mockResolvedValue({ queue: matched });
    const { router } = renderQueue();
    fireEvent.click(await screen.findByRole("button", { name: "Huỷ tìm trận" }));
    await screen.findByRole("heading", { name: "ĐÃ TÌM THẤY ĐỐI THỦ" });
    expect(matchmakingApi.getQueue).toHaveBeenCalledWith(queue.queueId);
    await waitFor(() => expect(router.state.location.pathname).toBe("/room/ABC234"));
  });

  it("ignores a foreign generation even when its sequence is newer", async () => {
    let onEvent!: (event: MatchmakingEventEnvelope) => void;
    vi.mocked(matchmakingApi.subscribeToQueue).mockImplementation((_id, receive) => { onEvent = receive; return vi.fn(); });
    const { router } = renderQueue();
    await screen.findByRole("heading", { name: "Đang tìm đối thủ" });
    await act(async () => onEvent({ protocolVersion: "0.1", messageId: "00000000-0000-4000-8000-000000000007", type: "MATCH_FOUND", timestamp: 1000, sequence: 100, queueId: "00000000-0000-4000-8000-000000000099", payload: { ...matched, queueId: "00000000-0000-4000-8000-000000000099" } }));
    expect(screen.getByRole("heading", { name: "Đang tìm đối thủ" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/queue");
  });

  it.each(["link", "back"])("blocks %s navigation until cancellation is acknowledged", async (kind) => {
    const response = deferred<{ queue: MatchmakingSnapshot }>();
    vi.mocked(matchmakingApi.cancelQueue).mockReturnValue(response.promise);
    const { router } = renderQueue();
    await screen.findByRole("heading", { name: "Đang tìm đối thủ" });
    if (kind === "link") fireEvent.click(screen.getByRole("link", { name: "Đi tới trang chủ" }));
    else await act(async () => { void router.navigate(-1); });
    await waitFor(() => expect(matchmakingApi.cancelQueue).toHaveBeenCalledTimes(1));
    expect(router.state.location.pathname).toBe("/queue");
    await act(async () => response.resolve({ queue: { ...queue, status: "CANCELLED" } }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });

  it("does not cancel an admission reused by StrictMode effect remount", async () => {
    const admission = deferred<{ queue: MatchmakingSnapshot }>();
    vi.mocked(matchmakingApi.joinRankedQueue).mockReturnValue(admission.promise);
    renderQueue(true);
    await act(async () => admission.resolve({ queue }));
    await screen.findByRole("heading", { name: "Đang tìm đối thủ" });
    expect(matchmakingApi.joinRankedQueue).toHaveBeenCalledTimes(1);
    expect(matchmakingApi.cancelQueue).not.toHaveBeenCalled();
  });

  it("waits for a pending join and cancels its returned generation before leaving", async () => {
    const admission = deferred<{ queue: MatchmakingSnapshot }>();
    vi.mocked(matchmakingApi.joinRankedQueue).mockReturnValue(admission.promise);
    const { router } = renderQueue();
    fireEvent.click(screen.getByRole("link", { name: "Đi tới trang chủ" }));
    expect(router.state.location.pathname).toBe("/queue");
    await act(async () => admission.resolve({ queue }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(matchmakingApi.cancelQueue).toHaveBeenCalledTimes(1);
    expect(matchmakingApi.cancelQueue).toHaveBeenCalledWith(queue.queueId);
  });

  it("recognizes a cancellation whose response was lost from the canonical snapshot", async () => {
    vi.mocked(matchmakingApi.cancelQueue).mockRejectedValue(new ApiError("Mất kết nối"));
    vi.mocked(matchmakingApi.getQueue).mockResolvedValue({ queue: { ...queue, status: "CANCELLED" } });
    const { router } = renderQueue();
    fireEvent.click(await screen.findByRole("button", { name: "Huỷ tìm trận" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(matchmakingApi.getQueue).toHaveBeenCalledWith(queue.queueId);
  });

  it("keeps the queued page and retry enabled when cancellation cannot be confirmed", async () => {
    vi.mocked(matchmakingApi.cancelQueue).mockRejectedValue(new ApiError("Không kết nối được"));
    vi.mocked(matchmakingApi.getQueue).mockRejectedValue(new ApiError("Chưa đồng bộ được"));
    const { router } = renderQueue();
    await screen.findByRole("heading", { name: "Đang tìm đối thủ" });
    fireEvent.click(screen.getByRole("link", { name: "Đi tới trang chủ" }));
    await screen.findByRole("alert");
    expect(router.state.location.pathname).toBe("/queue");
    await waitFor(() => expect(screen.getByRole("button", { name: "Huỷ tìm trận" })).toBeEnabled());
    expect(screen.queryByText("Đã huỷ tìm trận.")).not.toBeInTheDocument();
  });

  it("resyncs a temporary transport loss without cancelling the queued admission", async () => {
    let onError!: () => void;
    vi.mocked(matchmakingApi.subscribeToQueue).mockImplementation((_id, _receive, fail) => { onError = fail; return vi.fn(); });
    renderQueue();
    await screen.findByRole("heading", { name: "Đang tìm đối thủ" });
    await act(async () => onError());
    expect(matchmakingApi.getQueue).toHaveBeenCalledWith(queue.queueId);
    expect(matchmakingApi.cancelQueue).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Đang tìm đối thủ" })).toBeInTheDocument();
  });

  it("recovers a committed match on SSE reconnect without sending cancellation", async () => {
    let onOpen!: () => void;
    vi.mocked(matchmakingApi.subscribeToQueue).mockImplementation((_id, _receive, _fail, open) => { onOpen = open!; return vi.fn(); });
    vi.mocked(matchmakingApi.getQueue).mockResolvedValue({ queue: matched });
    const { router } = renderQueue();
    await screen.findByRole("heading", { name: "Đang tìm đối thủ" });
    await act(async () => onOpen());
    await waitFor(() => expect(router.state.location.pathname).toBe("/room/ABC234"));
    expect(matchmakingApi.cancelQueue).not.toHaveBeenCalled();
  });
});
