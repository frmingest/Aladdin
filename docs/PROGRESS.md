# Progress

What's built, what's not, and where the detail lives. Build phases are architecture §26; the
reasoning behind each phase's choices lives in [`docs/decisions/`](decisions/) (ADRs). This file
tracks status — update it and the relevant ADR together when something changes.

**Status:** Phases 0–7 done and **deployed to Railway (production)** — backend + frontend both
online, keys set, Faiz has smoke-tested the Portfolio flow (accounts, CSV/XLSX upload, snapshots)
successfully. Phase 8 (alternative assets) planned. Documents/Analysis/Dashboard/research/risk
haven't been manually exercised on the live deploy yet — see "Open gaps" below. Whether the deployed
code is committed to git is unconfirmed (see "Manual to-do" below). Last full test-suite run
2026-09-14: 260 backend tests / ruff / tsc / vite build all clean; `npm run lint` still fails
(known gap below).

---

## Open gaps

**Deployed, but not all of it manually exercised yet** (keys are set and the app is live — this is
now just "has anyone actually clicked it," not "is it blocked"):
- ✅ Portfolio flow (accounts, CSV/XLSX upload, snapshots) — Faiz smoke-tested 2026-09-14, working "good for an alpha."
- ⬜ AI analysis (Gemini) — key is set on Railway, but no confirmed run against the live deploy yet.
- ⬜ Macro/sector research (FRED + Norges Bank) — `FRED_API_KEY` is set, but no confirmed refresh against the live deploy yet.
- ⬜ Portfolio risk snapshots, DCF valuation + critique, document upload — not yet exercised on the live deploy per Faiz's update.
- yfinance/Gemini/FRED/Norges Bank were previously verified only against mocks/docs from this build environment (no network path to any of them) — a live deploy removes that excuse; worth confirming each actually works once, not just that the key is present. ADR 0004/0005/0007.

**Deliberate scope limits** (not oversights — see the linked ADR if you want the reasoning):
- PDF/PPT are read as qualitative LLM text, not structured facts — XLSX-only for that (ADR 0006).
- DCF valuation and scenario shocks are illustrative/directionally-reasoned, not fitted to real market data (ADR 0008).
- Norwegian wealth-tax estimate is single-bracket, no per-couple splitting (ADR 0008).
- Jurisdictional concentration is proxied via `Holding.institution`, not a real custodian-country field.
- Portfolio-risk narrative is short deterministic text, not LLM prose (ADR 0008).
- Risk heatmap tile shading uses illustrative public reference bands, not the app's own `risk_v1.yaml` thresholds — the overall risk band/score next to it *is* the authoritative one (ADR 0009).

**Tooling debt:**
- No `eslint.config.js` — `npm run lint` fails outright (Phase 0 gap).
- No `black` config — codebase never run through it.
- `mypy app`: 11 `import-untyped` errors (missing stubs for pandas/openpyxl/fitz/yfinance/boto3/apscheduler) — cosmetic, not fixed yet.
- `tests/golden_documents/` and `tests/regression/` are empty scaffolds since Phase 0 (architecture §22.2/§22.3).
- `vite build`'s single JS bundle is ~615 kB / 172 kB gzipped (mostly recharts) — no code-splitting; fine at single-user scale.

**Feature gaps:**
- No calibration/track-record engine (§22.5) — needs weeks of real deployed history to be useful, so recommended *after* a live deploy exists.
- Evidence-packet excerpt selection has no relevance ranking, just most-recent-first (ADR 0006).
- Token/cost tracking is computed per analysis run but discarded, never persisted or surfaced (§23).
- `AssetClass` has no `COMMODITY`/`COLLECTIBLE` value yet — needed for Phase 8 (ADR 0011).
- `recent_events` on `AnalysisContext` unbuilt — macro/sector research partially covers the need.

---

## Deployment checklist (Railway)

**Live in production** as of 2026-09-14: backend + frontend both "Online" on Railway
(`exciting-gratitude-production-*.up.railway.app`), 13 service variables set including
`DATABASE_URL`, `GOOGLE_AI_STUDIO_API_KEY`, `FRED_API_KEY`, `APP_AUTH_TOKEN`, and the full
`OBJECT_STORAGE_*` set. Frontend shows "BACKEND OK."

