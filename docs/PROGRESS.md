# Aladdin — Progress

Quick-glance tracker. Full technical detail for each item lives in its own doc (linked below); this
page stays a scan-able table, not a narrative.

**Last updated:** 2026-09-21

## Build phases

| Phase | What it is | Status |
|---|---|---|
| 0–10 | Everything built before the 2026-09-21 reset | 🗑️ Deleted — design knowledge preserved in the rebuild plan and the superseded doc |
| **11** | **Buffett/Munger single-focus rebuild** — from a clean-slate repo | 🚧 **Sprint 1 in progress — Minimal API done, frontend pages next** — [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |

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

## Sprint 1 — 🚧 in progress (equity data model & deterministic calculations)

| Deliverable | Status |
|---|---|
| SQLAlchemy models (Account, Holding, PortfolioPosition, PortfolioSnapshot, Document, DocumentPage, DocumentChunk, FinancialLineItem) | ✅ Done — `app/models/`, built directly against the real (already-migrated) schema |
| Deterministic calculations module (margins, ROIC/ROE, FCF, owner earnings, Net Debt/EBITDA, Net Debt/FCF, interest coverage, D/E, HHI, multiples) | ✅ Done — `app/services/calculations.py` |
| Document ingestion (PDF/PPTX/XLSX text + structured line-item extraction into DocumentChunk/FinancialLineItem) | ✅ Done — `app/services/documents/`, `POST /documents/upload` |
| **Minimal API** (holdings/accounts/portfolio CRUD, read-only computed-metrics endpoints) | ✅ **Done this session** — see below |
| First real frontend pages (holding list + holding detail, styled against the Design & UX direction) | ⬜ Not started — next up |

**What was built this session (5 commits, all local — see "Needs from Faiz right now"):**

- **Holdings CRUD** (`app/api/holdings.py`) — `POST/GET/PATCH/DELETE /holdings`. Closes the blocker
  flagged last session: a document could only be attached to a holding created directly in the DB.
  Delete requires `confirm=true` and is refused while the holding still has documents, positions, or
  extracted facts pointing at it.
- **Accounts CRUD** (`app/api/accounts.py`) — same shape as holdings; accounts had no API at all
  before this. Same destructive-delete guardrail.
- **Read-only computed-metrics endpoints** (`app/services/metrics.py`, wired into
  `app/api/holdings.py`) — `GET /holdings/{id}/periods` and `GET /holdings/{id}/metrics?period=...`
  turn a holding's extracted filing facts into every ratio `calculations.py` can derive from them
  alone (margins, FCF, owner earnings, net debt and its ratios, interest coverage, D/E). Whatever
  can't be computed (ROIC/ROE — no NOPAT/invested-capital fact; every valuation multiple — needs
  live market data, Phase 2) is reported as explicitly skipped with the missing input(s) named, never
  silently dropped.
- **Portfolio-wide document uploads** (`app/api/documents.py`, `app/domain/document_types.py`,
  `app/services/documents/ingestion.py`) — `holding_id` is now optional on
  `POST /documents/upload`; new `document_type="portfolio_export"` for a brokerage export covering
  many holdings at once. Since `financial_line_items.holding_id` is `NOT NULL`, a holding-less
  document now explicitly discards any candidate facts (flagged `facts_skipped_no_holding`) instead
  of risking an `IntegrityError`.
- **Portfolio snapshot/position CRUD** (`app/api/portfolio.py`) — closes the Minimal API deliverable.
  `POST /portfolio/snapshots` creates a snapshot with its positions in one call; `GET`/`DELETE` for
  snapshots and individual positions; `GET .../concentration` computes the Herfindahl-Hirschman
  index over position weights via `calculations.py`. **Design decision Faiz made when asked
  directly:** every snapshot must point at a real uploaded document (`source_file_id`) — portfolio
  positions stay just as traceable to evidence as everything else, no manual-entry shortcut that
  would let a position exist with no real source behind it.
