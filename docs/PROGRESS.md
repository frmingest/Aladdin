# Aladdin — Progress

Quick-glance tracker. Full technical detail for each item lives in its own doc (linked below); this
page stays a scan-able table, not a narrative.

**Last updated:** 2026-09-21

## Build phases

| Phase | What it is | Status |
|---|---|---|
| 0–10 | Everything built before the 2026-09-21 reset | 🗑️ Deleted — design knowledge preserved in the rebuild plan and the superseded doc |
| **11** | **Buffett/Munger single-focus rebuild** — from a clean-slate repo | 🚧 **Sprint 1 closed — Sprint 2 (live research) next** — [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |

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
| **First real frontend pages** (holding list + holding detail) | ✅ **Done this session** — see below |

**What was built this session, in two parts:**

1. **Minimal API** (4 commits) — Holdings CRUD, accounts CRUD, read-only computed-metrics
   endpoints (`GET /holdings/{id}/metrics`, deterministic ratios from extracted facts, missing
   inputs always named rather than silently dropped), and portfolio snapshot/position CRUD with an
   HHI concentration endpoint. **Design decision Faiz made when asked directly:** every portfolio
   snapshot must point at a real uploaded document (`source_file_id`) — no manual-entry shortcut,
   positions stay as traceable to evidence as everything else. This required making
   `POST /documents/upload`'s `holding_id` optional (new `document_type="portfolio_export"`).
2. **Frontend** (1 commit) — a holding list page (table + inline "add holding" form) and a holding
   detail page (profile, a period-selectable deterministic-metrics panel, a filings table, and a
   file-upload control), built against the Minimal API and the Design & UX direction's tokens
   (light/editorial, near-white/near-black, one accent color, green/red/amber reserved for state,
   tabular numerals for financial figures). Added `react-router-dom` for client-side routing. A
   fixed left nav shows Portfolio/Thesis/Macro as visible-but-disabled placeholders for later
   sprints.

47 new backend tests this session (147 total, up from 109), ruff clean throughout. Frontend:
`npm run lint` and `npx tsc --noEmit` both clean, `npm run build` succeeds. **Not done:** a live
dev-server smoke test of frontend↔backend wiring — deliberately skipped this session to avoid any
risk of a local backend run picking up real `DATABASE_URL`/Supabase credentials from
`backend/.env`; worth doing from your own machine next (`npm run dev` + `uvicorn app.main:app`,
ideally against a disposable dev DB rather than the real one).

## Needs from Faiz right now

| Item | Why |
|---|---|
| **Push `main`** (6 commits this session) | No GitHub push credentials in this session's shell — same limitation every session has hit so far |
| Redeploy to Railway once pushed, with `GOOGLE_AI_STUDIO_API_KEY`/`LLM_PROVIDER=google_ai_studio`/`MISTRAL_API_KEY`/rate-limit vars set as Railway env vars | Railway's env vars are separate from `backend/.env` and unverified this session |
| If deploying document upload for real: set `OBJECT_STORAGE_PROVIDER=s3` + the R2/Supabase S3 credentials in Railway env vars | The `local` default writes to the container's own ephemeral disk — fine for dev, silently loses every uploaded filing on redeploy in production |
| Try the frontend against a real (ideally non-production) backend at least once | This session verified it via lint/type-check/build only, deliberately not a live run — see above |

## Known ongoing issue

Neither this session's cloud shell nor (historically) the shell on Faiz's linked device has had GitHub
push credentials — commits still need to be pushed by Faiz from his own terminal/GitHub Desktop.

## Changes / history

| Date | Session | Summary | Detail |
|---|---|---|---|
| 2026-09-21 | Minimal API + first frontend pages (Sprint 1 closed) | Built holdings/accounts/portfolio CRUD, read-only computed-metrics endpoints, and portfolio-wide document uploads (5 backend commits) — closing the Minimal API deliverable after asking Faiz how portfolio positions should be entered (he chose requiring a real source document over a manual-entry shortcut). Then built the holding-list and holding-detail frontend pages against that API and the Design & UX direction (1 frontend commit). 47 new tests (147 backend total), ruff/lint/type-check all clean. 6 commits this session, all still unpushed (no GitHub credentials in this session). Sprint 1 is now fully closed. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Document ingestion (Sprint 1) | Built PDF/PPTX/XLSX extraction, sha256 intake/dedup, swappable object storage (local/S3), the DB session module (fixing a broken alembic import along the way), and the first real API router (`/documents/upload`, `/documents`, `/documents/{id}`). 32 new tests, 109 total passing, ruff clean. 3 commits this session since confirmed pushed. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 close + Sprint 1 start | Faiz confirmed `LLM_PROVIDER=google_ai_studio` and to finish Sprint 0 before Sprint 1. Built and tested `app/providers/` (Gemini primary + Mistral fallback, retry/backoff, RPM pacing, daily budget guard) — Sprint 0 fully closed. Then built `app/models/` and `app/services/calculations.py`. 77 backend unit tests, all passing. Two commits made, since confirmed pushed. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Status audit + Sprint 1/next-phase planning + UX research | Verified actual repo state against the docs. Saved the Mistral fallback key to `backend/.env`, clearing Sprint 0's last blocker. Researched clean/minimal investment-grade fintech UI (Mercury, Stripe Dashboard, Wealthfront) and set a concrete design direction. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 skeletons built | Found and removed leftover legacy frontend (49 files). Built and locally tested the skeleton FastAPI backend (`/health`) and skeleton React frontend (health badge), fixed a stale Dockerfile. 3 commits made; since confirmed pushed. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 started: guardrail doc + real schema mapped | Recreated a lean `CLAUDE.md`, committed. Mapped the real Supabase schema from Alembic migrations (21 tables, no separate non-equity tables). All 3 prior open checkpoints decided by Faiz. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Full repo reset + rebuild plan written | Faiz had the repo wiped except Railway/Supabase/GitHub config, as a clean-slate restart. Committed and pushed as `8ad0221` ("reset") with full history preserved. Real Supabase data untouched. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |

*Full pre-reset history (Phases 0–10 and the incremental Sprint 0-2 redesign work) is preserved in
this project's other docs and in git history.*
