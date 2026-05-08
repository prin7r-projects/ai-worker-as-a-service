// apps/app/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "postgres://shiftledger:shiftledger@localhost:5432/shiftledger",
    },
  },
});
