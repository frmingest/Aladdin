# Aladdin — Progress

Quick-glance tracker. Full technical detail for each item lives in its own doc (linked below); this
page stays a scan-able table, not a narrative.

**Last updated:** 2026-09-21

## Build phases

| Phase | What it is | Status |
|---|---|---|
| 0–10 | Everything built before the 2026-09-21 reset | 🗑️ Deleted — design knowledge preserved in the rebuild plan and the superseded doc |
| **11** | **Buffett/Munger single-focus rebuild** — from a clean-slate repo | 🚧 **Sprint 1 closed — Sprint 2 (live research) in progress** — portfolio CSV import + delete UI pulled forward from Sprint 4, done — [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |

## Sprint 0 — ✅ closed

| Item | Status |
|---|---|
| Guardrail doc (`CLAUDE.md`) | ✅ Done, committed |
| Map real Supabase schema | ✅ Done (13 Alembic migration files → 21 tables) |
| DB strategy decision | ✅ Decided — leave schema/data as-is |
| LLM provider decision | ✅ Decided — Gemini (`google_ai_studio`) primary, Mistral fallback |
| Legacy frontend cleanup | ✅ Done |
| Skeleton FastAPI backend (`/health`) | ✅ Built. **Not deployed to Railway.** |
| Skeleton React frontend (health badge) | ✅ Built. **Not deployed to Railway.** |
| Wire Gemini + Mistral (budget guard, retry/backoff, RPM pacing) | ✅ Done |

## Sprint 1 — ✅ closed 2026-09-21 (equity data model & deterministic calculations)

| Deliverable | Status |
|---|---|
| SQLAlchemy models | ✅ Done — `app/models/`, built directly against the real (already-migrated) schema |
| Deterministic calculations module | ✅ Done — `app/services/calculations.py` |
| Document ingestion | ✅ Done — `app/services/documents/`, `POST /documents/upload` |
| Minimal API (holdings/accounts/portfolio CRUD, computed-metrics endpoints) | ✅ Done — `app/api/holdings.py`, `accounts.py`, `portfolio.py`, `app/services/metrics.py` |
| First real frontend pages (holding list + holding detail) | ✅ Done — `HoldingsListPage.tsx`, `HoldingDetailPage.tsx` |

See the "Changes / history" table below for the session-by-session breakdown.

## Sprint 2 — 🚧 in progress (live, evidence-first research)

| Deliverable | Status |
|---|---|
| Research data model (`ResearchRun`, `ResearchItem`) | ✅ Done — `app/models/research.py`, maps onto `research_runs`/`research_items`, which already existed in the real Supabase DB pre-reset (no new migration needed) |
| `GeminiResearchProvider` (Gemini + Google Search grounding) | ✅ Done — `app/providers/gemini_research_provider.py`, reuses the existing Google AI Studio key + `gemini_retry` pacing |
| Versioned research prompts | ✅ Done — `backend/prompts/research/{macro,sector,company}_v1.md` |
| Research services (staleness-checked caching, macro/sector/company) | ✅ Done — `app/services/research/` |
| `/research` API (macro, sector, per-holding company, + manual refresh) | ✅ Done — `app/api/research.py` |
| Numeric macro data (FRED / Norges Bank, `macro_observations`) | ⏳ **Deliberately deferred** — a separate subsystem, not started |
| Background scheduler (periodic auto-refresh) | ⏳ **Deliberately deferred** — GET-triggers-refresh-if-stale covers "live" for now; see the sprint plan doc |
| Frontend research UI | ⏳ Not yet built — API-only so far, matching Sprint 1's document-upload/market-data precedent |

## Out-of-sequence: Portfolio CSV import + delete UI — ✅ done 2026-09-21

Faiz asked for this ahead of the sprint order (the sprint plan had slotted "real broker-export
parsing" into Sprint 4, alongside the analysis engine). Pulled forward on its own, independent of
Sprint 4's other deliverables.

| Deliverable | Status |
|---|---|
| Broker-CSV parser (Nordnet-style "Beholdningstabell" exports: UTF-16LE, tab-delimited, Norwegian decimal comma) | ✅ Done — `app/services/portfolio_import/csv_parser.py` |
| Instrument-type classifier (stock / equity ETF / bond fund / money-market fund / commodity ETC) | ✅ Done — `app/domain/instrument_types.py`, tags `Holding.asset_class_raw` (existing legacy column, no migration) |
| CSV → Account + Document + PortfolioSnapshot + PortfolioPositions ingestion | ✅ Done — `app/services/portfolio_import/ingestion.py`, dedups holdings by name across accounts, auto-creates the Account from the filename's embedded account number |
| `POST /portfolio/import-csv` API | ✅ Done — `app/api/portfolio.py` |
| Frontend Portfolio page: multi-file CSV upload + accounts list + snapshots list, each with a delete button | ✅ Done — `frontend/src/pages/PortfolioPage.tsx`, wired into the nav for the first time |

**Decisions Faiz made this session** (all real-money/scope-affecting, asked before building):

- These exports mix real equities with bond/money-market funds and a physical gold ETC
  (Xetra-Gold). Faiz chose to **import every row and tag its real instrument type**, rather than
  silently skip the non-equity rows — portfolio value/composition stays accurate; the
  Buffett/Munger analysis engine (Sprint 4) is expected to only ever run against
  `stock`/`equity_etf`-tagged holdings.
- A separate whisky/collectibles CSV (`Collection_2.csv`) was in the same upload batch. Faiz chose
  to **skip it** — out of scope for this equity-only rebuild, consistent with CLAUDE.md leaving
  legacy non-equity data alone.
- Delete scope: the backend already had confirm-gated deletes for individual accounts, holdings,
  snapshots and positions (built in Sprint 1, never exposed in the UI). Faiz chose to **just expose
  those in the new Portfolio page**, not add a new bulk "delete everything" endpoint.

**Not yet done:** run this import against Faiz's real 5 account CSVs / the real Supabase DB (built
and tested against in-memory SQLite only, per the tests) — needs his go-ahead first (see "Needs
from Faiz" below). Not yet deployed to Railway either.

**What was built this session (Sprint 2 continuation):** the research vertical slice above was
carried over from a prior pass this session-day; this pass added the portfolio-import feature. 25
new backend tests (198 total, up from 173), ruff clean (aside from the confirmed pre-existing
`EXE002` file-permission artifact, not content). Frontend lint/build clean. One commit (`2cb56c7`),
**local only, not yet pushed** — confirmed again this session: `git push origin main` still fails
with `could not read Username for 'https://github.com'`.

## Needs from Faiz right now

| Item | Why |
|---|---|
| **Push `main`** (1 commit this session, `2cb56c7`) | No GitHub push credentials in this session's shell either — confirmed by an actual failed `git push` attempt this session, not just assumed |
| **OK to run the portfolio CSV import against your real 5 account exports / the real Supabase DB** | Built and tested against in-memory SQLite only so far — nothing has touched your real data yet |
| Set a real `GOOGLE_AI_STUDIO_API_KEY` before trying `/research/*` for real | `GeminiResearchProvider` raises immediately without one — reuses the same key Sprint 0's analysis provider already needs |
| Redeploy to Railway once pushed, with the LLM/object-storage env vars from prior sprints set | Still **not deployed to Railway** — status-honesty rule applies here same as every prior sprint |
| Decide whether numeric macro data (FRED/Norges Bank) and a background scheduler are worth building now or staying deferred | Both were explicitly scoped out of Sprint 2's research slice — see the sprint plan doc for why |

## Known ongoing issue

No session's shell — cloud or the one on Faiz's linked device — has had GitHub push credentials
configured (`git push` fails with `could not read Username for 'https://github.com'`). Commits so
far in the repo were pushed by Faiz himself from his own terminal/GitHub Desktop between sessions;
this session's 1 commit is sitting local, waiting on the same thing.

## Changes / history

| Date | Session | Summary | Detail |
|---|---|---|---|
| 2026-09-21 | Portfolio CSV import + delete UI (pulled forward from Sprint 4) | Built the broker-export CSV parser (UTF-16LE, Nordnet-style), an instrument-type classifier for the mixed equity/bond/ETC rows these exports contain, the CSV→Account/Document/Snapshot/Position ingestion service, the `POST /portfolio/import-csv` API, and a new frontend Portfolio page (multi-file upload + account/snapshot lists with delete buttons, using the already-built confirm-gated delete endpoints). Faiz chose to import every row (tagged, not skipped), skip the whisky/collectibles CSV entirely, and keep deletes granular rather than add a bulk wipe. 25 new tests (198 total), ruff clean. 1 commit (`2cb56c7`), local only — confirmed `git push` fails in this shell too. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 2 started: live research (macro/sector/company) | Built the full research vertical slice: `ResearchRun`/`ResearchItem` models (onto already-existing DB tables), `GeminiResearchProvider` (Google Search grounding, reusing the Gemini key/pacing), versioned prompts, staleness-checked caching services, and `/research` API endpoints (GET serves-cache-or-refreshes, POST `.../refresh` forces it). 26 new tests (173 total), ruff clean. 2 commits (`16c3ff6`, `588198d`), both since confirmed pushed. Numeric macro data (FRED/Norges Bank) and a background scheduler deliberately deferred. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Minimal API + first frontend pages (Sprint 1 closed) | Built holdings/accounts/portfolio CRUD, read-only computed-metrics endpoints, and portfolio-wide document uploads (5 backend commits) — closing the Minimal API deliverable after asking Faiz how portfolio positions should be entered (he chose requiring a real source document over a manual-entry shortcut). Then built the holding-list and holding-detail frontend pages against that API and the Design & UX direction (1 frontend commit). 47 new tests (147 backend total), ruff/lint/type-check all clean. 6 commits this session, all since confirmed pushed by Faiz. Sprint 1 is now fully closed. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Document ingestion (Sprint 1) | Built PDF/PPTX/XLSX extraction, sha256 intake/dedup, swappable object storage (local/S3), the DB session module (fixing a broken alembic import along the way), and the first real API router (`/documents/upload`, `/documents`, `/documents/{id}`). 32 new tests, 109 total passing, ruff clean. 3 commits this session since confirmed pushed. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 close + Sprint 1 start | Faiz confirmed `LLM_PROVIDER=google_ai_studio` and to finish Sprint 0 before Sprint 1. Built and tested `app/providers/` (Gemini primary + Mistral fallback, retry/backoff, RPM pacing, daily budget guard) — Sprint 0 fully closed. Then built `app/models/` and `app/services/calculations.py`. 77 backend unit tests, all passing. Two commits made, since confirmed pushed. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Status audit + Sprint 1/next-phase planning + UX research | Verified actual repo state against the docs. Saved the Mistral fallback key to `backend/.env`, clearing Sprint 0's last blocker. Researched clean/minimal investment-grade fintech UI (Mercury, Stripe Dashboard, Wealthfront) and set a concrete design direction. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 skeletons built | Found and removed leftover legacy frontend (49 files). Built and locally tested the skeleton FastAPI backend (`/health`) and skeleton React frontend (health badge), fixed a stale Dockerfile. 3 commits made; since confirmed pushed. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 started: guardrail doc + real schema mapped | Recreated a lean `CLAUDE.md`, committed. Mapped the real Supabase schema from Alembic migrations (21 tables, no separate non-equity tables). All 3 prior open checkpoints decided by Faiz. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Full repo reset + rebuild plan written | Faiz had the repo wiped except Railway/Supabase/GitHub config, as a clean-slate restart. Committed and pushed as `8ad0221` ("reset") with full history preserved. Real Supabase data untouched. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |

*Full pre-reset history (Phases 0–10 and the incremental Sprint 0-2 redesign work) is preserved in
this project's other docs and in git history.*