- 38 new tests this session (147 total, up from 109), ruff clean throughout (aside from the
  pre-existing `EXE002` mount-permission artifact on every file, confirmed unrelated to any
  session's changes).

## Needs from Faiz right now

| Item | Why |
|---|---|
| **Push `main`** (5 commits this session, on top of the already-pushed document-ingestion commit) | No GitHub push credentials in this session's shell — same limitation every session has hit so far |
| Redeploy to Railway once pushed, with `GOOGLE_AI_STUDIO_API_KEY`/`LLM_PROVIDER=google_ai_studio`/`MISTRAL_API_KEY`/rate-limit vars set as Railway env vars | Railway's env vars are separate from `backend/.env` and unverified this session |
| If deploying document upload for real: set `OBJECT_STORAGE_PROVIDER=s3` + the R2/Supabase S3 credentials in Railway env vars | The `local` default writes to the container's own ephemeral disk — fine for dev, silently loses every uploaded filing on redeploy in production |
| Confirm the design direction (light/editorial/Mercury-Stripe-style) if not already reviewed | The frontend pages (next up) build against it once confirmed |

## Known ongoing issue

Neither this session's cloud shell nor (historically) the shell on Faiz's linked device has had GitHub
push credentials — commits still need to be pushed by Faiz from his own terminal/GitHub Desktop.

## Changes / history

| Date | Session | Summary | Detail |
|---|---|---|---|
| 2026-09-21 | Minimal API (Sprint 1) | Built holdings CRUD, accounts CRUD, read-only computed-metrics endpoints, portfolio-wide document uploads, and portfolio snapshot/position CRUD (with an HHI concentration endpoint). Asked Faiz directly how portfolio positions should be entered — he chose requiring a real uploaded source document over a manual-entry shortcut, so every snapshot stays traceable to evidence. 38 new tests (147 total), ruff clean. 5 commits this session, all still unpushed (no GitHub credentials in this session). Sprint 1's only remaining item is the first real frontend pages. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Document ingestion (Sprint 1) | Built PDF/PPTX/XLSX extraction, sha256 intake/dedup, swappable object storage (local/S3), the DB session module (fixing a broken alembic import along the way), and the first real API router (`/documents/upload`, `/documents`, `/documents/{id}`). 32 new tests, 109 total passing, ruff clean. Not yet done: holdings CRUD API (Sprint 1's next item) — a document can only be attached to a holding created directly in the DB for now. 3 commits this session still unpushed (no GitHub credentials in this session). | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 close + Sprint 1 start | Faiz confirmed `LLM_PROVIDER=google_ai_studio` and to finish Sprint 0 before Sprint 1. Built and tested `app/providers/` (Gemini primary + Mistral fallback, retry/backoff, RPM pacing, daily budget guard) — Sprint 0 fully closed. Then built `app/models/` (8 SQLAlchemy models against the real schema) and `app/services/calculations.py` (15 deterministic financial functions) — first two of five Sprint 1 deliverables. 77 backend unit tests, all passing; ruff clean (aside from a confirmed pre-existing mount artifact). Two commits made, since confirmed pushed. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Status audit + Sprint 1/next-phase planning + UX research | Verified actual repo state against the docs (found the docs, not the repo, were stale — 2 commits already pushed that the docs didn't reflect). Saved the Mistral fallback key to `backend/.env` on Faiz's machine (was typed but unsaved), clearing Sprint 0's last blocker. Re-verified the frontend build is still clean. Researched clean/minimal investment-grade fintech UI (Mercury, Stripe Dashboard, Wealthfront) and set a concrete design direction. Expanded Sprint 1 with concrete deliverables. Flagged an `LLM_PROVIDER` config mismatch and minor dangling-doc-reference cleanup for Faiz to weigh in on. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 skeletons built | Found and removed leftover legacy frontend (49 files) the reset had missed. Built and locally tested the skeleton FastAPI backend (`/health`) and skeleton React frontend (health badge), fixed a stale Dockerfile. 3 commits made; since confirmed pushed. Gemini+Mistral wiring was blocked on `MISTRAL_API_KEY`. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 started: guardrail doc + real schema mapped | Recreated a lean `CLAUDE.md`, committed. Mapped the real Supabase schema from Alembic migrations (21 tables, no separate non-equity tables). Found `MISTRAL_API_KEY` missing from local `.env`. All 3 prior open checkpoints decided by Faiz. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Full repo reset + rebuild plan written | Faiz had the repo wiped except Railway/Supabase/GitHub config, as a clean-slate restart. Committed and pushed as `8ad0221` ("reset") with full git history preserved. Real Supabase data untouched. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |

*Full pre-reset history (Phases 0–10 and the incremental Sprint 0-2 redesign work) is preserved in
this project's other docs and in git history.*
