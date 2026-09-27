# Backend auth gate + CORS lockdown — 2026-09-27

Builds the ★★★ item from [agentic-coding-audit-2026-09-27.md](agentic-coding-audit-2026-09-27.md)
findings #1–#2: every endpoint was open to the internet with no authentication, CORS was
`allow_origins=["*"]`, and `frontend/.env.example` documented an `APP_AUTH_TOKEN`/`VITE_API_KEY`
scheme that had never actually been implemented on either side.

## What changed

**Backend** (`backend/app/security.py`, new):
- `ApiKeyMiddleware` — a Starlette middleware requiring `X-API-Key: <APP_AUTH_TOKEN>` on every
  request once `Settings.app_auth_token` is set. **No-ops entirely while it's unset**, which is the
  default for local dev and CI — nothing changes there.
- Exempt paths: `/health` (Railway's healthcheck and the smoke test's uptime probe hit this with no
  headers) and `OPTIONS` (CORS preflight never carries a custom header).
- Reads the token fresh via `get_settings()` on every request rather than capturing it once at
  app-construction time, so tests can flip it with `get_settings.cache_clear()` + `monkeypatch`.
- Wired into `app/main.py` **before** `CORSMiddleware` is added, so CORS ends up outermost
  (Starlette wraps user middleware in reverse of add order) — it handles preflight before the key
  check runs, and adds CORS headers to a 401 response too, not just a 200.
- New settings: `Settings.app_auth_token` (`APP_AUTH_TOKEN`, unset by default) and
  `Settings.cors_allowed_origins` (`CORS_ALLOWED_ORIGINS`, comma-separated, **defaults to the known
  deployed frontend origin** rather than `"*"`).

**Frontend** (`frontend/src/lib/api.ts`):
- Every request now sends `X-API-Key: <VITE_API_KEY>` when `VITE_API_KEY` is set (compile-time,
  baked into the build like `VITE_API_BASE_URL` already was). Unset (default) sends no header,
  matching the backend's own no-auth default.

**Smoke test** (`frontend/e2e/smoke.spec.ts`, `frontend/playwright.config.ts`,
`.github/workflows/smoke.yml`):
- The "pages" tests (real browser via `page.goto`) already get the header for free once Railway's
  frontend build has `VITE_API_KEY` baked in — no change needed there.
- The "API" describe block's direct `request.get()` calls now send an optional `SMOKE_API_KEY`
  header, wired through as a new **GitHub Actions secret** (not a variable, since it's the literal
  key value) in `smoke.yml`. Unset, these calls send no header — same as before this existed.

**Docs**: `backend/.env.example` and `frontend/.env.example` now describe the actual, implemented
mechanism (previously `frontend/.env.example` pointed at a `docs/decisions/0010` that doesn't exist
— removed that dangling reference, per audit finding #2).

## What this is *not*

Not real access control. `VITE_API_KEY` ships in the frontend's built JS bundle — anyone who opens
dev tools can read it. It's a minimal gate against stray/automated requests hitting a public
backend URL that handles real financial data (bots, scanners, crawlers), not a defense against a
targeted attacker. This is the same framing the original `frontend/.env.example` comment used —
now it's actually true.

## Tests

Ran in a fresh clone (`/home/claude/aladdin`, this session's own device-bridge shell hit a disk-full
condition partway through this change — see the correction note below) rather than the usual
`E:\Aladdin`:
- **Backend**: 940 total (6 new, all in `tests/integration/test_api_key_middleware.py`), 939 pass.
  The 1 failure (`test_documents_sources_research_funds_are_blocked_outright_in_demo_mode`) is
  **pre-existing and unrelated** — confirmed by `git stash` + re-running the same test against
  unmodified `main`: it fails identically (a fresh environment with no `.env`/API key hits a 503 from
  the research provider before the demo-mode guard, in both cases).
- **Frontend**: `tsc --noEmit` clean, `eslint` clean on the touched files, `vitest` 19/19 pass,
  `npm run build` clean (same pre-existing bundle-size warning as always, unrelated).
- `ruff check` on every touched/new Python file: clean (a separate pre-existing 15-error batch in
  unrelated test files, confirmed present on unmodified `main` too, left untouched).

No migration — no schema change.

## What Faiz needs to do to actually turn this on

Nothing changes in production until these are set. **Set both together** (a token with no matching
frontend value, or vice versa, means every real request 401s):

1. **Railway (backend)**: set `APP_AUTH_TOKEN` to a real random value (e.g. `openssl rand -hex 32`)
   and, if the frontend ever moves to a different/second origin, add it to
   `CORS_ALLOWED_ORIGINS` (comma-separated) — the current default already covers the one known
   frontend origin.
2. **Railway (frontend build)**: set `VITE_API_KEY` to the **same** value, and redeploy so the new
   build bakes it in.
3. **GitHub**: add a repository secret `SMOKE_API_KEY` with the same value, so the post-deploy smoke
   test's direct API calls keep passing instead of 401ing once the gate is live.

Until all three are set, this is a no-op — the code ships in this change but stays inert.

## Correction: this session's device-bridge shell hit a wall

The change was first built and tested against `E:\Aladdin` through the device-bridge shell as
usual. Partway through, that shell's own sandboxed disk filled up (`/sessions` at 98%, unrelated to
Faiz's real machine — confirmed nothing on the actual PC was at risk) while installing a Linux venv
to run pytest, and separately hit a pre-existing stale `.git/index.lock` in `E:\Aladdin` (the same
issue [flagged in the 2026-09-27 audit](agentic-coding-audit-2026-09-27.md) finding #6) that this
session could not remove. Rather than risk a half-tested or uncommitted change, the same edits were
re-applied from scratch in a fresh clone attached directly to this session's GitHub access
(`/home/claude/aladdin`), fully tested there (see above), committed and pushed from there instead.

**`E:\Aladdin` is now behind `origin/main` by this one commit and still has that stale
`.git\index.lock`.** Faiz: next time you're at that PC, delete
`E:\Aladdin\.git\index.lock` by hand, then `git pull` (or ask Claude to do both from a fresh
device-bridge session — the lock may clear on its own by then).
