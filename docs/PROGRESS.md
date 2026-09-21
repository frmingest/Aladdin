# Aladdin — Progress

Quick-glance tracker. Full technical detail for each item lives in its own doc (linked below); this
page stays a scan-able table, not a narrative.

**Last updated:** 2026-09-21

## Build phases

| Phase | What it is | Status |
|---|---|---|
| 0–10 | Everything built before the 2026-09-21 reset | 🗑️ Deleted — design knowledge preserved in the rebuild plan and the superseded doc |
| **11** | **Buffett/Munger single-focus rebuild** — from a clean-slate repo | 🚧 **Sprint 0 closed, Sprint 1 in progress** — [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |

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
| **Document ingestion** (PDF/PPTX/XLSX text + structured line-item extraction into DocumentChunk/FinancialLineItem) | ✅ **Done this session** — see below |
| Minimal API (read/write holdings & portfolio, read-only computed-metrics endpoints) | ⬜ Not started — holdings still have no CRUD API, so a document can currently only be attached to a holding created directly in the DB |
| First real frontend pages (holding list + holding detail, styled against the Design & UX direction) | ⬜ Not started |

**What was built this session:**

- `app/services/documents/` — intake (validate → hash/dedup by sha256 → store) and type-specific
  extraction: PDF (page text via PyMuPDF) and PPTX (slide text + speaker notes via python-pptx) both
  capture full page text but yield no structured facts by design (no table-parsing/LLM pass yet);
  XLSX (openpyxl) additionally promotes rows whose label matches a known metric (see
  `app/domain/financial_metrics.py`'s exact-match English/Norwegian label map) into structured
  `FinancialLineItem` facts, one per period column. Document-level quality flagging
  (`no_pages_extracted`, `low_text_extraction`) rolls up per-page results.
- `app/providers/object_storage.py` + `object_storage_s3.py` — swappable storage backend: local
  filesystem for dev, or any S3-compatible bucket (Cloudflare R2 or Supabase Storage's own
  S3-compatible API) for a real deployment. Config-driven (`OBJECT_STORAGE_PROVIDER=local|s3`), never
  branched on in service code.
- `app/config/database.py` — SQLAlchemy engine/session + FastAPI `get_db` dependency. **Didn't exist
  yet this rebuild** — also fixed `alembic/env.py`, which still imported the old (pre-reset)
  `app.config.database.Base` that no longer existed, meaning `alembic upgrade`/autogenerate has been
  broken since the reset until this fix.
- `app/api/documents.py` — `POST /documents/upload`, `GET /documents`, `GET /documents/{id}`. The
  app's first real domain router (previously only `/health` existed).
- `backend/pyproject.toml` (new) — ruff config allowlisting FastAPI's `Depends`/`Form`/`File` idiom
  for the bugbear B008 rule, which otherwise false-positives on every endpoint using them.
- 32 new tests (109 total, up from 77) — extraction (PDF/PPTX/XLSX with real generated fixture
  files), hashing, quality flags, object storage (local + S3 credential-validation), the full
  ingestion pipeline against an in-memory DB, and an end-to-end API test (upload → list → get)
  against a real FastAPI app with the DB and storage swapped for test doubles via
  `dependency_overrides`. Ruff clean (aside from the same pre-existing `EXE002` mount-permission
  artifact on every file, unrelated to this session).

**Design decisions made implementing this:** `Document.quality_flags` is a dict (`{"flag": true}`),
not a list, matching the model as already committed this rebuild — the pre-reset app used a list;
this rebuild's model type hint (`dict[str, Any]`) took precedence, extraction/quality code was
written to match. Extended `financial_metrics.CANONICAL_METRICS` with `cost_of_goods_sold`,
`operating_income`, and `depreciation_and_amortization` (absent pre-reset) so XLSX extraction can
eventually feed `calculations.gross_margin`/`operating_margin`/`owner_earnings`, which need them —
no real filing has exercised these labels yet, so treat them as unverified until one does.

## Needs from Faiz right now

| Item | Why |
|---|---|
| **Push `main`** (3 commits this session and prior: LLM providers, models+calculations, document ingestion) | No GitHub push credentials in this session's shell — same limitation every session has hit so far |
| Redeploy to Railway once pushed, with `GOOGLE_AI_STUDIO_API_KEY`/`LLM_PROVIDER=google_ai_studio`/`MISTRAL_API_KEY`/rate-limit vars set as Railway env vars | Railway's env vars are separate from `backend/.env` and unverified this session |
| If deploying document upload for real: set `OBJECT_STORAGE_PROVIDER=s3` + the R2/Supabase S3 credentials in Railway env vars | The `local` default writes to the container's own ephemeral disk — fine for dev, silently loses every uploaded filing on redeploy in production |
| Confirm the design direction (light/editorial/Mercury-Stripe-style) if not already reviewed | Sprint 1's frontend pages build against it once confirmed |
| Delete the 6 leftover branches on GitHub — commands in the sprint plan doc | Still pending, not blocking |

## Known ongoing issue

Neither this session's cloud shell nor (historically) the shell on Faiz's linked device has had GitHub
push credentials — commits still need to be pushed by Faiz from his own terminal/GitHub Desktop.

## Changes / history

| Date | Session | Summary | Detail |
|---|---|---|---|
| 2026-09-21 | Document ingestion (Sprint 1) | Built PDF/PPTX/XLSX extraction, sha256 intake/dedup, swappable object storage (local/S3), the DB session module (fixing a broken alembic import along the way), and the first real API router (`/documents/upload`, `/documents`, `/documents/{id}`). 32 new tests, 109 total passing, ruff clean. Not yet done: holdings CRUD API (Sprint 1's next item) — a document can only be attached to a holding created directly in the DB for now. 3 commits this session still unpushed (no GitHub credentials in this session). | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 close + Sprint 1 start | Faiz confirmed `LLM_PROVIDER=google_ai_studio` and to finish Sprint 0 before Sprint 1. Built and tested `app/providers/` (Gemini primary + Mistral fallback, retry/backoff, RPM pacing, daily budget guard) — Sprint 0 fully closed. Then built `app/models/` (8 SQLAlchemy models against the real schema) and `app/services/calculations.py` (15 deterministic financial functions) — first two of five Sprint 1 deliverables. 77 backend unit tests, all passing; ruff clean (aside from a confirmed pre-existing mount artifact). Two commits made, since confirmed pushed. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Status audit + Sprint 1/next-phase planning + UX research | Verified actual repo state against the docs (found the docs, not the repo, were stale — 2 commits already pushed that the docs didn't reflect). Saved the Mistral fallback key to `backend/.env` on Faiz's machine (was typed but unsaved), clearing Sprint 0's last blocker. Re-verified the frontend build is still clean. Researched clean/minimal investment-grade fintech UI (Mercury, Stripe Dashboard, Wealthfront) and set a concrete design direction. Expanded Sprint 1 with concrete deliverables. Flagged an `LLM_PROVIDER` config mismatch and minor dangling-doc-reference cleanup for Faiz to weigh in on. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 skeletons built | Found and removed leftover legacy frontend (49 files) the reset had missed. Built and locally tested the skeleton FastAPI backend (`/health`) and skeleton React frontend (health badge), fixed a stale Dockerfile. 3 commits made; since confirmed pushed. Gemini+Mistral wiring was blocked on `MISTRAL_API_KEY`. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 started: guardrail doc + real schema mapped | Recreated a lean `CLAUDE.md`, committed. Mapped the real Supabase schema from Alembic migrations (21 tables, no separate non-equity tables). Found `MISTRAL_API_KEY` missing from local `.env`. All 3 prior open checkpoints decided by Faiz. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Full repo reset + rebuild plan written | Faiz had the repo wiped except Railway/Supabase/GitHub config, as a clean-slate restart. Committed and pushed as `8ad0221` ("reset") with full git history preserved. Real Supabase data untouched. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |

*Full pre-reset history (Phases 0–10 and the incremental Sprint 0-2 redesign work) is preserved in
this project's other docs and in git history.*
