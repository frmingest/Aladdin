import { defineConfig, devices } from "@playwright/test";
export default defineConfig({ testDir: "./e2e", testMatch: ["_p496.tmp.spec.ts"], timeout: 420_000, reporter: "list", workers: 1, use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:5211" } });
