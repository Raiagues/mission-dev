import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/mission-dev/",
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
