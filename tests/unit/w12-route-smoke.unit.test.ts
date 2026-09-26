import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("W12 canonical route and frontend sanity contract", () => {
  it("keeps every UI-spec canonical route in the route map", () => {
    const routes = read("apps/web/src/app/routes.ts");
    for (const route of [
      "/login", "/register", "/forgot-password", "/home", "/queue", "/room/:roomId",
      "/game/:roomId", "/history", "/history/:matchId", "/profile/:username", "/friends", "/settings"
    ]) expect(routes).toContain(route);
  });

  it("keeps the document and CSS accessibility/responsive hooks present", () => {
    const html = read("apps/web/index.html");
    const css = read("apps/web/src/styles/globals.css");
    expect(html).toContain('<html lang="vi">');
    expect(html).toContain('name="viewport"');
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("@media");
    expect(css).toContain(":focus-visible");
  });
});
