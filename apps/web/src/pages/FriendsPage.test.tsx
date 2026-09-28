import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FriendRequest, RoomInvite, SocialUser } from "@ottv2/contracts";

import FriendsPage from "./FriendsPage";
import { ToastProvider } from "../components/ui";
import { ApiError } from "../services/http/apiError";
import * as socialApi from "../services/social/socialApi";

const friend: SocialUser = { userId: "friend-1", username: "ban_tot", displayName: "Bạn Tốt", elo: 1100, rankedWins: 5, rankedLosses: 3, presence: "ONLINE", isFriend: true, requestStatus: null };
const incomingRequest: FriendRequest = { requestId: "11111111-1111-4111-8111-111111111111", user: { ...friend, isFriend: false, requestStatus: "PENDING" }, direction: "incoming", status: "PENDING", createdAt: "2026-09-28T10:00:00.000Z" };
const sentRequest: FriendRequest = { requestId: "22222222-2222-4222-8222-222222222222", user: { ...friend, userId: "friend-2", username: "nguoi_choi", displayName: "Người Chơi", isFriend: false, requestStatus: "PENDING" }, direction: "sent", status: "PENDING", createdAt: "2026-09-28T10:00:00.000Z" };
const roomInvite: RoomInvite = { token: "invite-token-1234567890", roomId: "ABC234", from: { userId: friend.userId, username: friend.username, displayName: friend.displayName }, expiresAt: "2026-09-28T12:00:00.000Z", status: "ACTIVE" };

function renderPage() {
  return render(<ToastProvider><MemoryRouter><FriendsPage /></MemoryRouter></ToastProvider>);
}

beforeEach(() => {
  vi.spyOn(socialApi, "getFriends").mockResolvedValue({ friends: [friend] });
  vi.spyOn(socialApi, "getRequests").mockImplementation(async (direction) => ({ requests: direction === "incoming" ? [incomingRequest] : [sentRequest] }));
  vi.spyOn(socialApi, "getInvites").mockResolvedValue({ invites: [] });
  vi.spyOn(socialApi, "subscribeToPresence").mockReturnValue(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

describe("B9 friends and invites", () => {
  it("keeps incoming and sent request states distinct", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Bạn bè" });

    fireEvent.click(screen.getByRole("tab", { name: /LỜI MỜI/ }));
    expect(await screen.findByText("Muốn kết nối với bạn")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chấp nhận" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /ĐÃ GỬI/ }));
    expect(await screen.findByText("Đang chờ phản hồi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hủy yêu cầu" })).toBeInTheDocument();
  });

  it("supports menu focus management, Escape restore, and click-outside close", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Bạn bè" });
    const trigger = screen.getByRole("button", { name: "Thao tác với Bạn Tốt" });

    fireEvent.click(trigger);
    const profileItem = await screen.findByRole("menuitem", { name: "Xem hồ sơ" });
    await waitFor(() => expect(profileItem).toHaveFocus());
    fireEvent.keyDown(profileItem, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Xóa bạn" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "Xóa bạn" }), { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());

    fireEvent.click(trigger);
    await screen.findByRole("menuitem", { name: "Xem hồ sơ" });
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menuitem", { name: "Xem hồ sơ" })).not.toBeInTheDocument();
  });

  it("locks the invite modal while pending and exposes the one-time token on success", async () => {
    let resolveInvite: (value: { invite: RoomInvite }) => void = () => undefined;
    vi.spyOn(socialApi, "createInvite").mockImplementation(() => new Promise((resolve) => { resolveInvite = resolve; }));
    renderPage();
    await screen.findByRole("heading", { name: "Bạn bè" });

    fireEvent.click(screen.getByRole("button", { name: "Mời chơi" }));
    fireEvent.change(screen.getByLabelText("Room ID"), { target: { value: "ABC234" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi lời mời" }));
    expect(screen.getByRole("button", { name: "Đang xử lý…" })).toBeDisabled();
    expect(screen.getByText("Đang gửi lời mời…")).toBeInTheDocument();

    await act(async () => { resolveInvite({ invite: roomInvite }); });
    expect(await screen.findByLabelText("Token lời mời một lần")).toHaveTextContent(roomInvite.token);
    expect(screen.getByText("Token một lần")).toBeInTheDocument();
  });

  it("removes an invite that expires during accept instead of leaving a stale card", async () => {
    vi.spyOn(socialApi, "getInvites").mockResolvedValue({ invites: [roomInvite] });
    vi.spyOn(socialApi, "acceptInvite").mockRejectedValue(new ApiError("Lời mời không còn hiệu lực.", 404, "INVITE_INVALID"));
    renderPage();
    await screen.findByRole("heading", { name: "Bạn bè" });
    fireEvent.click(screen.getByRole("tab", { name: /LỜI MỜI/ }));
    expect(await screen.findByText(/mời bạn vào phòng ABC234/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Vào phòng" }));
    await waitFor(() => expect(screen.queryByText(/mời bạn vào phòng ABC234/)).not.toBeInTheDocument());
    expect(screen.getByText("Lời mời đã hết hạn hoặc không còn hiệu lực.")).toBeInTheDocument();
  });
});
