import { act, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { FriendsPreview } from "./FriendsPreview";

const mocks = vi.hoisted(() => ({ getFriends: vi.fn(), subscribeToPresence: vi.fn() }));
vi.mock("../../services/social/socialApi", () => mocks);

const friend = { userId: "friend-1", username: "red", displayName: "Red", elo: 1200, rankedWins: 9, rankedLosses: 4, presence: "ONLINE" as const, isFriend: true, requestStatus: null };

describe("B3 friends preview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads only after auth and reflects realtime presence", async () => {
    let onEvent: ((event: { user: { userId: string; presence: "IN_GAME" } }) => void) | undefined;
    mocks.getFriends.mockResolvedValue({ friends: [friend] });
    mocks.subscribeToPresence.mockImplementation((handler: typeof onEvent) => { onEvent = handler; return () => undefined; });

    renderWithProviders(<FriendsPreview authState="authenticated" />);
    await waitFor(() => expect(screen.getByText("Red")).toBeInTheDocument());
    expect(mocks.getFriends).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Online")).toBeInTheDocument();

    act(() => onEvent?.({ user: { userId: "friend-1", presence: "IN_GAME" } }));
    await waitFor(() => expect(screen.getByText("Đang đấu")).toBeInTheDocument());
  });

  it("does not call the social API before auth resolves", () => {
    renderWithProviders(<FriendsPreview authState="loading" />);
    expect(mocks.getFriends).not.toHaveBeenCalled();
    expect(screen.getByText("Đang xác thực…")).toBeInTheDocument();
  });
});
