import { expect, test } from "playwright/test";

test("legacy Guest Arena play URL redirects to normal Offline2P", async ({ page }) => {
  await page.goto("/guest/play");
  await expect(page).toHaveURL(/\/offline$/);
  await expect(page.getByRole("heading", { name: "Hai người một máy" })).toBeVisible();
});

test("Guest onboarding exposes one stable generated display name", async ({ page }) => {
  await page.goto("/guest");
  const name = page.getByLabel("Tên khách");
  await expect(name).toHaveValue(/^Khách /);
  await expect(name).toHaveAttribute("readonly", "");
});

test("two tabs without Web Locks never overlap Guest bootstrap", async ({ page }) => {
  const context = page.context();
  await context.addInitScript(() => Object.defineProperty(navigator, "locks", { configurable: true, value: undefined }));
  const second = await context.newPage();
  let active = 0;
  let maxActive = 0;
  const cookiesSeen: string[] = [];
  await context.route("**/guest/session", async (route) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    cookiesSeen.push(route.request().headers().cookie ?? "");
    await new Promise((resolve) => setTimeout(resolve, 250));
    active -= 1;
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "set-cookie": "ottv2_guest=stable; Path=/; HttpOnly" }, body: JSON.stringify({ principal: "GUEST", displayName: "Khách Test" }) });
  });
  await context.route("**/rooms/LOCKA/spectate", (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ code: "UNAUTHORIZED", message: "Cần đăng nhập" }) }));
  await Promise.all([page.goto("/spectate/LOCKA"), second.goto("/spectate/LOCKA")]);
  await expect(page.getByRole("heading", { name: "Cần mật khẩu phòng" })).toBeVisible();
  await expect(second.getByRole("heading", { name: "Cần mật khẩu phòng" })).toBeVisible();
  expect(maxActive).toBe(1);
  expect(cookiesSeen).toContain("");
  expect(cookiesSeen.length).toBe(2);
  await second.close();
});
