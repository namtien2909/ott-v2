import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@ottv2/contracts": fileURLToPath(new URL("./packages/contracts/src/index.ts", import.meta.url)),
      "@ottv2/game-rules": fileURLToPath(new URL("./packages/game-rules/src/index.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: [
      "tests/unit/**/*.unit.test.ts",
      "tests/contract/**/*.contract.test.ts",
      "tests/integration/**/*.integration.test.ts",
    ],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    restoreMocks: true,
    clearMocks: true,
  },
});
