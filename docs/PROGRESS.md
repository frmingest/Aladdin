# Aladdin — Progress

Quick-glance tracker. Full technical detail for each item lives in its own doc (linked below); this
page stays a scan-able table, not a narrative.

**Last updated:** 2026-09-21

## Build phases

| Phase | What it is | Status |
|---|---|---|
| 0–10 | Everything built before the 2026-09-21 reset | 🗑️ Deleted — design knowledge preserved in the rebuild plan and the superseded doc |
| **11** | **Buffett/Munger single-focus rebuild** — from a clean-slate repo | 🚧 **Sprint 0 nearly closed** — [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |

## Sprint 0 checklist

| Item | Status |
|---|---|
| Guardrail doc (`CLAUDE.md`) | ✅ Done, committed |
| Map real Supabase schema | ✅ Done (13 Alembic migration files → 21 tables) |
| DB strategy decision | ✅ Decided — leave schema/data as-is |
| LLM provider decision | ✅ Decided — Gemini + Mistral |
| Legacy frontend cleanup | ✅ Done, committed and pushed |
| Skeleton FastAPI backend (`/health`) | ✅ Built. Code unchanged since it was last locally tested (`uvicorn` + `curl /health` → 200 OK). **Not deployed to Railway** — no network path exists from either session shell to check a live URL. |
| Skeleton React frontend (health badge) | ✅ Built, **re-verified this session** (`npm run build` clean). **Not deployed to Railway.** |
| `MISTRAL_API_KEY` in `backend/.env` | ✅ **Added this session** — see "Found today" below |
| Wire Gemini + Mistral (budget guard, retry/backoff, RPM pacing) | 🟢 Unblocked, **not started** — the only thing left open in Sprint 0 |

## Found today (2026-09-21, this audit)

1. **The project docs were stale, not the repo.** `main` had 2 commits this project's docs didn't
   know about (`cc48e2f`, `015a39c`) — a prior pass had already pushed the 3 skeleton commits *and*
   mirrored `progress.md`/the sprint plan into `docs/` for GitHub. `git status` shows `main` clean
   and up to date with `origin/main`. The "3 commits not yet pushed" line from the last update was
   already wrong by the time this session started — corrected here.
2. **`MISTRAL_API_KEY` had been typed into `backend/.env` in the editor but never saved to disk.**
   The file's on-disk timestamp was still 2026-09-13 (a week before this rebuild started), with no
   `LLM_FALLBACK_PROVIDER`/`MISTRAL_API_KEY` lines. Added both directly on Faiz's machine this
   session (values confirmed from the screenshot he shared) — Sprint 0's last blocker is now
   cleared.
3. **Config mismatch to resolve before the provider-wiring code is written:** `backend/.env` still
   has `LLM_PROVIDER=anthropic` with `ANTHROPIC_API_KEY` empty — inconsistent with the decided
   Gemini-primary/Mistral-fallback setup and with `.env.example`'s own default
   (`google_ai_studio`). **Needs a call from Faiz**: switch it to `google_ai_studio`, or is
   Anthropic meant to be a real third option?
4. **Minor doc-hygiene debt, not urgent:** both `.env.example` files still reference
   `docs/decisions/000x-*.md` ADR files that no longer exist post-reset (only `PROGRESS.md` and the
   sprint plan were kept in `docs/`). Comments only, harmless — worth cleaning up once Sprint 1
   starts touching those files anyway.
5. Cleared a stale `.git/index.lock` and a stray `frontend/vite.config.ts.timestamp-*.mjs` left on
   disk by earlier tooling — housekeeping only, nothing was broken by them.

## Design & UX direction — set 2026-09-21

Aladdin's UI has changed identity three times pre-reset (a CWO-clone terminal look → its own amber
Bloomberg-terminal redesign → an ad hoc Tailwind slate dark theme), without ever locking one in.
Faiz asked for a deliberate, research-backed direction this time — "clean, simple, beautiful,
investment-grade," not a data-dense terminal. Full research and the concrete tokens/patterns are in
the [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md#design--ux-direction-researched-2026-09-21).

Short version: **light, editorial, restrained — closer to Mercury and the Stripe Dashboard than to
a Bloomberg terminal.** This is what Sprint 5 (dashboard) builds toward; Sprint 1's forms and
skeleton pages should already follow the same tokens so the UI isn't re-decided a fourth time.

## Needs from Faiz right now

| Item | Why |
|---|---|
| Confirm this session's docs commit reached GitHub (`git push origin main` if not) | No GitHub push credentials in either session shell |
| Decide `LLM_PROVIDER`: `google_ai_studio` vs. keep `anthropic` | Blocks writing the provider-wiring code cleanly |
| Confirm the design direction below (or push back on it) | Sprint 1/5 build against it once confirmed |
| Delete the 6 leftover branches on GitHub — commands in the sprint plan doc | Still pending, not blocking |

## Known ongoing issue

Neither this session's cloud shell nor the shell on Faiz's linked device has GitHub push
credentials or raw-TCP network access — commits have to be pushed by Faiz from his own terminal,
and any DB schema work reads the local Alembic migration files rather than connecting to Supabase
directly.

## Changes / history

| Date | Session | Summary | Detail |
|---|---|---|---|
| 2026-09-21 | Status audit + Sprint 1/next-phase planning + UX research | Verified actual repo state against the docs (found the docs, not the repo, were stale — 2 commits already pushed that the docs didn't reflect). Saved the Mistral fallback key to `backend/.env` on Faiz's machine (was typed but unsaved), clearing Sprint 0's last blocker. Re-verified the frontend build is still clean. Researched clean/minimal investment-grade fintech UI (Mercury, Stripe Dashboard, Wealthfront) and set a concrete design direction. Expanded Sprint 1 with concrete deliverables. Flagged an `LLM_PROVIDER` config mismatch and minor dangling-doc-reference cleanup for Faiz to weigh in on. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 skeletons built | Found and removed leftover legacy frontend (49 files) the reset had missed. Built and locally tested the skeleton FastAPI backend (`/health`) and skeleton React frontend (health badge), fixed a stale Dockerfile. 3 commits made; since confirmed pushed. Gemini+Mistral wiring was blocked on `MISTRAL_API_KEY`. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Sprint 0 started: guardrail doc + real schema mapped | Recreated a lean `CLAUDE.md`, committed. Mapped the real Supabase schema from Alembic migrations (21 tables, no separate non-equity tables). Found `MISTRAL_API_KEY` missing from local `.env`. All 3 prior open checkpoints decided by Faiz. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |
| 2026-09-21 | Full repo reset + rebuild plan written | Faiz had the repo wiped except Railway/Supabase/GitHub config, as a clean-slate restart. Committed and pushed as `8ad0221` ("reset") with full git history preserved. Real Supabase data untouched. | [rebuild sprint plan](buffett-munger-rebuild-sprint-plan-2026-09-21.md) |

*Full pre-reset history (Phases 0–10 and the incremental Sprint 0-2 redesign work) is preserved in
this project's other docs and in git history.*
