# Progress

What's built, what's not, and where the detail lives. Build phases are architecture §26; the
reasoning behind each phase's choices lives in [`docs/decisions/`](decisions/) (ADRs). This file
tracks status — update it and the relevant ADR together when something changes.

**Status:** Phases 0–6 done, Phase 7 (deployment hardening) code-complete but not deployed
anywhere, Phase 8 (alternative assets) planned. Nothing has been committed to git since Phase 0 —
all later work sits directly in `E:\Aladdin`, uncommitted. Last verified 2026-09-14: 260 backend
tests / ruff / tsc / vite build all clean; `npm run lint` still fails (known gap below).

---

## Open gaps

**Needs Faiz's keys/accounts/hardware to move further** (all code-complete on this side, only
live verification is missing):
- Real API keys not yet set: `GOOGLE_AI_STUDIO_API_KEY` ([get one](https://aistudio.google.com/apikey)) and `FRED_API_KEY` ([get one](https://fred.stlouisfed.org/docs/api/api_key.html)) — analysis and macro refresh fail immediately without them.
- No live smoke test yet against yfinance, Gemini, FRED, or Norges Bank — all verified only against mocks/docs so far (this build environment has no network path to any of them). ADR 0004/0005/0007.
- No real deploy — Railway project, Supabase/Postgres, R2/Supabase bucket, `docker build` all still need Faiz's own accounts/machine. See "Deployment checklist" below.

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

Phase 7 closed every code-level item (Dockerfiles, CORS, single-user auth, durable object storage,
migrations-on-boot — ADR 0010). Everything left needs Faiz's own accounts/hardware:

- [x] Object storage provider (`S3ObjectStorageProvider`, R2/Supabase) — code done, untested against a real bucket.
- [x] CORS middleware.
- [x] Backend + frontend Dockerfiles — code done, never actually `docker build`'d (needs Faiz's WSL2/Docker Desktop).
- [x] Single-user auth (`APP_AUTH_TOKEN`/`X-API-Key`) on every router except `/health`.
- [ ] Supabase `DATABASE_URL` + `alembic upgrade head` against real Postgres.
- [ ] Railway project + env vars set.
- [ ] `GOOGLE_AI_STUDIO_API_KEY` + `FRED_API_KEY` obtained and set.
- [ ] End-to-end smoke test on the deployed instance.
- [ ] Live check of Phase 5's DCF critique + risk correlation (same keys as above).

## Manual to-do for Faiz

- Exercise the new thesis/valuation forms once in the running app (create, change status, expand critique) — needs your own eyes on it.
- Git commit — everything since Phase 0 (through today's `calculations.py` fix) is still uncommitted.
- Optional: add `pandas-stubs`/`types-openpyxl` + a `mypy.ini` override for the untyped-import stub gaps above.

## Up next (candidates)

1. **Track-record & calibration engine** (§22.5) — best done after a real deploy exists to calibrate against.
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
| 7 — Deployment & production hardening | 🟡 Code done, not deployed | Dockerfiles, CORS, single-user auth, durable object storage, migrations-on-boot. ADR 0010. |

### Changelog

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
