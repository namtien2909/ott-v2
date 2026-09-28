import { expect, test, type Page } from "playwright/test";

type Side = "BLUE" | "RED";

function initialBoard() {
  const board: Record<string, { id: string; side: Side; type: "R" | "P" | "S" } | null> = {};
  for (let rank = 1; rank <= 9; rank += 1) for (const file of "abcdefghi") board[`${file}${rank}`] = null;
  const blue = [["a1", "S", 3], ["b1", "R", 1], ["c1", "P", 1], ["d1", "S", 1], ["e1", "R", 2], ["f1", "P", 2], ["g1", "S", 2], ["h1", "R", 3], ["i1", "P", 3]] as const;
  const red = [["a9", "P", 1], ["b9", "R", 1], ["c9", "S", 1], ["d9", "P", 2], ["e9", "R", 2], ["f9", "S", 2], ["g9", "P", 3], ["h9", "R", 3], ["i9", "S", 3]] as const;
  for (const [coordinate, type, ordinal] of blue) board[coordinate] = { id: `blue-${type.toLowerCase()}-${ordinal}`, side: "BLUE", type };
  for (const [coordinate, type, ordinal] of red) board[coordinate] = { id: `red-${type.toLowerCase()}-${ordinal}`, side: "RED", type };
  return board;
}

function matchSnapshot() {
  return { matchId: "11111111-1111-4111-8111-111111111111", roomId: "ABC123", mode: "UNRANKED", status: "PLAYING", players: [{ userId: "blue-user", username: "blue_user", displayName: "Người chơi Xanh", side: "BLUE", ready: true, connected: true }, { userId: "red-user", username: "red_user", displayName: "Người chơi Đỏ", side: "RED", ready: true, connected: true }], board: initialBoard(), pieceCounts: { BLUE: { R: 3, P: 3, S: 3 }, RED: { R: 3, P: 3, S: 3 } }, currentTurn: "BLUE", winner: null, resultReason: null, clocksMs: { BLUE: 60000, RED: 60000 }, timerSeconds: 60, countdownEndsAt: null, startedAt: Date.now(), endedAt: null, sequence: 1, stateVersion: 1, rating: null };
}

async function disableEventSource(page: Page) {
  await page.addInitScript(() => {
    class SilentEventSource { onmessage: ((event: MessageEvent) => void) | null = null; onerror: ((event: Event) => void) | null = null; close() {} }
    Object.defineProperty(window, "EventSource", { configurable: true, value: SilentEventSource });
  });
}

test("public shell uses Vietnamese navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Trang chủ" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Lịch sử" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Oẳn Tù Tì/i })).toBeVisible();
});

test("mobile exposes safe bottom navigation", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Điều hướng di động" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Hồ sơ" }).last()).toBeVisible();
});

