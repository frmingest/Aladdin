# Progress

What's built, what's not, and where the detail lives. Build phases are architecture §26; the
reasoning behind each phase's choices lives in [`docs/decisions/`](decisions/) (ADRs). This file
tracks status — update it and the relevant ADR together when something changes.

**Status:** Phases 0–7 done and **deployed to Railway (production)** — backend + frontend both
online, keys set, Faiz has smoke-tested the Portfolio flow (accounts, CSV/XLSX upload, snapshots)
successfully. Phase 8 (alternative assets) planned; Phase 9 (document evidence quality) planned.
Documents/Analysis/Dashboard/research/risk haven't been manually exercised on the live deploy yet —
see "Open gaps" below. Whether the deployed code is committed to git is unconfirmed (see "Manual
to-do" below). Last full test-suite run 2026-09-14: 260 backend tests / ruff / tsc / vite build all
clean; `npm run lint` still fails (known gap below). **The LLM usage ledger (ADR 0013, this pass)
was written after that run and has not itself been test-verified yet — see "Open gaps."**

---

## Open gaps

**Deployed, but not all of it manually exercised yet** (keys are set and the app is live — this is
now just "has anyone actually clicked it," not "is it blocked"):
- ✅ Portfolio flow (accounts, CSV/XLSX upload, snapshots) — Faiz smoke-tested 2026-09-14, working "good for an alpha."
- ⬜ AI analysis (Gemini) — **attempted 2026-09-14, failed**: `gemini-2.5-flash` (the configured default) now 404s with "no longer available to new users" — Google's Gemini API has restricted it to existing accounts only. Fixed in code (default changed to `gemini-3.6-flash`, the replacement model Google's own error response named — see ADR 0005's Update section) but **not yet redeployed/reverified** — this is still the recommended verification step for Phase 9 planning below once the fix is live, since a real run against Vår Energi's two PDFs would confirm or correct the evidence-truncation estimate in ADR 0012.
- ⬜ Macro/sector research (FRED + Norges Bank) — `FRED_API_KEY` is set, but no confirmed refresh against the live deploy yet.
- ⬜ Portfolio risk snapshots, DCF valuation + critique, document upload — not yet exercised on the live deploy per Faiz's update.
- ⬜ **LLM usage ledger (new this pass, ADR 0013)** — `llm_usage_events` table, `/usage/summary` endpoint, Dashboard's new "Gemini usage today" section. **Not yet migrated, deployed, or test-verified**: `device_bash` was unavailable again this session (the Windows-update mount issue tracked since 2026-09-08), so this went through the stage → edit → commit-back path with no way to run `alembic upgrade head`/`pytest`/`tsc` locally. Needs: the new migration applied, a redeploy, and one real analysis run to confirm a row actually lands in `llm_usage_events` and the Dashboard widget renders correctly.
- yfinance/Gemini/FRED/Norges Bank were previously verified only against mocks/docs from this build environment (no network path to any of them) — a live deploy removes that excuse; worth confirming each actually works once, not just that the key is present. ADR 0004/0005/0007.

**Deliberate scope limits** (not oversights — see the linked ADR if you want the reasoning):
- PDF/PPT are read as qualitative LLM text, not structured facts — XLSX-only for that (ADR 0006). **`FACTS: 0` on a processed PDF/PPT document is expected, not a failure** — see ADR 0012 for what value that document actually delivers instead (document-chunk evidence at analysis time) and where that pipeline currently falls short.
- DCF valuation and scenario shocks are illustrative/directionally-reasoned, not fitted to real market data (ADR 0008).
- Norwegian wealth-tax estimate is single-bracket, no per-couple splitting (ADR 0008).
- Jurisdictional concentration is proxied via `Holding.institution`, not a real custodian-country field.
- Portfolio-risk narrative is short deterministic text, not LLM prose (ADR 0008).
- Risk heatmap tile shading uses illustrative public reference bands, not the app's own `risk_v1.yaml` thresholds — the overall risk band/score next to it *is* the authoritative one (ADR 0009).
- Free-tier rate limits (`LLM_RATE_LIMIT_RPM/TPM/RPD`, ADR 0013) are entered by hand, not fetched from Google — no public API exposes a free-tier AI Studio key's quota/usage, so these drift if the account's tier or model changes and need updating manually when they do.

**Tooling debt:**
- No `eslint.config.js` — `npm run lint` fails outright (Phase 0 gap).
- No `black` config — codebase never run through it.
- `mypy app`: 11 `import-untyped` errors (missing stubs for pandas/openpyxl/fitz/yfinance/boto3/apscheduler) — cosmetic, not fixed yet.
- `tests/golden_documents/` and `tests/regression/` are empty scaffolds since Phase 0 (architecture §22.2/§22.3).
- `vite build`'s single JS bundle is ~615 kB / 172 kB gzipped (mostly recharts) — no code-splitting; fine at single-user scale.

**Feature gaps:**
- No calibration/track-record engine (§22.5) — needs weeks of real deployed history to be useful, so recommended *after* a live deploy exists.
- Evidence-packet excerpt selection has no relevance ranking, just most-recent-first, and the excerpt budget is shared across all of a holding's documents rather than per-document (ADR 0006) — reviewed in detail 2026-09-14 against Vår Energi's real documents (a 208-page annual report likely gets truncated to near-zero content by a smaller, more-recently-uploaded quarterly report); concrete proposal in **ADR 0012 (Phase 9, proposed)**.
- `AssetClass` has no `COMMODITY`/`COLLECTIBLE` value yet — needed for Phase 8 (ADR 0011).
- `recent_events` on `AnalysisContext` unbuilt — macro/sector research partially covers the need.
- PDF/PPT-only holdings never get a structured `financial_metrics` snapshot (XLSX-only extraction, ADR 0002/0006) — `financial_metrics.insufficient_data` stays `True` for a holding like Vår Energi unless an XLSX with the same figures is also uploaded. Addressed as item 5 of ADR 0012.
- No visibility, on the Documents tab itself, into whether an uploaded document's content actually reaches an analysis run (page/chunk usage, truncation) — a processed PDF with `FACTS: 0` currently looks identical whether it contributed 200 pages of evidence or zero. Addressed as item 2 of ADR 0012.
- A failed holding analysis (LLMUnavailableError) still costs a Gemini call but records no `llm_usage_events` row — only a successfully-completed holding analysis does today (ADR 0013's Consequences). Low-stakes at single-user scale but means the usage ledger slightly undercounts against what Google's own dashboard would show if a run partially fails.

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
- [ ] `alembic upgrade head` for the new `llm_usage_events` table (migration `c7e2f9a1b8d3`, ADR 0013) — not yet applied anywhere.

## Manual to-do for Faiz

- Exercise the new thesis/valuation forms, document upload, and an AI analysis run once on the live
  deploy (create a thesis, change status, expand critique; upload a document; run an analysis) —
  the Portfolio tab is confirmed working, these aren't yet. **This is now also the fastest way to
  confirm or correct ADR 0012's evidence-truncation estimate for Vår Energi** — worth doing before
  Phase 9 work starts.
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
- **New, blocking:** redeploy the backend to Railway to pick up the `gemini-3.6-flash` default
  (code fix landed 2026-09-14, not yet deployed) — **and check whether Railway's `LLM_MODEL_NAME`
  service variable is set explicitly.** If it is, it still points at the retired
  `gemini-2.5-flash` and the code default won't override it; update the Railway variable directly
  to `gemini-3.6-flash` (or unset it to fall back to the code default), then redeploy. Same check
  for `backend/.env` locally if you run analyses outside Railway. See ADR 0005's Update section.
- **New, blocking for the usage ledger (ADR 0013) to do anything:** run `alembic upgrade head`
  (new migration `c7e2f9a1b8d3` adds `llm_usage_events`) against the real Postgres, then redeploy
  both backend (new `/usage` router, `app/services/usage`) and frontend (Dashboard's new "Gemini
  usage today" section). Then run the full backend `pytest`/`ruff`/`mypy` and frontend
  `tsc`/`build`/`lint` checks once `device_bash` is back — every file this pass touched (see the
  changelog entry below) was written but never executed this session, since the mount issue meant
  no local Python/Node was reachable to run them against.

## Up next (candidates)

1. **Document evidence quality (Phase 9, new this pass)** — per-document evidence budget (fixes a
   large report getting truncated to near-zero by a smaller, more-recent upload), evidence-usage
   visibility on the Documents tab, section-aware chunk prioritization, and closing the PDF-only
   `financial_metrics` gap. Design in ADR 0012. Recommended ahead of the items below: it makes an
   already-built, already-in-use feature (document upload) deliver more of the value it was built
   for, rather than adding new surface area.
2. **Track-record & calibration engine** (§22.5) — a real deploy now exists, but it still needs weeks of live analysis history to have anything to calibrate against.
3. **Testing debt** — populate `golden_documents`/`regression`, add `black` + `eslint.config.js`.
4. **Precious metals** (Phase 8) — `COMMODITY` asset class, dated lots, manual single-holding entry, gold-api.com spot pricing. Design in ADR 0011.
5. **Whisky collection** (Phase 8) — manual CSV import (Whiskybase export format), carried at cost basis since no live pricing feed exists. Needs a real sample export from Faiz first. Design in ADR 0011.

---

## History

### Build phases (architecture §26)

| Phase | Status | Summary |
|---|---|---|
| 0 — Foundation | ✅ Done | FastAPI backend, React+Vite+Tailwind frontend, Postgres/Docker Compose, Alembic, pytest scaffold. Pushed to `main` on GitHub. |
| 1 — Portfolio + document ingestion | ✅ Done | CSV/XLSX upload (canonical + Nordnet export), PDF/PPT/XLSX document upload with dedup + object storage, deterministic XLSX fact extraction. ADR 0002, 0003. |
| 2 — Deterministic financial & market data | ✅ Done | yfinance `MarketDataProvider`, deterministic metrics (growth, margins, ROIC/ROE, multiples, FX, P&L, HHI). ADR 0004. |
| 3 — AI analysis | ✅ Done | Evidence packet, Google AI Studio (Gemini) two-pass Buffett/Munger analysis with confirmation-bias guardrail, deterministic scoring, memo generation. ADR 0005, 0006. Evidence-selection quality reviewed 2026-09-14 — proposed follow-up is Phase 9 (ADR 0012), not a Phase 3 reopening. |
| 4 — External research | ✅ Done | FRED + Norges Bank macro data, Gemini+Search grounding for macro/sector research, APScheduler background refresh. ADR 0007. |
| 5 — Thesis & portfolio intelligence | ✅ Done | Thesis ledger with invalidation checks, DCF valuation engine, scenario-impact engine, portfolio risk snapshots (concentration, correlation, systemic/state risk, wealth tax). ADR 0008. |
| 6 — Visualization | ✅ Done | Dashboard tab covering every §19 visualization, built entirely on Phase 1–5 endpoints. ADR 0009. |
| 7 — Deployment & production hardening | ✅ Done — live on Railway | Dockerfiles, CORS, single-user auth, durable object storage, migrations-on-boot. Deployed to production 2026-09-14; Portfolio flow smoke-tested. ADR 0010. |

### Changelog

- **2026-09-14 (LLM usage ledger, ADR 0013):** Faiz asked whether a token-consumption indicator was
  feasible/reliable and whether it could integrate with Google AI Studio directly, using the Vår
  Energi run (3 documents/280 pages, single blind-pass call — Google AI Studio's own usage
  dashboard showed ~5.87K input / ~1.484K output tokens, 1 request) as a baseline. Researched: no
  public API exposes a free-tier AI Studio key's quota/usage — that dashboard is a Cloud Console UI
  backed by Cloud Monitoring, which would need a full GCP project plus service-account credentials
  wired up just to read numbers this app can already capture for free from its own Gemini
  responses. And it already half-does: `LLMAnalysisResult.total_input_tokens/total_output_tokens`
  (`app/services/analysis/llm_analysis.py`) were computed on every analysis call and then discarded
  before reaching the database — exactly the gap the Phase 8 status review flagged ("computed per
  analysis run, never persisted or surfaced"). Built: `llm_usage_events` table (new migration
  `c7e2f9a1b8d3`) recording one row per real Gemini call — analysis blind/reconciliation passes and
  macro/sector research grounding — straight from the vendor's own `usage_metadata`
  (`app.providers.base.LLMUsageMetrics`, a new vendor-agnostic shape both `GoogleAIStudioProvider`
  and `GeminiResearchProvider` now expose); `app.services.usage` compares the ledger against three
  new settings (`LLM_RATE_LIMIT_RPM/TPM/RPD`, defaults matching gemini-3.6-flash's free tier per
  Faiz's own screenshots) to estimate how many more holding analyses can run today, falling back to
  the Vår Energi numbers (`LLM_BASELINE_INPUT/OUTPUT_TOKENS`) as a calibration baseline until real
  ledger history exists to average instead; new `GET /usage/summary` endpoint; new "Gemini usage
  today" Dashboard section (requests-used bar, estimated analyses remaining, this-minute RPM/TPM,
  a note while still on the calibration fallback). Full reasoning: **ADR 0013**. **Not yet migrated,
  deployed, or test-verified this pass** — `device_bash` was unavailable again this session (the
  Windows-update mount issue tracked since 2026-09-08), so this went through the stage → edit →
  commit-back path with no way to run `alembic upgrade head`, `pytest`, `tsc`, or `vite build`
  locally; see "Manual to-do" and "Open gaps" above.
- **2026-09-14 (Gemini model fix):** Faiz's first real analysis run against Vår Energi (on the live
  Railway deploy) failed outright: `gemini-2.5-flash` — `settings.llm_model_name`'s default since
  ADR 0005 — 404s with "This model... is no longer available to new users," naming
  `models/gemini-3.6-flash` as the replacement. Confirmed via web search that `gemini-2.5-flash` has
  been restricted to pre-existing accounts and that `gemini-3.6-flash` is a GA Flash model with its
  own free tier as of 2026-09 (newer `gemini-3.7-flash`/`gemini-3.8-flash` also exist, but
  `gemini-3.6-flash` was picked because it's the exact replacement Google's own error named, not
  because it's newest). Fixed: `settings.py`'s default and `backend/.env.example`'s
  `LLM_MODEL_NAME` both updated to `gemini-3.6-flash`; `GoogleAIStudioProvider` itself untouched —
  config-only change. Documented as an Update section on **ADR 0005** rather than a new ADR, since
  it's the exact "revisit this default" follow-up that ADR already called for. **Not yet
  redeployed/reverified** — see "Manual to-do" above; also unconfirmed whether Railway's
  `LLM_MODEL_NAME` variable is set explicitly (would override this code fix and needs updating
  separately if so). Written directly to `E:\Aladdin` via the stage → edit → commit-back path
  (`device_bash` still unavailable this session).
- **2026-09-14 (Phase 9 planning):** Faiz reviewed the live Documents tab (Vår Energi: a 208-page
  annual report + 55-page quarterly report, both `PROCESSED`, both `FACTS: 0`) and asked what value
  document processing delivers and what a next phase should build. Reviewed the ingestion →
  extraction → evidence-packet → analysis pipeline end to end
  (`app/services/documents/*`, `app/services/analysis/context.py`, ADR 0002/0006). Confirmed
  `FACTS: 0` is expected/by-design for PDFs (structured extraction is XLSX-only), and identified two
  concrete, previously-hypothetical gaps ADR 0006 had flagged as deliberate v1 simplifications: the
  12,000-character evidence budget is shared across all of a holding's documents (not
  per-document) and consumed in upload-recency order, so a large older report can be truncated to
  near-zero content by a smaller newer one; and excerpt selection has no relevance ranking, just
  page order. Wrote **ADR 0012** proposing Phase 9 (per-document budget, evidence-usage visibility
  on the Documents tab, section-aware chunk prioritization, later real relevance ranking, and
  closing the PDF-only `financial_metrics` gap), added it to "Up next" above "Precious metals" and
  "Whisky" since it makes an already-built, already-in-use feature deliver more value rather than
  adding new surface area. **Planning only — no code changed this pass.** `device_bash` was
  unavailable again this session (the Windows-update mount issue tracked since 2026-09-08), so this
  went through the stage → edit → commit-back path for the two doc files; nothing else on
  `E:\Aladdin` was touched.
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
- ~~Token/cost tracking is computed per analysis run but discarded, never persisted or surfaced
  (§23)~~ — resolved 2026-09-14: `llm_usage_events` ledger, `/usage/summary` endpoint, and the
  Dashboard's "Gemini usage today" section (ADR 0013). Pending migration/deploy/test-verification —
  see "Open gaps."
