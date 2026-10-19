# Housekeeping: code, features and docs (2026-10-19)

Faiz asked for a pass over all code and features, then updated technical docs and diagrams. This is the
report. **Docs only: no code, migration or config was changed.** Source of truth was a fresh clone of
`main` at `4d0ce8b` (PR #185, merged 2026-10-18 22:24). The live Railway services were not queried.

## What the code actually contains today

| Thing | Count / state |
|---|---|
| Backend (`backend/app`) | ~47,000 lines of Python; 21 routers, 127 routes |
| Backend tests | 160 test files, ~1,670 test functions |
| Frontend (`frontend/src`) | ~50,000 lines of TypeScript; 25 routes, 92 test files; Playwright smoke and game specs in `e2e/` |
| Tables | 42 mapped by models; 3 more exist only in migrations (`investment_theses`, `valuation_cases`, `winter_orders`) |
| Migrations | 41 files, one head `x1f2a3b4c5d6` |
| Analysis paths | 4: equity, fund, income (bond and money-market funds), commodity (ETCs) |
| Background jobs | 1 in the backend (macro refresh) and 6 housekeeping jobs plus the queue in the PC worker |
| Providers | 3 LLMs (Gemini, Mistral, Ollama), 2 research (Gemini search, Tavily), yfinance, FRED, Norges Bank, SSB, SEC EDGAR, Newsweb, filings.xbrl.org, Xtrackers, LGIM, gold-api.com, R2 storage |
| Open PRs | 0 (all of #155 to #185 merged) |

## What was out of date, and what changed

| Doc | Was wrong or missing | Now |
|---|---|---|
| `architecture.md` (written 2026-09-30) | Supabase as database and storage; "20 routers"; no tag-review, game endpoints beyond two, instrument paths other than fund; Alembic head `q1c8d9e0f1a2`; 6 missing tables; only 2 diagrams; Council and Chronicle era | Rewritten. 7 diagrams (system, analysis sequence, four analysis paths, background jobs, entity relationships, game mode data flow, frontend routes), job table with real hours, hosting corrected, known-gaps section. Every diagram was rendered with the Mermaid CLI to prove it parses |
| `PROGRESS.md` | Listed about ten PRs as "written, not merged" that had all merged; `main` pointer was `30f0cb9` | Rewritten to the 4-section rule (31 lines); merged work moved to the archive |
| `archive/progress-archive.md` | Nothing after 2026-10-14 | New 2026-10-19 block for #155 to #185 |
| `reference/llm-and-technology-overview.md` | Supabase Postgres and storage; "1,450 tests" | Railway Postgres, R2, ~1,670 tests; broken link to `architecture.md` fixed |
| `reference/AI-VS-DETERMINISTIC.md` | Game backend described as two endpoints; no income or commodity paths, tag review, prompt log, then-and-now | Updated |
| `reference/local-llm-ollama-setup.md` | "Supabase database", "Supabase session pooler" | Railway Postgres (public URL from the PC) |
| `CLAUDE.md` | "Postgres (Supabase)" and "The Supabase database was wiped" | Says Supabase was retired 2026-10-14; the wipe history is kept |
| `docs/README.md` | Two game docs not indexed; "Railway/Supabase runbook" label | Added both, new housekeeping doc, label fixed |
| Links | 19 broken relative links | 4 fixed (checklist, archive, tech overview, sprint 29). The other 15 are all in the frozen `archive/PROGRESS-full-2026-09-30.md` and point at write-ups that were deleted; left alone because it is a historical snapshot |

## Loose ends found (not changed)

1. **Supabase leftovers in code and config.** `backend/.env.example` still shows Supabase connection strings
   as the example; `config/database.py` says "Postgres (Supabase) is the system of record"; `factory.py` and
   `system_status.py` accept `supabase` as a storage name. Harmless, misleading. Clean up with the next backend change.
2. **The Supabase-to-Railway runbook is not in `main`.** It exists only in the local checkout
   (`docs/supabase-to-railway-postgres-runbook-2026-10-09.md`, flat, uncommitted) and its status line still says
   "written, not run". It should be committed (in `docs/ops/`) with its status updated by Faiz, who ran the move.
3. **Legacy tables have live foreign keys.** `portfolio_risk_snapshots` and `llm_usage_events` reference
   `analysis_runs` / `holding_analyses`. CLAUDE.md already says to leave legacy tables, but "never queried" is not
   quite true of their foreign keys, so a future drop needs a migration plan.
4. **`winter_orders` is an orphan table** (feature removed in #165, migration kept on purpose).
5. **The local checkout is stale and busy.** `E:\Aladdin` is on `feature/records-hall-polish`, 39 commits behind
   `origin/main`, with 231 modified or untracked entries (many are old flat copies of docs that `main` now keeps in
   topic folders; others are real uncommitted work, e.g. `backend/scripts/migrate-db-to-railway.ps1`). Nothing there was
   touched. Pull `main` onto a clean branch before the next piece of work, and expect `docs/PROGRESS.md` and
   `docs/README.md` to conflict with the old local edits.
6. **Stray files in the local repo root** (untracked there, not in `main`): `.map-fix.patch`, `sprint29.patch`,
   `.stale-worktree-2026-10-14.patch`, `.sync-backup-2026-10-11/`, `game-mode-noise-audit-2026-10-07.local-copy.md`,
   `docs/zioa0Vh0`, `docs/drawing-code-export.zip`. Faiz decides whether to delete them.
7. **Dashboard macro chart and mypy** are unchanged from `PROGRESS.md` (six series only; 166 findings).

## How it was checked

- Routes: counted `@router.` decorators (127) and read each router's prefix.
- Tables: `__tablename__` in the models against `create_table` / `drop_table` in the migrations.
- Migration head: followed `down_revision` links.
- Relationships in the ER diagram: every arrow is a `ForeignKey` in the models.
- Jobs and hours: `worker/runner.py::_background_jobs` and `config/settings.py`.
- Open PRs: GitHub REST API.
- Diagrams: each Mermaid block rendered with `@mermaid-js/mermaid-cli`; the jobs, ER and game diagrams were also looked at as images.
- Links: every relative markdown link in `docs/`, `README.md` and `CLAUDE.md` resolved against the file system.
