import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import HomePage from "./HomePage";

const mocks = vi.hoisted(() => ({
  getHealth: vi.fn(),
  isCoreServiceReady: vi.fn(),
  getMe: vi.fn(),
}));

vi.mock("../services/health/healthApi", () => mocks);
vi.mock("../services/auth/authApi", () => ({ getMe: mocks.getMe }));
vi.mock("../components/rooms/RoomBrowser", () => ({ RoomBrowser: () => <section aria-label="Room Browser mock" /> }));
vi.mock("../components/social/FriendsPreview", () => ({ FriendsPreview: ({ authState }: { authState: string }) => <section aria-label={`Friends Preview ${authState}`} /> }));

const user = {
  id: "user-1",
  fullName: "Nguyễn Blue",
  displayName: "Blue",
  username: "blue",
  theme: "dark" as const,
  avatarPreset: "arena" as const,
  stats: { elo: 1460, rankedWins: 12, rankedLosses: 8, quickWins: 2, quickLosses: 1 },
};

describe("B3 Home lobby", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps the three-column contract and transforms the CTA for guests", async () => {
    mocks.getHealth.mockResolvedValue({ service: "ottv2", status: "ok", components: { realtime: { status: "ok" } } });
    mocks.isCoreServiceReady.mockReturnValue(true);
    mocks.getMe.mockRejectedValue(new Error("guest"));

    renderWithProviders(<HomePage />);

    await waitFor(() => expect(screen.getByText("Khách đấu trường")).toBeInTheDocument());
    expect(screen.getAllByText("ĐĂNG NHẬP ĐỂ XẾP HẠNG")).toHaveLength(2);
    expect(screen.getByText("Đấu với máy")).toBeInTheDocument();
    expect(screen.getByText("Offline 2P")).toBeInTheDocument();
    expect(screen.getByText("Guest Arena")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Room Browser mock" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Friends Preview guest" })).toBeInTheDocument();
  });

  it("renders the authenticated profile, rank and ranked CTA", async () => {
    mocks.getHealth.mockResolvedValue({ service: "ottv2", status: "ok", components: { realtime: { status: "ok" } } });
    mocks.isCoreServiceReady.mockReturnValue(true);
    mocks.getMe.mockResolvedValue({ user });

    renderWithProviders(<HomePage />);

    await waitFor(() => expect(screen.getByText("Blue")).toBeInTheDocument());
    expect(screen.getByLabelText("Rank GOLD")).toBeInTheDocument();
    expect(screen.getByText("TÌM TRẬN RANKED")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Friends Preview authenticated" })).toBeInTheDocument();
  });
});
