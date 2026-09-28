import AxeBuilder from "@axe-core/playwright";
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
  return {
    matchId: "b1300000-0000-4000-8000-000000000001",
    roomId: "B13QA1",
    mode: "UNRANKED",
    status: "PLAYING",
    players: [
      { userId: "blue-user", username: "blue_user", displayName: "Người chơi Xanh", side: "BLUE", ready: true, connected: true },
      { userId: "red-user", username: "red_user", displayName: "Người chơi Đỏ", side: "RED", ready: true, connected: true },
    ],
    board: initialBoard(),
    pieceCounts: { BLUE: { R: 3, P: 3, S: 3 }, RED: { R: 3, P: 3, S: 3 } },
    currentTurn: "BLUE",
    winner: null,
    resultReason: null,
    clocksMs: { BLUE: 60000, RED: 60000 },
    timerSeconds: 60,
    countdownEndsAt: null,
    startedAt: Date.now(),
    endedAt: null,
    sequence: 1,
    stateVersion: 1,
    rating: null,
    rematchRequestedBy: null,
  };
}

async function preparePublicShell(page: Page) {
  await page.addInitScript(() => {
    class SilentEventSource { onmessage: ((event: MessageEvent) => void) | null = null; onerror: ((event: Event) => void) | null = null; close() {} }
    Object.defineProperty(window, "EventSource", { configurable: true, value: SilentEventSource });
  });
  await page.route("**/auth/me", async (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }) }));
  await page.route("**/health", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", service: "ottv2-server", version: "test", protocolVersion: "0.1", timestamp: new Date().toISOString(), components: { application: { status: "ok" }, database: { status: "ok" }, realtime: { status: "ok" } } }) }));
}

async function expectNoSeriousA11yViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
  expect(serious, `${label}: ${serious.map((violation) => `${violation.id} (${violation.nodes.length})`).join(", ")}`).toEqual([]);
}

test.describe("B13 cross-cutting accessibility and responsive QA", () => {
  test("axe scans representative public, auth and recovery screens", async ({ page }) => {
    await preparePublicShell(page);
    for (const [route, heading] of [["/", /Đọc vị.*Chiếm bàn/i], ["/login", "Chào mừng trở lại"], ["/not-found-b13", "Trang này không tồn tại"]] as const) {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: heading, exact: typeof heading === "string" })).toBeVisible();
      await expectNoSeriousA11yViolations(page, route);
    }
  });

  test("axe scans history, social, settings and local setup families", async ({ page }) => {
    await preparePublicShell(page);
    await page.route("http://localhost:3001/history?*", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matches: [], nextCursor: null, hasMore: false, summary: { elo: 1000, wins: 0, losses: 0, total: 0, winRate: 0 } }) }));
    await page.route("http://localhost:3001/social/*", async (route) => {
      const path = new URL(route.request().url()).pathname;
      const body = path.endsWith("/friends") ? { friends: [] } : path.endsWith("/invites") ? { invites: [] } : { requests: [] };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    for (const [route, heading] of [["/history", "Lịch sử đấu"], ["/friends", "Bạn bè"], ["/settings?tab=appearance", "Cài đặt"], ["/guest", /Chơi nhanh với tư cách khách/i]] as const) {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: heading, exact: typeof heading === "string" })).toBeVisible();
      await expectNoSeriousA11yViolations(page, route);
    }
  });

  test("keyboard board keeps one roving tab stop and Escape clears selection", async ({ page }) => {
    await preparePublicShell(page);
    await page.route("http://localhost:3001/matches/B13QA1?*", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ match: matchSnapshot(), viewerSide: "BLUE" }) }));
    await page.goto("/game/B13QA1");
    await expect(page.getByRole("grid", { name: "Bàn cờ OTTv2 9 nhân 9" })).toBeVisible();
    const gridcells = page.getByRole("gridcell");
    await expect(gridcells).toHaveCount(81);
    await expect(page.locator(".game-board [tabindex='0']")).toHaveCount(1);
    const piece = page.getByRole("gridcell", { name: /Ô b1, Quân Đấm phe Xanh/ });
    await piece.focus();
    await page.keyboard.press("Enter");
    await expect(piece).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Escape");
    await expect(piece).toHaveAttribute("aria-selected", "false");
    await expectNoSeriousA11yViolations(page, "/game/B13QA1");
  });

  test("reduced motion forces low visual tier and keeps the shell usable", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await preparePublicShell(page);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-reduced-motion", "true");
    await expect(page.locator("html")).toHaveAttribute("data-quality-tier", "low");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test("screen matrix has no horizontal overflow at supported widths", async ({ page }) => {
    await preparePublicShell(page);
    for (const viewport of [{ width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/login");
      await expect(page.getByRole("heading", { name: "Chào mừng trở lại" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
  });
});
