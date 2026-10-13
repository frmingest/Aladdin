# Hardening sprint (2026-10-12)

Status (2026-10-13): the baseline merged to `main` with #121. The remainder (error states, LLM-failure messages, upload edge cases, Lighthouse and phone-width pass) is on `fix/hardening-remainder`, written, not merged, not deployed; see section 4.

Branch `hardening-sprint`, cut from `feature/design-sprint-11-circle` (which sits on Sprint 9). Tag `pre-hardening` marks the state before any change. Merge order: Sprint 9, Sprint 11, then this branch. No new graphics until it is merged.

## 1. Baseline (before any fix)

| Check | Result |
|---|---|
| Backend `pytest` | 1795 passed, 2 skipped, **2 failed** (`test_factory.py`: they read the local `backend/.env`, which selects Ollama) |
| Backend `ruff check` | clean (the only hits were `EXE002` on the Windows mount, not real) |
| Backend `mypy app` | 172 errors in 52 files (not part of CI): 67 arg-type, 32 union-attr, 14 assignment, 13 attr-defined, 10 operator, 10 import-untyped (missing stubs), 3 name-defined |
| Frontend `tsc` | 0 errors on a clean `npm ci`. Faiz's local `node_modules` is stale (no `@types/node`), so a local `tsc` shows 10 false errors in `artAssets.test.ts` |
| Frontend `eslint` | 0 errors, 2 warnings (fast-refresh exports in `demoMode.tsx`, `gameMode.tsx`); the config exists |
| Frontend `vitest` | 654 of 655 passed. The one failure is local only: git-ignored masters in `public/art` are over 150 KB (CI has none) |
| Frontend `vite build` | succeeds. Largest chunks (gzip): recharts 103 KB, FortressPage 43 KB, index 71 KB, HoldingDetailPage 35 KB |
| Art set | 87 pictures, **1996 KB of the 2000 KB budget** |

## 2. Defects: found, fixed, left

Fixed on this branch
- Tests read the developer's `backend/.env` (2 failures locally, none in CI). New `backend/tests/conftest.py` switches the `.env` file off, so a local run matches CI. Suite after the fix: **1797 passed, 2 skipped, 0 failed**.
- `app/services/game/demo.py`: three return types (`ChronicleOut`, `RavensOut`, `NightWatchOut`) were used without an import and hidden with `noqa`. Now imported; mypy errors 172 to 169.

Already done (my earlier list was stale)
- `eslint.config.js` exists and lint runs.
- Evidence budget per document exists (`MAX_DOCUMENT_SHARE` in `document_excerpts.py`).

Left, with reason
- 169 mypy errors: mostly type-narrowing noise, not in CI. Proposal: add `mypy` to CI as report-only, fix by package in later sprints, add stubs (pandas, openpyxl, fitz, yfinance, boto3, apscheduler).
- Dashboard macro chart showing only the original six series: not re-checked (Dashboard was rebuilt in Phase 11).
- ECON-007 (regime-aware risk bands): out of scope for hardening.

## 3. Tests added

- `frontend/e2e/game-pages.spec.ts`: all 8 game pages at 360 px and 1280 px with game mode on, each also with `?art=stitch`, plus a reload/switch-off check of game mode. It fails on an uncaught error, an API 5xx, a missing heading, a stuck "Loading…" or a sideways scroll. Lists 41 tests with the existing smoke file. **Not yet run against the live site** (needs `SMOKE_FRONTEND_URL`, `SMOKE_API_URL` and Playwright browsers).

## 3b. Live check (2026-10-12, built-in browser, phone width 375 px)

Opened the deployed frontend and visited all 8 game pages (`/fortress`, `/siege`, `/chronicle`, `/council`, `/records`, `/circle`, `/map`, `/marketplace`).
- Game mode off: every page shows its heading, no "Loading…" left, no sideways scroll.
- Game mode on (the `aladdin-game-mode` switch, then removed again): every page shows its heading, the study skin is applied, no sideways scroll.
- Console: no errors on the Siege page or on the Marketplace page.
- Not checked: desktop width, Object art on (`?art=stitch` would change the stored setting), the Playwright spec itself (needs `SMOKE_API_URL`, a key if `APP_AUTH_TOKEN` is set, and Playwright browsers), and which sprint's code is deployed.

## 4. Remainder, done 2026-10-13 (branch `fix/hardening-remainder`, written, not merged, not deployed)

