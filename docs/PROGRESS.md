# Aladdin — Progress

Quick-glance tracker. Full technical detail for each item lives in its own doc (linked below); this
page stays a scan-able table, not a narrative.

**Last updated:** 2026-09-21

## Build phases

| Phase | What it is | Status |
|---|---|---|
| 0–10 | Everything built before the 2026-09-21 reset | 🗑️ Deleted — design knowledge preserved in the rebuild plan and the superseded doc |
| **11** | **Buffett/Munger single-focus rebuild** — from a clean-slate repo | 🚧 **Sprint 0 closed, Sprint 1 in progress** — [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |

## Sprint 0 — ✅ closed this session

| Item | Status |
|---|---|
| Guardrail doc (`CLAUDE.md`) | ✅ Done, committed |
| Map real Supabase schema | ✅ Done (13 Alembic migration files → 21 tables) |
| DB strategy decision | ✅ Decided — leave schema/data as-is |
| LLM provider decision | ✅ Decided — Gemini (`google_ai_studio`) primary, Mistral fallback |
| Legacy frontend cleanup | ✅ Done, committed and pushed |
| Skeleton FastAPI backend (`/health`) | ✅ Built and re-verified. **Not deployed to Railway.** |
| Skeleton React frontend (health badge) | ✅ Built and re-verified. **Not deployed to Railway.** |
| `MISTRAL_API_KEY` in `backend/.env` | ✅ Done |
| `LLM_PROVIDER` mismatch resolved (Faiz confirmed `google_ai_studio`) | ✅ Done this session — `backend/.env` fixed, leftover `ANTHROPIC_*` lines removed |
| Wire Gemini + Mistral (budget guard, retry/backoff, RPM pacing) | ✅ **Done this session** — see below |

**What was built:** `app/providers/` — a vendor-agnostic `LLMProvider` interface, `GoogleAIStudioProvider`
(Gemini, `gemini-3.6-flash`) and `MistralProvider` (fallback, native strict JSON-schema structured
output), each with its own retry-with-backoff module (transient errors only: Gemini 429/503, Mistral
429/500/502/503/504) sharing a `RateLimiter` pacer, a `DailyBudgetGuard` (in-memory daily request cap —
not DB-backed yet, since no models existed at the point this was built), and `factory.py` wiring it
all to settings. 44 unit tests, all against mocked SDK clients (no real API calls, no quota spent).

## Sprint 1 — 🚧 in progress (equity data model & deterministic calculations)

| Deliverable | Status |
|---|---|
| SQLAlchemy models (Account, Holding, PortfolioPosition, PortfolioSnapshot, Document, DocumentPage, DocumentChunk, FinancialLineItem) | ✅ **Done this session** — `app/models/`, built directly against the real (already-migrated) schema |
| Deterministic calculations module (margins, ROIC/ROE, FCF, owner earnings, Net Debt/EBITDA, Net Debt/FCF, interest coverage, D/E, HHI, multiples) | ✅ **Done this session** — `app/services/calculations.py`, Decimal throughout, unit-tested before anything is allowed to call it |
| Document ingestion (PDF/PPTX/XLSX text + structured line-item extraction) | ⬜ Not started |
| Minimal API (read/write holdings & portfolio, read-only computed-metrics endpoints) | ⬜ Not started |
| First real frontend pages (holding list + holding detail, styled against the Design & UX direction) | ⬜ Not started |

## Found/decided this session (2026-09-21, second pass)

1. Faiz confirmed `LLM_PROVIDER=google_ai_studio` (not the leftover `anthropic` setting) and confirmed
   the plan to finish Sprint 0 before starting Sprint 1.
2. `device_bash` could mount `E:\Aladdin` directly this session (several prior sessions logged this as
   broken/unavailable) — all work this session was done and tested directly against the real repo, no
   clone-based workaround needed.
3. The repo's own `backend/.venv` is a **Windows** virtualenv (`Scripts/python.exe`) and can't run from
   `device_bash`'s Linux shell — a separate Linux venv was created for this session's test runs
   (not part of the repo).
4. `mypy` (2.3.1) crashes with an internal error in this environment, unrelated to this session's
   changes — not investigated further; worth retrying with a different mypy version.

## Needs from Faiz right now

| Item | Why |
|---|---|
| **Push `main`** (2 commits this session: LLM providers, models+calculations) | No GitHub push credentials in this session's shell — same limitation prior sessions hit |
| Redeploy to Railway once pushed, with `GOOGLE_AI_STUDIO_API_KEY`/`LLM_PROVIDER=google_ai_studio`/`MISTRAL_API_KEY`/rate-limit vars set as Railway env vars | Railway's env vars are separate from `backend/.env` and unverified this session |
| Confirm the design direction (light/editorial/Mercury-Stripe-style) if not already reviewed | Sprint 1's frontend pages build against it once confirmed |
| Delete the 6 leftover branches on GitHub — commands in the sprint plan doc | Still pending, not blocking |

## Known ongoing issue

Neither this session's cloud shell nor (historically) the shell on Faiz's linked device has had GitHub
push credentials — commits still need to be pushed by Faiz from his own terminal/GitHub Desktop.

## Changes / history

| Date | Session | Summary | Detail |
|---|---|---|---|
| 2026-09-21 | Sprint 0 close + Sprint 1 start | Faiz confirmed `LLM_PROVIDER=google_ai_studio` and to finish Sprint 0 before Sprint 1. Built and tested `app/providers/` (Gemini primary + Mistral fallback, retry/backoff, RPM pacing, daily budget guard) — Sprint 0 fully closed. Then built `app/models/` (8 SQLAlchemy models against the real schema) and `app/services/calculations.py` (15 deterministic financial functions) — first two of five Sprint 1 deliverables. 77 backend unit tests, all passing; ruff clean (aside from a confirmed pre-existing mount artifact). Two commits made, not yet pushed (no push credentials in this session). | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Status audit + Sprint 1/next-phase planning + UX research | Verified actual repo state against the docs (found the docs, not the repo, were stale — 2 commits already pushed that the docs didn't reflect). Saved the Mistral fallback key to `backend/.env` on Faiz's machine (was typed but unsaved), clearing Sprint 0's last blocker. Re-verified the frontend build is still clean. Researched clean/minimal investment-grade fintech UI (Mercury, Stripe Dashboard, Wealthfront) and set a concrete design direction. Expanded Sprint 1 with concrete deliverables. Flagged an `LLM_PROVIDER` config mismatch and minor dangling-doc-reference cleanup for Faiz to weigh in on. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 skeletons built | Found and removed leftover legacy frontend (49 files) the reset had missed. Built and locally tested the skeleton FastAPI backend (`/health`) and skeleton React frontend (health badge), fixed a stale Dockerfile. 3 commits made; since confirmed pushed. Gemini+Mistral wiring was blocked on `MISTRAL_API_KEY`. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 started: guardrail doc + real schema mapped | Recreated a lean `CLAUDE.md`, committed. Mapped the real Supabase schema from Alembic migrations (21 tables, no separate non-equity tables). Found `MISTRAL_API_KEY` missing from local `.env`. All 3 prior open checkpoints decided by Faiz. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Full repo reset + rebuild plan written | Faiz had the repo wiped except Railway/Supabase/GitHub config, as a clean-slate restart. Committed and pushed as `8ad0221` ("reset") with full git history preserved. Real Supabase data untouched. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |

*Full pre-reset history (Phases 0–10 and the incremental Sprint 0-2 redesign work) is preserved in
this project's other docs and in git history.*