- [x] Object storage provider (`S3ObjectStorageProvider`, R2/Supabase) — env vars set on Railway; not yet confirmed with a real upload/retrieve on the live deploy.
- [x] CORS middleware.
- [x] Backend + frontend Dockerfiles — these are presumably what Railway built from (Railway supports building from a Dockerfile directly, without a separate local `docker build`).
- [x] Single-user auth (`APP_AUTH_TOKEN`/`X-API-Key`) on every router except `/health`.
- [x] Supabase `DATABASE_URL` set + app is reading/writing through it — Faiz confirms Supabase is up; the working Portfolio flow (uploads persisting, snapshot history listing) is itself evidence `alembic upgrade head` applied cleanly.
- [x] Railway project + env vars set — confirmed via the Variables screen (13 service variables).
- [x] `GOOGLE_AI_STUDIO_API_KEY` + `FRED_API_KEY` obtained and set on Railway.
- [x] End-to-end smoke test — Portfolio flow tested and working ("good for an alpha," per Faiz 2026-09-14). Documents/Analysis/Dashboard not yet manually exercised on the live deploy — see "Open gaps" above.
- [ ] Live check of Phase 5's DCF critique + risk correlation (same keys as above) — not yet exercised.

## Manual to-do for Faiz

- Exercise the new thesis/valuation forms, document upload, and an AI analysis run once on the live
  deploy (create a thesis, change status, expand critique; upload a document; run an analysis) —
  the Portfolio tab is confirmed working, these aren't yet.
- **Git commit — status unclear, worth double-checking.** Railway's dashboard shows the services
  connected to GitHub repos (icons for "exciting-gratitude" and "Aladdin" under a GitHub-style
  connection). If Railway is set to auto-deploy from a GitHub repo, then yes — the running code was
  pushed to GitHub to get there, and this item is effectively done (though it's worth confirming
  today's `calculations.py` fix specifically made it in, since that was written directly to
  `E:\Aladdin` afterward and may not be in whatever commit Railway last deployed). If instead
  Railway was deployed via `railway up`/CLI from local files, that uploads whatever's on disk
  regardless of git status, and this item is still open — a live deploy isn't itself proof of a git
  commit. Quickest way to check: `git status`/`git log` in `E:\Aladdin`, or look at which commit
  Railway's Deployments tab says it last built from. Committing matters regardless of deploy
  method — it's your rollback point and history, independent of whether Railway has a copy.
- Optional: add `pandas-stubs`/`types-openpyxl` + a `mypy.ini` override for the untyped-import stub gaps above.

## Up next (candidates)

1. **Track-record & calibration engine** (§22.5) — a real deploy now exists, but it still needs weeks of live analysis history to have anything to calibrate against.
2. **Testing debt** — populate `golden_documents`/`regression`, add `black` + `eslint.config.js`.
3. **Precious metals** (Phase 8) — `COMMODITY` asset class, dated lots, manual single-holding entry, gold-api.com spot pricing. Design in ADR 0011.
4. **Whisky collection** (Phase 8) — manual CSV import (Whiskybase export format), carried at cost basis since no live pricing feed exists. Needs a real sample export from Faiz first. Design in ADR 0011.

---

## History

### Build phases (architecture §26)

