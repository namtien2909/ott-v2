import { expect, test, type Page } from "playwright/test";

async function prepareShell(page: Page) {
  await page.addInitScript(() => {
    class SilentEventSource { onmessage: ((event: MessageEvent) => void) | null = null; onerror: ((event: Event) => void) | null = null; close() {} }
    Object.defineProperty(window, "EventSource", { configurable: true, value: SilentEventSource });
  });
  await page.route("**/auth/me", async (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }) }));
  await page.route("**/health", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", service: "ottv2-server", version: "b14", protocolVersion: "0.1", timestamp: new Date().toISOString(), components: { application: { status: "ok" }, database: { status: "ok" }, realtime: { status: "ok" } } }) }));
  await page.route((url) => url.origin === "http://localhost:3001" && url.pathname === "/rooms", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ rooms: [] }) }));
  await page.route((url) => url.origin === "http://localhost:3001" && url.pathname.startsWith("/social/"), async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ friends: [], requests: [], invites: [] }) }));
  await page.route((url) => url.origin === "http://localhost:3001" && url.pathname.startsWith("/history"), async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matches: [], nextCursor: null, hasMore: false, summary: { elo: 1000, wins: 0, losses: 0, total: 0, winRate: 0 } }) }));
}

test("all public route aliases boot without an app error or horizontal overflow", async ({ page }) => {
  await prepareShell(page);
  const routes = [
    "/", "/home", "/login", "/dang-nhap", "/register", "/dang-ky", "/forgot-password", "/quen-mat-khau",
    "/history", "/lich-su", "/friends", "/ban-be", "/settings?tab=appearance", "/cai-dat?tab=appearance",
    "/guest", "/ai", "/offline", "/game/w1-demo", "/room/w1-demo", "/phong/w1-demo", "/route-does-not-exist",
  ];
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator("#root"), route).toBeVisible();
    await expect(page.locator(".app-error")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), route).toBe(true);
  }
});

test("theme, motion and audio defaults remain deterministic across the release matrix", async ({ page }) => {
  await prepareShell(page);
  for (const theme of ["light", "dark", "system"] as const) {
    for (const motion of ["normal", "reduced"] as const) {
      await page.addInitScript(({ theme: nextTheme, motion: nextMotion }) => {
        localStorage.setItem("ottv2.theme", nextTheme);
        localStorage.setItem("ottv2:reduced-motion", nextMotion === "reduced" ? "on" : "off");
        localStorage.removeItem("ottv2:bgm");
      }, { theme, motion });
      await page.goto("/settings?tab=audio");
      await expect(page.getByRole("heading", { name: "Cài đặt" })).toBeVisible();
      await expect(page.getByLabel("Nhạc nền BGM")).not.toBeChecked();
      await expect(page.locator("html")).toHaveAttribute("data-reduced-motion", motion === "reduced" ? "true" : "false");
      const resolvedTheme = await page.locator("html").getAttribute("data-theme");
      expect(theme === "system" ? ["light", "dark"] : [theme]).toContain(resolvedTheme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
  }
});
