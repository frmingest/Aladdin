import { expect, test as setup } from "@playwright/test";
import { E2E_API } from "../support/api";

/**
 * Runs once before the regression project. It does three things, and stops the run if any of them fails:
 *
 * 1. waits for the backend (/health) and for the database to be reachable with every migration applied;
 * 2. switches demo mode ON (PUT /settings/demo-mode), the one write this suite makes. In demo mode every page shows the
 *    same fabricated data (backend/app/services/settings/synthetic_data.py), real data is never read, and every other
 *    write is refused with 403 (backend/app/services/settings/demo_guard.py);
 * 3. checks that demo mode really is on, so a test run can never be mistaken for a run on real data.
 *
 * This only ever targets E2E_API_URL, a throw-away stack. Never point it at the Railway backend.
 */
setup("the stack is up and in demo mode", async ({ request }) => {
  setup.setTimeout(120_000);

  await expect
    .poll(async () => (await request.get(`${E2E_API}/health`).catch(() => null))?.status(), {
      message: `backend answers on ${E2E_API}/health`,
      timeout: 90_000,
      intervals: [1_000],
    })
    .toBe(200);

  const status = await request.get(`${E2E_API}/system/status`);
  expect(status.status()).toBe(200);
  const body = await status.json();
  expect(body.database_ok, "database reachable").toBe(true);
  expect(body.migration_current, "database migration matches the code").toBe(body.migration_head);

  const on = await request.put(`${E2E_API}/settings/demo-mode`, { data: { enabled: true } });
  expect(on.status()).toBe(200);
  const state = await request.get(`${E2E_API}/settings/demo-mode`);
  expect((await state.json()).demo_mode, "demo mode is on").toBe(true);
});
