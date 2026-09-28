import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HistoryListResponse } from "@ottv2/contracts";

import HistoryPage from "./HistoryPage";
import * as historyApi from "../services/history/historyApi";
import { renderWithProviders } from "../test/renderWithProviders";

const list: HistoryListResponse = {
  matches: [],
  nextCursor: null,
  hasMore: false,
  summary: { elo: 1000, wins: 0, losses: 0, total: 0, winRate: 0 },
};

describe("B7 history filters", () => {
  it("keeps filter state in the route query while reloading the canonical list", async () => {
    const getHistory = vi.spyOn(historyApi, "getHistory").mockResolvedValue(list);
    renderWithProviders(<HistoryPage />, "/history?mode=RANKED&result=WIN&range=7D");

    await waitFor(() => expect(getHistory).toHaveBeenCalledWith({ mode: "RANKED", result: "WIN", range: "7D" }, expect.any(AbortSignal)));
    fireEvent.click(screen.getByRole("button", { name: "Đấu máy" }));

    await waitFor(() => expect(getHistory).toHaveBeenLastCalledWith({ mode: "AI", result: "WIN", range: "7D" }, expect.any(AbortSignal)));
    expect(screen.getByRole("button", { name: "Đấu máy" })).toHaveClass("active");
  });
});
