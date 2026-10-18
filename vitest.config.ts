import { defineConfig } from "vitest/config";
import { getTestDatabaseUrl } from "./tests/helpers/testDatabaseUrl";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/globalSetup.ts"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: getTestDatabaseUrl(),
    },
    // All test files share one database schema, so run them one at a time
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
