import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("W12 production deployment contract", () => {
  it("defines one Render service that builds and serves the SPA", () => {
    const blueprint = read("render.yaml");
    expect(blueprint).toContain("name: ottv2-api");
    expect(blueprint).toContain("healthCheckPath: /health");
    expect(blueprint).toContain("corepack pnpm --filter @ottv2/web build");
    expect(read("apps/server/src/plugins/web-app.ts")).toContain('app.get("/*"');
    expect(read("apps/server/src/app.ts")).toContain("registerWebApp");
    expect(blueprint).not.toContain("runtime: static");
    expect(blueprint).toContain("key: DATABASE_URL");
    expect(blueprint).toContain("key: CORS_ORIGINS");
    expect(blueprint).toContain("key: VITE_API_BASE_URL");
  });

  it("keeps local and production examples free of the stale port 8000", () => {
    expect(read(".env.example")).toContain("CORS_ORIGINS=http://localhost:3000");
    expect(read(".env.example")).not.toContain("localhost:8000");
    expect(read("apps/server/src/config/env.ts")).toContain('default("http://localhost:3000")');
    expect(read(".env.production.example")).toContain("NODE_ENV=production");
    expect(read("apps/web/.env.production.example")).toContain("VITE_API_BASE_URL=");
    expect(read("playwright.config.ts")).toContain("http://127.0.0.1:4173");
  });

  it("documents explicit production-only secrets and realtime boundary", () => {
    const blueprint = read("render.yaml");
    expect(blueprint).toContain("REALTIME_ADAPTER");
    expect(blueprint).toContain("PLAYHTML_ENDPOINT");
    expect(blueprint).toContain("PLAYHTML_PROJECT_ID");
    expect(read("docs/W12_IMPLEMENTATION_PLAN.md")).toContain("không commit secrets");
  });

  it("keeps production config fail-closed for loopback CORS and incomplete realtime", () => {
    const env = read("apps/server/src/config/env.ts");
    expect(env).toContain("Invalid environment configuration: CORS_ORIGINS");
    expect(env).toContain("Invalid environment configuration: PLAYHTML_ENDPOINT, PLAYHTML_PROJECT_ID");
  });
});
