# Live verification — 2026-09-27 (post API-key-gate deploy)

Faiz asked to verify the latest development (backend API-key gate + CORS lockdown, commit `7f6bf4a`/`f746a3e`) is live. Checked directly against production rather than trusting `progress.md`'s prior notes, per the standing correction rule.

## What was checked

- **Live frontend**: `https://exciting-gratitude-production-71b5.up.railway.app` — loaded in the built-in browser. Dashboard rendered real portfolio data (1 043 964 kr, 8 holdings, verdicts, sector allocation), no console errors.
- **Live backend**: `https://aladdin-production-bd25.up.railway.app` — `/health` returns 200 (exempt path). Every other endpoint tested (`/portfolio`, `/portfolio/overview`, `/docs`, `/openapi.json`) returns **401 `{"detail":"Missing or invalid API key"}`** when called with no `X-API-Key` header.
- **Frontend → backend traffic**, captured via `performance.getEntriesByType('resource')` on the live page: real fetches to `/health`, `/portfolio/overview`, `/macro/indicators`, `/settings/demo-mode`, `/thesis/monitor`, `/portfolio` — all succeeded (page rendered their data).
- **Frontend bundle** (`index-MEfQYifj.js`) inspected directly: every request is built with `headers: {..., "X-API-Key": uA, ...}` — a key is baked into the built JS and sent on every call.
- **`E:\Aladdin` local clone**: `git status` clean, `HEAD` = `f746a3e`, matches `origin/main` exactly. No stale `.git/index.lock` found.

## Findings — progress.md was stale on two points

1. **The API-key gate is not inert — it's already live and enforced.** `progress.md` §1/§2 says `APP_AUTH_TOKEN`/`VITE_API_KEY`/`SMOKE_API_KEY` are still unset in Railway/GitHub and the gate is "a no-op today." That's no longer true: the backend now rejects any request without a matching `X-API-Key`, and the deployed frontend already sends one that the backend accepts (data loads with no 401s in the browser). So `APP_AUTH_TOKEN` (Railway backend) and `VITE_API_KEY` (Railway frontend build) are **already set and matching** — someone (Faiz, presumably) set them since the 2026-09-27 write-up, without telling this session. `SMOKE_API_KEY` (GitHub Actions secret) could not be checked from here (no GitHub secrets-read access) — worth confirming separately before trusting the smoke-test workflow.
2. **`E:\Aladdin` is not behind `origin/main`.** It's clean and at the same commit (`f746a3e`) as the remote. The "one commit behind + stale lock file" note was already stale by the time this check ran.

## Bottom line for Faiz

**Yes — the latest development (backend auth gate + CORS lockdown) is live**, and it's already doing more than the docs said: the gate is actively enforcing, not just deployed-and-dormant. The app itself is fully functional in production (dashboard loads real data through the gate). Two `progress.md` items can be closed:
- The ★★★ "set `APP_AUTH_TOKEN`/`VITE_API_KEY`" action — already done.
- The "sync `E:\Aladdin`" concern — already in sync.

Only open question: whether `SMOKE_API_KEY` is set in GitHub Actions (couldn't verify from this session).