test("history keeps filters, canonical detail context and a read-only final thumbnail", async ({ page }) => {
  await disableEventSource(page);
  const matchId = "11111111-1111-4111-8111-111111111111";
  const player = { userId: "blue-user", username: "blue_user", displayName: "Người chơi Xanh", side: "BLUE", isViewer: true, isWinner: true, ratingBefore: 1000, ratingAfter: 1016, ratingDelta: 16 };
  const opponent = { userId: "red-user", username: "red_user", displayName: "Người chơi Đỏ", side: "RED", isViewer: false, isWinner: false, ratingBefore: 1000, ratingAfter: 984, ratingDelta: -16 };
  const card = { matchId, roomId: "ABC123", mode: "RANKED", status: "FINISHED", result: "WIN", resultReason: "SURRENDER", winner: "BLUE", viewer: player, opponent, timerSeconds: 300, startedAt: new Date(0).toISOString(), endedAt: new Date(1000).toISOString(), durationSeconds: 1, ratingDelta: 16, finalBoard: initialBoard() };
  await page.route("**/auth/me", async (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }) }));
  await page.route("http://localhost:3001/history?*", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matches: [card], nextCursor: null, hasMore: false, summary: { elo: 1016, wins: 1, losses: 0, total: 1, winRate: 100 } }) }));
  await page.route(`http://localhost:3001/history/${matchId}`, async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ match: { ...card, players: [player, opponent] } }) }));

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/history?mode=RANKED&result=WIN&range=7D");
  await expect(page.getByRole("heading", { name: "Lịch sử đấu" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Xếp hạng", exact: true })).toHaveClass(/active/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.getByRole("button", { name: /THẮNG/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("img", { name: /canonical Xanh ở dưới/i })).toBeVisible();
  await expect(page.locator(".final-position-square")).toHaveCount(81);
  await expect(page.locator(".final-position button")).toHaveCount(0);
  await page.getByRole("button", { name: "Đóng hộp thoại" }).click();
  await page.getByRole("button", { name: "Đấu máy" }).click();
  await expect(page).toHaveURL(/mode=AI/);
  await page.reload();
  await expect(page.getByRole("button", { name: "Đấu máy" })).toHaveClass(/active/);
});

test("game room hides global navigation and renders a 9 by 9 board", async ({ page }) => {
  await page.goto("/game/w1-demo");
  await expect(page.getByRole("grid", { name: "Bàn cờ OTTv2 9 nhân 9" })).toBeVisible();
  await expect(page.getByRole("gridcell")).toHaveCount(81);
  await expect(page.getByRole("navigation", { name: "Điều hướng chính" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Điều hướng di động" })).toHaveCount(0);
});

test("offline keeps canonical orientation across BLUE and RED turns", async ({ page }) => {
  await page.goto("/offline");
  await page.getByRole("button", { name: "Bắt đầu ván" }).click();
  const cells = page.getByRole("grid").locator("[data-coordinate]");
  await expect(cells.first()).toHaveAttribute("data-coordinate", "a9");
  await expect(cells.last()).toHaveAttribute("data-coordinate", "i1");
  await page.getByRole("gridcell", { name: /Ô b1, Quân Đấm phe Xanh/ }).click();
  await page.getByRole("gridcell", { name: /Ô b2, trống/ }).click();
  await expect(page.getByText("Chuyển thiết bị cho")).toBeHidden({ timeout: 2500 });
  await page.getByRole("gridcell", { name: /Ô h9, Quân Đấm phe Đỏ/ }).click();
  await expect(page.getByRole("gridcell", { name: /Ô h8, trống/ })).toHaveAttribute("data-legal", "true");
  await expect(cells.first()).toHaveAttribute("data-coordinate", "a9");
  await expect(cells.last()).toHaveAttribute("data-coordinate", "i1");
});

test("AI keeps BLUE orientation while the bot takes its turn", async ({ page }) => {
  await page.goto("/ai");
  await page.getByRole("button", { name: "Bắt đầu ván" }).click();
  const cells = page.getByRole("grid").locator("[data-coordinate]");
  await page.getByRole("gridcell", { name: /Ô b1, Quân Đấm phe Xanh/ }).click();
  await page.getByRole("gridcell", { name: /Ô b2, trống/ }).click();
  await page.waitForTimeout(700);
  await expect(cells.first()).toHaveAttribute("data-coordinate", "a9");
  await expect(cells.last()).toHaveAttribute("data-coordinate", "i1");
});

for (const viewerSide of ["BLUE", "RED"] as const) {
  test(`online ${viewerSide} viewer stays fixed with self on the near side`, async ({ page }) => {
    await disableEventSource(page);
    await page.route("http://localhost:3001/matches/ABC123?*", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ match: matchSnapshot(), viewerSide }) }));
    await page.goto("/game/ABC123");
    const expectedFar = viewerSide === "BLUE" ? "RED" : "BLUE";
    await expect(page.locator(".perspective-hud.near")).toHaveAttribute("data-perspective-side", viewerSide);
    await expect(page.locator(".perspective-hud.far")).toHaveAttribute("data-perspective-side", expectedFar);
    const cells = page.getByRole("grid").locator("[data-coordinate]");
    await expect(cells.first()).toHaveAttribute("data-coordinate", viewerSide === "BLUE" ? "a9" : "i1");
    await expect(cells.last()).toHaveAttribute("data-coordinate", viewerSide === "BLUE" ? "i1" : "a9");
  });
}

test("spectator always uses canonical BLUE orientation", async ({ page }) => {
  await disableEventSource(page);
  await page.route("http://localhost:3001/rooms/ABC123/spectate", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ role: "SPECTATOR", room: { roomId: "ABC123", name: "Phòng kiểm thử" } }) }));
  await page.route("http://localhost:3001/matches/ABC123/spectator", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ role: "SPECTATOR", room: { roomId: "ABC123", name: "Phòng kiểm thử" }, match: matchSnapshot(), viewerSide: null, spectatorCount: 1 }) }));
  await page.route("http://localhost:3001/rooms/ABC123/spectate/leave", async (route) => route.fulfill({ status: 204, body: "" }));
  await page.goto("/spectate/ABC123");
  const cells = page.getByRole("grid").locator("[data-coordinate]");
  await expect(cells.first()).toHaveAttribute("data-coordinate", "a9");
  await expect(cells.last()).toHaveAttribute("data-coordinate", "i1");
});

