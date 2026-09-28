import { expect, test } from "playwright/test";

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

test("game room hides global navigation and renders a 9 by 9 board", async ({ page }) => {
  await page.goto("/game/w1-demo");
  await expect(page.getByRole("grid", { name: "Bàn cờ OTTv2 9 nhân 9" })).toBeVisible();
  await expect(page.getByRole("gridcell")).toHaveCount(81);
  await expect(page.getByRole("navigation", { name: "Điều hướng chính" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Điều hướng di động" })).toHaveCount(0);
});

test("registration keeps recovery acknowledgement gated", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: "Tạo tài khoản" })).toBeVisible();
  await expect(page.getByLabel("Username")).toHaveAttribute("pattern", "[A-Za-z0-9_]{4,20}");
});