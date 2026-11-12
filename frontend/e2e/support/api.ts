/** Where the throw-away stack's backend answers (see playwright.config.ts, project "regression"). */
export const E2E_API = (process.env.E2E_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
