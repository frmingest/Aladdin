# Aladdin — Progress

Quick-glance tracker. Full technical detail for each item lives in its own doc (linked below); this
page stays a scan-able table, not a narrative.

**Last updated:** 2026-09-21

## Build phases

| Phase | What it is | Status |
|---|---|---|
| 0–10 | Everything built before the 2026-09-21 reset | 🗑️ **Deleted from the repo** — design knowledge preserved in the rebuild plan and the superseded doc |
| **11** | **Buffett/Munger single-focus rebuild** — from a clean-slate repo | 🚧 **Sprint 0 in progress** — [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |

## Current status by area

| Area | Status | Detail |
|---|---|---|
| **Repo state** | `main` locally at `d01e601` (guardrail doc added), on top of `8ad0221` ("reset"). **Not yet pushed** — Faiz needs to push from a terminal with GitHub access. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| **Real data** | Untouched. Supabase still holds all real portfolio/holdings/analysis history plus legacy non-equity rows/columns (kept deliberately, not migrated away). | — |
| **Sprint 0 (foundation)** | Guardrail doc (`CLAUDE.md`) recreated and committed locally. Real Supabase schema mapped from the kept Alembic migrations (21 tables, no separate non-equity tables — just a discriminator column). DB strategy and LLM provider both decided. Still to do: skeleton FastAPI/React apps deployed through Railway, and wiring Gemini+Mistral with rate-limit resilience built in from day one. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| Everything previously tracked here (Ollama migration, Gemini/Mistral 429s, dashboard caching, Bloomberg redesign, etc.) | Moot — code deleted in the reset, not being carried forward. | [superseded doc](buffett-munger-redesign-sprint-plan-2026-09-20.md) (Claude project doc) |

## Needs from Faiz right now

| Item | Why |
|---|---|
| **Push local commits to GitHub**: `git push origin main` (currently 2 commits ahead: `8ad0221` reset, `d01e601` guardrail doc) | This session's shell has no GitHub push access |
| **Delete the 6 leftover branches** on GitHub — commands in the sprint plan doc | Cleanup, not blocking |
| **Add `MISTRAL_API_KEY` to `backend/.env`** | Currently missing locally (only `GOOGLE_AI_STUDIO_API_KEY` is set) — blocks local testing of the Mistral fallback even though Railway may have it configured for production |
| Confirm go-ahead to start building Sprint 0's skeleton apps (FastAPI + React, deployed via the existing Dockerfiles) | Next concrete build step |

## Known ongoing issue

`device_bash` (the sandboxed shell used by Claude sessions on this machine) has no GitHub
credentials and no raw-TCP network access (HTTP(S)-via-proxy only, so it can't reach Supabase's
Postgres port directly either — schema was read from the local Alembic migration files instead,
which worked fine and needed no network at all).

## Changes / history

| Date | Session | Summary | Detail |
|---|---|---|---|
| 2026-09-21 | Sprint 0 started: guardrail doc + real schema mapped | Recreated a lean `CLAUDE.md` (5 non-negotiable rules + git/status-honesty/secrets discipline), committed locally as `d01e601` (not yet pushed — no GitHub access from this session). Mapped the real, current Supabase schema from the 12 kept Alembic migration files (no live DB connection possible or needed) — 21 tables, confirmed no separate non-equity tables exist, just a `holdings.asset_class` discriminator column and a nullable `portfolio_positions.acquired_at`. Found `MISTRAL_API_KEY` missing from local `.env`. All 3 prior open checkpoints (DB strategy, LLM provider, branch cleanup) decided by Faiz. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Full repo reset + rebuild plan written | Faiz overrode the prior day's "continue & consolidate" decision and had the repo wiped except Railway/Supabase/GitHub config, as a clean-slate restart. Committed and pushed as `8ad0221` ("reset") with full git history preserved. Real Supabase data untouched. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |

*Full pre-reset history (Phases 0–10 and the incremental Sprint 0-2 redesign work) is preserved in
this project's other docs and in git history.*
