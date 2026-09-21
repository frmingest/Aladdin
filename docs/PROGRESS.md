# Aladdin — Progress

Quick-glance tracker. Full technical detail for each item lives in its own doc (linked below); this
page stays a scan-able table, not a narrative.

**Last updated:** 2026-09-21

## Build phases

| Phase | What it is | Status |
|---|---|---|
| 0–10 | Everything built before the 2026-09-21 reset | 🗑️ Deleted — design knowledge preserved in the rebuild plan and the superseded doc |
| **11** | **Buffett/Munger single-focus rebuild** — from a clean-slate repo | 🚧 **Sprint 0 in progress** — [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |

## Sprint 0 checklist

| Item | Status |
|---|---|
| Guardrail doc (`CLAUDE.md`) | ✅ Done, committed |
| Map real Supabase schema | ✅ Done (21 tables, from Alembic migrations) |
| DB strategy decision | ✅ Decided — leave schema/data as-is |
| LLM provider decision | ✅ Decided — Gemini + Mistral |
| Legacy frontend cleanup | ✅ Done — see "Found" below |
| Skeleton FastAPI backend (`/health`) | ✅ Built + tested locally. **Not deployed to Railway.** |
| Skeleton React frontend (health badge) | ✅ Built + tested locally. **Not deployed to Railway.** |
| Wire Gemini + Mistral (budget guard, retry/backoff, RPM pacing) | ⏸️ **Blocked** — waiting on Faiz to add `MISTRAL_API_KEY` to `backend/.env` |

## Found while working Sprint 0

The reset was supposed to wipe all application code, but it only wiped `backend/app/` —
`frontend/src/` still had the entire pre-rebuild multi-asset UI (Dashboard, PortfolioUpload,
Analysis pages, old chart components, the Bloomberg-terminal CSS, and types for the old schema).
Faiz confirmed: wipe it now, true clean slate. Done — commit `622ad08`.

## What got built (Sprint 0 skeletons)

| Commit | What |
|---|---|
| `622ad08` | Removed the leftover legacy frontend (49 files) |
| `ec4c0de` | Skeleton FastAPI backend: `app/main.py` (`/health`), `app/config/settings.py`, `requirements.txt`. Fixed `backend/Dockerfile` (it still referenced now-deleted top-level `prompts/`/`schemas/`/etc. dirs — would have failed to build) |
| `d1e9e36` | Skeleton React frontend: `index.html`, `main.tsx`, `App.tsx` (polls `/health`, shows a status badge), restored `eslint.config.js` |

Both skeletons were tested locally before committing: backend via `uvicorn` + `curl /health` (200
OK), frontend via `npm run lint` and `npm run build` (both clean). Neither has been deployed to
Railway — that hasn't been checked, so per the status-honesty rule this stays "written, not yet
deployed" until a live Railway URL is checked or Faiz confirms he redeployed.

## Needs from Faiz right now

| Item | Why |
|---|---|
| **Add `MISTRAL_API_KEY` to `backend/.env`** | Blocks starting the Gemini+Mistral provider wiring — Faiz said he'd add it himself |
| Delete the 6 leftover branches on GitHub — commands in the sprint plan doc | Cleanup, not blocking |

## Known ongoing issue

Neither the cloud session shell nor the shell on Faiz's linked device has GitHub push credentials
or raw-TCP network access — commits get pushed by Faiz from his own terminal, and any DB schema
work reads the local Alembic migration files rather than connecting to Supabase directly.

## Changes / history

| Date | Session | Summary | Detail |
|---|---|---|---|
| 2026-09-21 | Sprint 0 skeletons built | Found and removed leftover legacy frontend (49 files) the reset had missed. Built and locally tested the skeleton FastAPI backend (`/health`) and skeleton React frontend (health badge), fixed a stale Dockerfile. Pushed to `main`. Gemini+Mistral wiring still blocked on `MISTRAL_API_KEY`. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 started: guardrail doc + real schema mapped | Recreated a lean `CLAUDE.md`, committed. Mapped the real Supabase schema from Alembic migrations (21 tables, no separate non-equity tables). Found `MISTRAL_API_KEY` missing from local `.env`. All 3 prior open checkpoints decided by Faiz. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Full repo reset + rebuild plan written | Faiz had the repo wiped except Railway/Supabase/GitHub config, as a clean-slate restart. Committed and pushed as `8ad0221` ("reset") with full git history preserved. Real Supabase data untouched. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |

*Full pre-reset history (Phases 0–10 and the incremental Sprint 0-2 redesign work) is preserved in
the Claude project's other docs and in git history.*
