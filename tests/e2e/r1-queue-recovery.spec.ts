import { expect, test } from "playwright/test";

const queueId = "00000000-0000-4000-8000-000000000005";

function queueSnapshot(status: "QUEUED" | "CANCELLED") {
  return {
    queueId,
    mode: "RANKED",
    status,
    player: { userId: "self-user", username: "tester", displayName: "Người kiểm thử", elo: 1000 },
    opponent: null,
    range: 100,
    elapsedMs: 0,
    joinedAt: 1_700_000_000_000,
    roomId: null,
    matchId: null,
  };
}

async function prepare(page: import("playwright").Page) {
  await page.addInitScript(() => {
    class SilentEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onopen: (() => void) | null = null;
      constructor() { window.setTimeout(() => this.onopen?.(), 0); }
      close() {}
    }
    Object.defineProperty(window, "EventSource", { configurable: true, value: SilentEventSource });
  });
  await page.route("http://localhost:3001/auth/me", async (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ user: { id: "self-user", username: "tester", displayName: "Người kiểm thử", theme: "system", stats: { elo: 1000, rankedWins: 0, rankedLosses: 0, quickWins: 0, quickLosses: 0 } } }),
  }));
  await page.route("http://localhost:3001/health", async (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      status: "ok",
      service: "ottv2-server",
      version: "test",
      protocolVersion: "0.1",
      timestamp: new Date().toISOString(),
      components: { application: { status: "ok" }, database: { status: "ok" }, realtime: { status: "ok" } },
    }),
  }));
  await page.route("http://localhost:3001/rooms*", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ rooms: [] }) }));
  await page.route("http://localhost:3001/social/**", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ friends: [], requests: [], invites: [] }) }));
  await page.route(`http://localhost:3001/matchmaking/queue/${queueId}/events**`, async (route) => route.fulfill({ status: 200, contentType: "text/event-stream", body: "" }));
}

test("Queue cancel waits for server ACK before leaving the page", async ({ page }) => {
  await prepare(page);
  let deleteCalls = 0;
  await page.route("http://localhost:3001/matchmaking/queue", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ queue: queueSnapshot("QUEUED") }) });
  });
  await page.route(`http://localhost:3001/matchmaking/queue/${queueId}`, async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ queue: queueSnapshot("QUEUED") }) });
    deleteCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 450));
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ queue: queueSnapshot("CANCELLED") }) });
  });

  await page.goto("/queue");
  await expect(page.getByRole("heading", { name: "Đang tìm đối thủ" })).toBeVisible();
  const cancel = page.getByRole("button", { name: "Huỷ tìm trận" });
  await cancel.click();
  await expect(page.getByRole("button", { name: "Đang huỷ…" })).toBeDisabled();
  await expect(page).toHaveURL(/\/queue$/);
  await expect.poll(() => deleteCalls).toBe(1);
  await expect(page).toHaveURL(/\/$/);
});

test("browser Back waits for cancellation and keeps the queue on failed ACK", async ({ page }) => {
  await prepare(page);
  let cancelMode: "failed" | "success" = "failed";
  await page.route("http://localhost:3001/matchmaking/queue", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ queue: queueSnapshot("QUEUED") }) });
  });
  await page.route(`http://localhost:3001/matchmaking/queue/${queueId}`, async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ queue: queueSnapshot("QUEUED") }) });
    if (cancelMode === "failed") return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "TEMPORARY_FAILURE", message: "Tạm thời không thể huỷ." }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ queue: queueSnapshot("CANCELLED") }) });
  });

  await page.goto("/");
  await page.getByRole("link", { name: /TÌM TRẬN RANKED/i }).click();
  await expect(page.getByRole("heading", { name: "Đang tìm đối thủ" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/queue$/);
  await expect(page.getByRole("heading", { name: "Đang tìm đối thủ" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Máy chủ chưa xác nhận huỷ");
  cancelMode = "success";
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});
