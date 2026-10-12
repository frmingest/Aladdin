# Hardening sprint (2026-10-12)

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

## 4. Still to do in this sprint

- Empty, loading and error states: walk each game page with the API down.
- LLM failure messages (Ollama offline, Google quota or 404).
- Upload edge cases (bad encoding, empty file, duplicate).
- Lighthouse run, phone-width visual check, reduced-motion and contrast check on the art pages.
- Visual-regression baselines (needs the live site and real data).

## 5. Graphics guidelines

Written: [GRAPHICS_GUIDELINES.md](GRAPHICS_GUIDELINES.md). The art budget was full (1996 of 2000 KB) and is now 2800 KB (`MAX_TOTAL_KB` in `artAssets.test.ts`), room for about 30 more pictures at the current 23 KB average.
