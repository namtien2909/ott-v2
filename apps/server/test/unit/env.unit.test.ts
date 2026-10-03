import { describe, expect, it } from "vitest";

import { loadEnv } from "../../src/config/env.js";

describe("loadEnv", () => {
  it("parses defaults and an origin allowlist", () => {
    const env = loadEnv({
      DATABASE_URL: "postgresql://user:password@localhost:5432/ottv2_test",
      CORS_ORIGINS: "http://localhost:5173, http://127.0.0.1:5173"
    });
    expect(env.PORT).toBe(3001);
    expect(env.corsOrigins).toEqual(["http://localhost:5173", "http://127.0.0.1:5173"]);
  });

  it("adds Render's canonical service URL without allowing a wildcard", () => {
    const env = loadEnv({
      DATABASE_URL: "postgresql://user:password@localhost:5432/ottv2_test",
      CORS_ORIGINS: "https://legacy.example",
      RENDER_EXTERNAL_URL: "https://ott-v2.onrender.com/"
    });
    expect(env.corsOrigins).toEqual(["https://legacy.example", "https://ott-v2.onrender.com"]);
    expect(env.corsOrigins).not.toContain("*");
  });

  it("reports invalid variable names without echoing values", () => {
    const secret = "a-value-that-must-not-be-logged";
    try {
      loadEnv({ DATABASE_URL: secret, PORT: "invalid" });
      throw new Error("expected loadEnv to fail");
    } catch (error) {
      expect(String(error)).toContain("PORT");
      expect(String(error)).not.toContain(secret);
    }
  });

  it("fails closed for unsafe production origins and incomplete PlayHTML", () => {
    expect(() => loadEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:password@db.example:5432/ottv2",
      CORS_ORIGINS: "http://localhost:3000"
    })).toThrow("CORS_ORIGINS");

    expect(() => loadEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:password@db.example:5432/ottv2",
      CORS_ORIGINS: "https://ottv2-web.onrender.com",
      REALTIME_ADAPTER: "playhtml"
    })).toThrow("PLAYHTML_ENDPOINT, PLAYHTML_PROJECT_ID");
  });
});