| Phase | Status | Summary |
|---|---|---|
| 0 — Foundation | ✅ Done | FastAPI backend, React+Vite+Tailwind frontend, Postgres/Docker Compose, Alembic, pytest scaffold. Pushed to `main` on GitHub. |
| 1 — Portfolio + document ingestion | ✅ Done | CSV/XLSX upload (canonical + Nordnet export), PDF/PPT/XLSX document upload with dedup + object storage, deterministic XLSX fact extraction. ADR 0002, 0003. |
| 2 — Deterministic financial & market data | ✅ Done | yfinance `MarketDataProvider`, deterministic metrics (growth, margins, ROIC/ROE, multiples, FX, P&L, HHI). ADR 0004. |
| 3 — AI analysis | ✅ Done | Evidence packet, Google AI Studio (Gemini) two-pass Buffett/Munger analysis with confirmation-bias guardrail, deterministic scoring, memo generation. ADR 0005, 0006. |
| 4 — External research | ✅ Done | FRED + Norges Bank macro data, Gemini+Search grounding for macro/sector research, APScheduler background refresh. ADR 0007. |
| 5 — Thesis & portfolio intelligence | ✅ Done | Thesis ledger with invalidation checks, DCF valuation engine, scenario-impact engine, portfolio risk snapshots (concentration, correlation, systemic/state risk, wealth tax). ADR 0008. |
| 6 — Visualization | ✅ Done | Dashboard tab covering every §19 visualization, built entirely on Phase 1–5 endpoints. ADR 0009. |
| 7 — Deployment & production hardening | ✅ Done — live on Railway | Dockerfiles, CORS, single-user auth, durable object storage, migrations-on-boot. Deployed to production 2026-09-14; Portfolio flow smoke-tested. ADR 0010. |

### Changelog

- **2026-09-14 (deployed):** Faiz deployed backend + frontend to Railway (production) — both
  services "Online," `BACKEND OK` shown in the frontend header, 13 service variables set
  (`DATABASE_URL`/Supabase, `GOOGLE_AI_STUDIO_API_KEY`, `FRED_API_KEY`, `APP_AUTH_TOKEN`,
  `OBJECT_STORAGE_*`, etc.). Smoke-tested the Portfolio tab: accounts, CSV/XLSX upload, and
  snapshot history all working. Phase 7 marked done. Documents/Analysis/Dashboard/research/risk
  not yet manually exercised on the live deploy; whether the deployed code is committed to git is
  unconfirmed (see "Manual to-do" above).
- **2026-09-14 (verification pass):** Reviewed this file with Faiz and addressed known gaps before
  further development. Ran the frontend `tsc`/`build`/`lint` and full backend `pytest`/`ruff`/`mypy`
  checks that had never been run after the data-entry pass below (via the cloud-mirror workaround —
  `device_bash` still can't mount `E:\Aladdin` this session, a tracked Windows-update issue).
  Results: tsc clean, build succeeds, lint still fails (pre-existing gap), 260/260 backend tests
  pass, ruff clean. `mypy` found one real bug: `app.domain.calculations.quantize()` was typed
  `Decimal | None -> Decimal | None`, so 8 call sites that only ever pass a definite `Decimal`
  type-checked as if they could get `None` back (not a runtime bug, but a real gap against future
  edits) — fixed with an `@overload` pair, no behavior change. Also restructured this file for
  readability and added explicit "blocked on Faiz" markers throughout.
- **2026-09-14:** Frontend data-entry pass — added inline "+ New thesis" and "+ New valuation case"
  forms to `HoldingDetailSection`, made thesis status editable from the dashboard, added a
  valuation-case list with critique detail. Fixed a bug where `INVALIDATED` thesis status rendered
  in the same neutral color as a healthy one. Frontend-only, no backend changes; not yet verified
  or committed at the time (resolved by the verification pass above).
- **2026-09-14:** CWO visual redesign shipped (terminal design system, IBM Plex fonts,
  `.terminal-*` component classes) — presentation-only, no behavior change.
- **2026-09-14:** Faiz asked for two new asset types (physical gold/silver, whisky collection) —
  added as Phase 8 candidates, design in ADR 0011.
- **2026-09-13:** Reviewed codebase for what's next after Phase 6; promoted deployment hardening
  from a candidate to Phase 7.

### Resolved gaps

- ~~No frontend page renders Phase 4 research endpoints~~ — resolved by Phase 6's `MacroSection`.
- ~~No frontend page renders any Phase 5 endpoint~~ / ~~thesis/valuation creation is API-only~~ —
  resolved by Phase 6's `RiskSection`/`HoldingDetailSection`, then the 2026-09-14 data-entry pass.
- ~~No application authentication anywhere~~ — resolved by Phase 7's `APP_AUTH_TOKEN`.
- ~~Pydantic v2 serializes `Decimal` as a JSON string, undocumented beyond risk-snapshot columns~~ —
  corrected across frontend TypeScript types during Phase 6.
