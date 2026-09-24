import { defineConfig } from "vitest/config";

// Unit tests only (src/**/*.test.ts). The Playwright smoke test in e2e/
// runs separately with `npm run smoke`.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