test("spectator is read-only and exposes canonical activity feeds", async ({ page }) => {
  await disableEventSource(page);
  await page.route("http://localhost:3001/rooms/ABC123/spectate", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ role: "SPECTATOR", room: { roomId: "ABC123", name: "Phòng kiểm thử" } }) }));
  await page.route("http://localhost:3001/matches/ABC123/spectator", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ role: "SPECTATOR", room: { roomId: "ABC123", name: "Phòng kiểm thử" }, match: matchSnapshot(), viewerSide: null, spectatorCount: 1 }) }));
  await page.route("http://localhost:3001/rooms/ABC123/spectate/leave", async (route) => route.fulfill({ status: 204, body: "" }));
  await page.goto("/spectate/ABC123");
  await expect(page.getByRole("heading", { name: "Phòng kiểm thử" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Nhật ký nước đi" })).toContainText("Chưa có nước đi mới.");
  await expect(page.getByRole("region", { name: "Combat feed" })).toContainText("Chưa có diễn biến kết quả.");
  const bluePiece = page.getByRole("gridcell", { name: /Ô b1, Quân Đấm phe Xanh/ });
  await bluePiece.click({ force: true });
  await expect(bluePiece).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("[data-legal='true']")).toHaveCount(0);
});

test("private spectator entry keeps password and error copy in Vietnamese", async ({ page }) => {
  await disableEventSource(page);
  let attempts = 0;
  await page.route("http://localhost:3001/rooms/PRIVATE/spectate", async (route) => {
    attempts += 1;
    if (attempts === 1) return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ code: "ROOM_PASSWORD_REQUIRED", message: "Private room" }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ role: "SPECTATOR", room: { roomId: "PRIVATE", name: "Phòng riêng" } }) });
  });
  await page.route("http://localhost:3001/matches/PRIVATE/spectator", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ role: "SPECTATOR", room: { roomId: "PRIVATE", name: "Phòng riêng" }, match: { ...matchSnapshot(), roomId: "PRIVATE" }, viewerSide: null, spectatorCount: 2 }) }));
  await page.route("http://localhost:3001/rooms/PRIVATE/spectate/leave", async (route) => route.fulfill({ status: 204, body: "" }));
  await page.goto("/spectate/PRIVATE");
  await expect(page.getByRole("heading", { name: "Cần mật khẩu phòng" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Phòng này cần mật khẩu");
  await page.getByLabel("Mật khẩu phòng").fill("matkhau");
  await page.getByRole("button", { name: "Xem trận" }).click();
  await expect(page.getByRole("heading", { name: "Phòng riêng" })).toBeVisible();
});

test("not found screen provides branded explanation and lobby action", async ({ page }) => {
  await page.goto("/route-does-not-exist");
  await expect(page.getByRole("heading", { name: "Trang này không tồn tại" })).toBeVisible();
  await expect(page.getByText(/Đường dẫn có thể đã đổi/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Về sảnh", exact: true })).toHaveAttribute("href", "/");
});

test("registration keeps recovery acknowledgement gated", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: "Tạo tài khoản" })).toBeVisible();
  await expect(page.getByLabel("Username")).toHaveAttribute("pattern", "[A-Za-z0-9_]{4,20}");
});

test("profile edit modal persists a combined profile update", async ({ page }) => {
  const user = { id: "self-user", fullName: "Nguyễn Người Chơi", displayName: "Người Chơi", username: "nguoi_choi", theme: "system", avatarPreset: "robot", stats: { elo: 1000, rankedWins: 2, rankedLosses: 1, quickWins: 0, quickLosses: 0 } };
  await page.route("**/auth/me", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user }) }));
  await page.route("**/profiles/me", async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    const input = route.request().postDataJSON() as { fullName: string; displayName: string; avatarPreset: string };
    expect(input).toMatchObject({ displayName: "Kiện Tướng", avatarPreset: "fox" });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { ...user, ...input } }) });
  });
  await page.goto("/ho-so");
  await page.getByRole("button", { name: "Chỉnh sửa hồ sơ" }).click();
  await page.getByLabel("Tên hiển thị").fill("Kiện Tướng");
  await page.getByRole("radio", { name: "Cáo" }).click();
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Kiện Tướng" })).toBeVisible();
});