Worked in a cloud checkout cut from `main` at `9c5e5c1` (#124). Everything below ran against a local backend on SQLite in demo mode and a local frontend, not the live site.

**Error and empty states (all 8 game pages).**
- Found: `ApiError` printed a proxy error page (502/504) as its message, and Council, Records, Circle, Chronicle and Cartographer showed a bare "Could not load X." with no way to retry.
- Fixed: `lib/errorText.ts` and `lib/errors.ts` turn any failure into one or two plain sentences and say whether retrying can help; shared `LoadError` (`role="alert"`, 44 px "Try again"); `ApiError` never carries HTML, a stack trace or a dump longer than 200 characters. Night Watch's error text uses it too.
- Verified: unit tests (helper, component) and `e2e/game-errors.spec.ts` (16 cases: 502 HTML page and unreachable server on each page; the button re-sends the request; no raw markup). Needs no backend.

**LLM-failure messages.**
- Found: a failed run stored the vendor's own text (a Gemini quota error with a multi-KB JSON body) and the analysis panel, the queue and the 503 body printed it.
- Fixed: `app/services/llm_errors.py` maps the text to one sentence (daily budget, quota or rate limit, missing key, refused key, Ollama down, Ollama model missing, retired model, timeout, context too large, output cut off, overloaded, empty answer, wrong format) followed by the first 160 characters of the original. Used for pipeline failure messages and the `LLMUnavailableError` 503; other providers keep their own 503 text. When a run fails or falls back is unchanged.
- Verified: 23 new tests, including the stored run message and the 503 body.

**Upload edge cases.**
- Found: all already failed cleanly with a readable 4xx (empty, corrupt or mislabeled PDF/XLSX, undecodable CSV, header-only CSV, oversize, duplicates, unicode and 200-character names), except one: a filename such as `../../../x.xlsx` was accepted and local storage wrote it above the storage folder (key is `<sha256>/<filename>`; local storage is development only, S3 keys do not traverse).
- Fixed: `safe_filename()` (last path segment, control characters dropped, long names shortened, ordinary names unchanged) in document intake and the portfolio CSV import; local storage refuses any key that resolves outside its folder.
- Verified: 26 edge-case tests; the path test fails without the fix (my first version was too weak to see it and the stray file was removed).

**Lighthouse (mobile, production build, game mode on, demo data) and phone width.**
- First run was invalid (the test backend blocked the page's requests, so Lighthouse scored error screens); redone with a working backend.
- Found and fixed: invalid `<dl>` markup in the three HUD strips; inline links told apart from text by colour only; 12 px chips at 4.19:1 on the raised panel; an `h3` straight under the `h1` on Records; stall links whose short `aria-label` hid price and verdict; tower buttons whose label left out the visible weight; the Night Watch card rendering nothing while loading and then pushing the scene down.
- Result: accessibility 100 on Fortress, Records, Marketplace, Council and Circle (re-run after the fixes; Siege, Chronicle and Map were 96 to 100 before and were not re-run); best practices 96 everywhere (the one miss is the Google Fonts request, blocked in this workspace); performance 95 to 100 on seven pages.
- Not fixed: Fortress performance 73 to 82 (blocking time 140 to 280 ms, React drawing the scene); layout shift 0.31 remains on Fortress in demo mode (0.117 is the demo banner appearing, which only exists in demo mode; the rest is the demo dispatch being a loud night, taller than the reserved space; a quiet real night should shift far less, not measured).
- Reduced motion checked on all 8 pages: 0 running animations with it on (2 to 36 per page with it off); no sideways scroll at 390 px.
- `e2e/game-pages.spec.ts` ran for the first time: 33 of 33 passed (phone, desktop, 2560, 3840, reload check), against the local stack.

**Left, with reason.**
- Visual-regression baselines: need the live site and real data.
- The browser specs against the live site: after the deploy.
- Fortress scene cost, mypy (169 errors, report-only job proposed), the Dashboard macro chart, ECON-007: see `docs/PROGRESS.md`.

## 5. Graphics guidelines

Written: [docs/reference/GRAPHICS_GUIDELINES.md](../reference/GRAPHICS_GUIDELINES.md). The art budget was full (1996 of 2000 KB) and is now 2800 KB (`MAX_TOTAL_KB` in `artAssets.test.ts`), room for about 30 more pictures at the current 23 KB average.