test("friend card keeps secondary actions in an accessible menu", async ({ page }) => {
  const friend = { userId: "friend-user", username: "ban_tot", displayName: "Bạn Tốt", elo: 1100, rankedWins: 5, rankedLosses: 3, presence: "ONLINE", isFriend: true, requestStatus: null };
  await disableEventSource(page);
  await page.route("**/auth/me", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: "self-user", fullName: "Tôi", displayName: "Tôi", username: "toi_day", theme: "system", avatarPreset: "robot", stats: { elo: 1000, rankedWins: 0, rankedLosses: 0, quickWins: 0, quickLosses: 0 } } }) }));
  await page.route("**/social/friends", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ friends: [friend] }) }));
  await page.route("**/social/requests?*", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ requests: [] }) }));
  await page.route("**/social/invites", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ invites: [] }) }));
  await page.goto("/friends");
  const trigger = page.getByRole("button", { name: "Thao tác với Bạn Tốt" });
  await trigger.click();
  await expect(page.getByRole("menuitem", { name: "Xem hồ sơ" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Xóa bạn" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitem", { name: "Xem hồ sơ" })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("authenticated homepage renders friends preview after an internally scrolling room list", async ({ page }) => {
  await disableEventSource(page);
  await page.route("**/auth/me", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: "self-user", fullName: "Tôi", displayName: "Tôi", username: "toi_day", theme: "system", avatarPreset: "robot", stats: { elo: 1000, rankedWins: 0, rankedLosses: 0, quickWins: 0, quickLosses: 0 } } }) }));
  await page.route("**/health", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", service: "ottv2-server", version: "test", protocolVersion: "0.1", timestamp: new Date().toISOString(), components: { application: { status: "ok" }, database: { status: "ok" }, realtime: { status: "ok" } } }) }));
  await page.route("**/social/friends", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ friends: [{ userId: "friend-user", username: "ban_tot", displayName: "Bạn Tốt", elo: 1100, rankedWins: 5, rankedLosses: 3, presence: "ONLINE", isFriend: true, requestStatus: null }] }) }));
  const rooms = Array.from({ length: 10 }, (_, index) => ({ roomId: `AB${String(index).padStart(2, "0")}CD`, name: `Phòng ${index + 1}`, players: 1, playerCapacity: 2, waitingPlayerRating: 1200 + index, mode: "UNRANKED", visibility: "PUBLIC", timerSeconds: 300, spectators: 0, spectatorsEnabled: false, spectatorCapacity: null, status: "WAITING" }));
  await page.route((url) => url.pathname === "/rooms", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.searchParams.get("search")) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ code: "NOT_FOUND", message: "Phòng đấu không tồn tại." }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ rooms }) });
  });
  await page.goto("/");
  await expect(page.locator(".room-card")).toHaveCount(10);
  await expect(page.locator("#friends-preview-heading")).toBeVisible();
  await expect(page.locator(".friend-preview-card")).toHaveCount(1);
  const scrollable = await page.locator(".room-grid-scroll").evaluate((element) => element.scrollHeight > element.clientHeight);
  expect(scrollable).toBe(true);
  await page.getByLabel("Tìm Room ID").fill("ZZZZZZ");
  await page.getByRole("button", { name: "Tìm" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Phòng đấu không tồn tại" })).toBeVisible();
});

test("room browser applies realtime room-list sync without a refresh", async ({ page }) => {
  const room = { roomId: "AB23CD", name: "Phòng đầu tiên", players: 1, playerCapacity: 2, waitingPlayerRating: 1200, mode: "UNRANKED", visibility: "PUBLIC", timerSeconds: 300, spectators: 0, spectatorsEnabled: false, spectatorCapacity: null, status: "WAITING" };
  const nextRoom = { ...room, roomId: "EF45GH", name: "Phòng mới" };
  await page.addInitScript((payload) => {
    class RealtimeEventSource { onmessage: ((event: MessageEvent) => void) | null = null; onerror: ((event: Event) => void) | null = null; close() {} constructor(url: string) { if (url.includes("/rooms/events")) window.setTimeout(() => this.onmessage?.({ data: JSON.stringify({ type: "ROOMS_SYNC", rooms: [payload.room, payload.nextRoom] }) } as MessageEvent), 1000); } }
    Object.defineProperty(window, "EventSource", { configurable: true, value: RealtimeEventSource });
  }, { room, nextRoom });
  await page.route("**/auth/me", async (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }) }));
  await page.route((url) => url.pathname === "/rooms", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ rooms: [room] }) }));
  await page.goto("/");
  await expect(page.locator(".room-card")).toHaveCount(2);
});

test("privacy presence preference persists across settings reload", async ({ page }) => {
  const user = { id: "self-user", fullName: "Tôi", displayName: "Tôi", username: "toi_day", theme: "system", avatarPreset: "robot", privacy: { presenceVisibility: "FRIENDS", friendListVisibility: "PRIVATE", fullNameVisibility: "PRIVATE" }, stats: { elo: 1000, rankedWins: 0, rankedLosses: 0, quickWins: 0, quickLosses: 0 } };
  await page.route("**/auth/me", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user }) }));
  await page.route("**/profiles/me", async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    const input = route.request().postDataJSON() as { presenceVisibility: "FRIENDS" | "NOBODY" };
    user.privacy.presenceVisibility = input.presenceVisibility;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user }) });
  });
  await page.goto("/cai-dat");
  await page.getByRole("tab", { name: "Riêng tư" }).click();
  const presence = page.getByLabel("Trạng thái hiện diện");
  await presence.selectOption("NOBODY");
  await expect(presence).toHaveValue("NOBODY");
  await page.reload();
  await page.getByRole("tab", { name: "Riêng tư" }).click();
  await expect(page.getByLabel("Trạng thái hiện diện")).toHaveValue("NOBODY");
});
