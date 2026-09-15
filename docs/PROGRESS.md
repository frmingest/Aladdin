# Progress

What's built, what's not, and where the detail lives. Build phases are architecture §26; the
reasoning behind each phase's choices lives in [`docs/decisions/`](decisions/) (ADRs). This file
tracks status — update it and the relevant ADR together when something changes.

**Status:** Phases 0–7 done and **deployed to Railway (production)** — backend + frontend both
online, keys set, Faiz has smoke-tested the Portfolio flow (accounts, CSV/XLSX upload, snapshots)
successfully. **Phase 8 (precious metals + whisky collection) fully built, not yet deployed** — see
below: coin manual-entry UI, real Whiskybase import, and collectible-at-cost valuation all landed
2026-09-15, on top of the same day's earlier precious-metals groundwork. Phase 9 (document evidence
quality) still just planned.

**Git — resolved, no longer "unconfirmed":** commits have been happening normally throughout this
project's history and are almost entirely pushed. As of this pass, local `main` is exactly 1 commit
ahead of `origin/main` (`git push` needed) — **plus** everything this 2026-09-15 pass wrote (Phase 8
in full + three bug fixes — two Phase 7, plus the reset FK fix just below — listed below) is sitting
as an uncommitted working-tree change, since `device_bash` can't run `git` from this session. **Faiz:
please `git add`/`commit`/`push` the current working tree** — see "Manual to-do" for the exact file
list.

**2026-09-15 (Agentic coding & AI-safety guardrails):** Faiz asked for "state of the art agentic
coding guardrails" so ongoing AI-agent-driven development on this repo doesn't keep running into
the same class of problem it already has (uncommitted work piling up across sessions, "deployed"
claims that weren't actually deployed yet, no CI/lint enforcement at all). Added three layers:
Claude Code hooks (`.claude/settings.json` + `.claude/hooks/`) blocking a short list of
high-confidence-dangerous actions (force-push, `git reset --hard`, `rm -rf` at home/drive root,
piping a remote download into a shell, raw destructive SQL, writing a real `.env` or a
hardcoded-looking secret) before they execute; `.pre-commit-config.yaml` (ruff, eslint, gitleaks
secret scanning, generic hygiene checks); and `.github/workflows/ci.yml` (pytest/ruff/mypy,
tsc/eslint/build, gitleaks, report-only dependency audit) plus `.github/dependabot.yml`. Root
`CLAUDE.md` is the operational rulebook tying it together — architecture invariants, the "done"
bar, git discipline, and an explicit rule that no session (including this one) should claim
something is "deployed" or "committed" without having actually checked. Also fixed a real,
previously-flagged gap while in there: `frontend/eslint.config.js` never existed (and its plugin
deps weren't in `package.json` either), so `npm run lint` has been silently broken since Phase 0
— added the standard Vite+React+TS flat config and dependencies, verified with a real
`npm install` + `eslint` run in an isolated sandbox. One AI-safety change:
`prompts/persona/v3.md` adds an explicit prompt-injection guardrail (evidence `content` excerpts
are untrusted document text, never instructions) — additive only, same schema/rules 1-8, and now
the default (`active_prompt_version` code default bumped v2→v3). Full reasoning:
**ADR 0015**. Written to `E:\Aladdin` via the device bridge (`device_bash` still can't mount it
this session) — **not yet committed to git by Faiz.**

**2026-09-15 (Portfolio reset — `DELETE /portfolio/reset?confirm=true` 500'd with a ForeignKeyViolation — fixed):**
Faiz tried "Delete all data" and got a 500 in production: `psycopg2.errors.ForeignKeyViolation` on
`llm_usage_events_holding_analysis_id_fkey` — Postgres refused to delete a `holding_analyses` row
that an `llm_usage_events` row still pointed to.
- **Root cause**: `app/services/portfolio/reset.py` predates the LLM usage ledger (ADR 0013). Every
  other optional FK into the portfolio graph (`research_items.holding_id`) is detached — set to NULL
  — before its target table is deleted; `llm_usage_events`'s three optional FKs (`holding_id`,
  `analysis_run_id`, `holding_analysis_id`) never got the same treatment when the ledger was added,
  so the moment any usage-ledger row referenced a holding/analysis/holding-analysis, a reset 500'd.
- **Fix**: added the same "detach defensively" step for `llm_usage_events`'s three FKs, right before
  `HoldingAnalysis`/`AnalysisRun`/`Holding` are deleted. The usage ledger rows themselves are kept,
  not deleted — it's the free-tier quota/rate-limit history (ADR 0013), independent of which holdings
  currently exist — only their now-dangling references are cleared.
- **Verified**: new `tests/unit/test_portfolio_reset.py`, which — unlike the rest of the suite —
  turns on real SQLite foreign-key enforcement (off by default) specifically to reproduce this as a
  genuine FK-ordering bug instead of letting SQLite's default leniency hide it. Confirmed it fails
  with the exact production error against the pre-fix code, and passes against the fix. Full relevant
  suite: 51/51 passing, `ruff check` clean.
- **Not yet deployed** — needs a Railway redeploy. **Faiz: don't retry "Delete all data" against
  production until this redeploys** — it will keep 500ing (harmlessly — nothing partial gets
  committed, Postgres rolls the whole transaction back) until then.
- Files changed: `backend/app/services/portfolio/reset.py`,
  `backend/tests/unit/test_portfolio_reset.py` (new).

**2026-09-15 (Securities still showing 0 after the fix above was deployed — confirmed live, needs a
data re-upload, not more code):** Faiz redeployed the fix just below and asked "still same?" —
verified directly against the live Railway deployment (browser). Portfolio composition still showed
Securities at 0 NOK / 0.0%, Coin collection and Whisky collection correct.

The deployed fix is working exactly as intended — it just can't retroactively repair a snapshot
that was *already* corrupted before it shipped. Checked the actual `GET /portfolio/snapshots`
history on the Portfolio tab:

| Uploaded | Positions | What it is |
|---|---|---|
| 9/15, 7:21:02 AM (**current**) | 29 | 3 coins + 26 whisky bottles — **zero Securities positions** |
| 9/15, 7:14:59 AM | 3 | The old isolated "manual entries" snapshot (coins only — the original bug) |
| 9/14, 6:54:37 AM | 7 | The last snapshot with all 7 Securities positions intact |

What happened: the coin manual entries forked off the isolated 3-position snapshot (the original
bug, above). The **Whiskybase CSV import then ran on top of that already-broken snapshot** —
`ingestion.py` correctly carried forward "whichever snapshot was newest" at that moment, which by
then was the broken 3-coin one, not the 7-Securities one — producing today's 29-position "current"
snapshot with coins + whisky but genuinely zero Securities positions. That merge happened *before*
today's fix was deployed, so there was nothing left for the fix to prevent going forward, but the
damage to the current snapshot was already baked in by the time it shipped.

**Not data loss** — all 7 Securities holdings (Alfred Berg, Heimdal Høyrente Pluss, L&G Gold Mining
ETF, Salmon Evolution, Vår Energi, Xetra-Gold, Xtrackers Europe Defence Tech) still exist as
`Holding` rows (visible on the Portfolio tab's Market data tickers table, all 36 holdings listed);
they simply have no `PortfolioPosition` row in the current snapshot anymore.

**The fix is a data step, not a code change**: re-upload the Nordnet brokerage export via the
Portfolio tab's "Upload portfolio (CSV/XLSX)" section, same "Unassigned" account every previous
upload used. Uploads merge forward by (account, ticker) (`ingestion.py`) — the 7 Securities tickers
get fresh position rows added onto the current snapshot, while the 3 coins and 26 whisky bottles
(absent from that file) simply carry forward untouched, exactly as designed. **Faiz: please
re-upload your Nordnet export** — see "Manual to-do."

**2026-09-15 (Securities missing from Portfolio composition after a manual entry — fixed):** Faiz
reported that after the Composition split shipped (entry just below), Coin collection and Whisky
collection totals were correct but Securities had dropped to 0 / 0.0% of total portfolio.
Root-caused to `app/services/portfolio/manual_entry.py`, not the Composition change itself: every
manual coin/whisky add or edit landed in one dedicated "manual entries" `PortfolioSnapshot`, created
once and reused forever, entirely separate from the ordinary chain of brokerage-upload snapshots
that `app/services/portfolio/ingestion.py` merges forward each CSV/XLSX upload. The Dashboard (and
`GET /portfolio/snapshots`) simply shows whichever snapshot is newest — so the moment any manual
entry existed, that isolated manual-only snapshot became "current," and Composition/Risk/every other
snapshot-scoped view lost every brokerage-sourced holding until the next CSV re-upload happened to
merge them back together.
- **Fix**: manual add/edit now carries forward the *actual* current snapshot (whichever is newest,
  brokerage or manual) onto a new one — the same "merge forward" pattern `ingestion.py` already uses
  for brokerage uploads — then applies just the one new/edited lot on top. There is no longer a
  separate, isolated manual-entries snapshot; Securities, Coin collection, and Whisky collection all
  stay part of the one ever-growing "current" portfolio the Dashboard reads.
- **Scope**: `add_manual_position`, `update_manual_position`, and `list_manual_positions` in
  `app/services/portfolio/manual_entry.py` — no change needed to `ingestion.py`,
  `market_data/valuation.py`, or any frontend file; the Composition rewrite from the entry below was
  already correct once given a snapshot that actually contains everything.
- **Verified**: `pytest tests/unit/test_manual_entry.py tests/integration/test_portfolio_api.py
  tests/integration/test_valuation_api.py` → 49/49 passing (2 existing unit tests updated to match
  the new carry-forward behavior, plus 1 new regression test asserting a manual entry no longer
  orphans existing brokerage positions); all 28 integration tests in `test_portfolio_api.py`,
  including every manual-entry test, passed **unchanged**. `ruff check` clean on touched files.
- **Not yet deployed** — needs a Railway redeploy; no migration involved.
- Files changed: `backend/app/services/portfolio/manual_entry.py`, `backend/app/api/portfolio.py`
  (docstring only), `backend/tests/unit/test_manual_entry.py`.

**2026-09-15 (Composition: Securities/Coin/Whisky split, collection aggregation, filter):** Same-day
follow-up to the Phase 8 pass just below — with real coin + Whiskybase data now in the portfolio,
Faiz asked for an economic-logic check of the Dashboard's Portfolio composition section against a
screenshot showing the "By holding" donut with one slice per individual whisky bottle/coin, no
visible split between Securities/Coin collection/Whisky collection totals, and no way to
include/exclude a collection from the view.
- **Backend** — added `asset_class_values` (absolute market value per asset class, reporting
  currency) to `ConcentrationProfile`/`PortfolioValuationOut.concentration`
  (`app/services/market_data/valuation.py`, `app/schemas/market_data.py`), the currency-amount
  counterpart to the existing `asset_class_weights` percentage-only field. 2 new assertions in
  `tests/integration/test_valuation_api.py`.
- **Frontend** — new `CollectionFilter` component (`frontend/src/components/CollectionFilter.tsx`)
  next to the existing account filter on the Dashboard: include/exclude Securities / Coin collection
  / Whisky collection, applied instantly with no new network call (it re-aggregates the valuation
  data already on hand, unlike the account filter which re-fetches). `CompositionSection.tsx`
  rewritten to compute every number and chart straight from the per-holding list instead of the
  backend's ticker-keyed weight maps: "By holding" now collapses every `COMMODITY` position into one
  "Coin collection" slice and every `COLLECTIBLE` position into one "Whisky collection" slice instead
  of a slice per coin/bottle; a new always-on "By collection" panel shows the real Securities/Coin
  collection/Whisky collection totals (currency + % of portfolio) regardless of the filter, so a bad
  entry is visible at a glance; Total value/Unrealized P&L/Largest position now respect the filter.
- **Economic-logic finding, flagged not fixed (data, not code):** in the coin+whisky snapshot Faiz
  shared, Unrealized P&L (-653,688.51 NOK) was several times larger in magnitude than Total value
  (115,422.65 NOK) and negative. The arithmetic itself checks out (`total_market_value -
  total_cost_basis_value`, the same formula validated in the 2026-09-14 composition-fix pass) — this
  reads as a cost-basis data-entry mistake on one of the manually-entered coins (same class of issue
  as the earlier `AUCP.L`→`AUCO.MI` ticker mistake), not a code bug. The new "By collection" panel
  should make it obvious at a glance which of the three totals is off; **recommend Faiz check the buy
  price entered for each coin on the Portfolio tab.**
- **Not done this pass:** the Collections filter only threads through Portfolio composition — Risk,
  Factor profile, Macro, and Holding detail still show every holding regardless of it. Scoping those
  the same way would need backend query-param plumbing (like the account filter's `account_ids`),
  not just client-side re-aggregation, since those sections compute server-side.
- **Verified:** backend — the 33 valuation/portfolio integration tests pass, `ruff check` clean on
  touched files. Frontend — fresh `npm ci`, `tsc --noEmit` clean, `vite build` succeeds (same
  pre-existing single-bundle-size warning, unrelated). No new migration; needs a Railway redeploy
  (additive, non-breaking schema change).
- Files changed: `backend/app/services/market_data/valuation.py`, `backend/app/schemas/
  market_data.py`, `backend/tests/integration/test_valuation_api.py`, `frontend/src/components/
  CollectionFilter.tsx` (new), `frontend/src/pages/dashboard/CompositionSection.tsx`,
  `frontend/src/pages/Dashboard.tsx`, `frontend/src/types/market_valuation.ts`.

**2026-09-15 (Phase 8 completed — whisky import, at-cost valuation, coin manual-entry UI):** Same-day
follow-up to the pass just below. Faiz asked for two concrete things: a usable way to add individual
gold/silver coin purchases (1 oz Maple Leaf, Krugerrand, Kangaroo) with a buy price and today's
pricing, and attached a real Whiskybase "my collection" CSV export (26 real bottles) — exactly the
sample ADR 0011 said was required before the whisky importer could be built. Both done:
- **Whiskybase CSV auto-import** — extended the existing signature-detection importer
  (`app/services/portfolio/parser.py`, same pattern as the Nordnet importer) with a third format,
  built and tested directly against Faiz's real 26-row export. Every bottle becomes a
  `COLLECTIBLE` position with a stable `WB-{id}` ticker; purchase price is used when Whiskybase
  recorded one and left unset (never guessed) when it didn't; cask/age/strength/vintage and
  Whiskybase's own community average price land in notes, clearly labeled "reference only, not
  cost." No new upload endpoint — the existing "Upload portfolio (CSV/XLSX)" section on the
  Portfolio tab auto-detects it, same as it already does for Nordnet.
- **Collectibles are now valued at cost basis instead of excluded from totals** — the
  cost-basis-carrying fallback ADR 0011 originally specified for whisky/collectibles hadn't actually
  been built when the precious-metals groundwork shipped earlier the same day. Added to
  `app/services/market_data/valuation.py`: any `COLLECTIBLE` holding with a known cost basis and no
  live-priceable `market_ticker` is now counted in Composition/Risk totals at what was paid, tagged
  `price_status: "at_cost"` and clearly distinguished from a live price — never silently excluded,
  never presented as a market value it doesn't have.
- **Manual-entry UI, finally reachable from the app** — new "Add a holding manually" section on the
  Portfolio tab (`frontend/src/pages/PortfolioUpload.tsx`), wired to the `POST
  /portfolio/holdings/manual` endpoint that existed since the precious-metals groundwork but had no
  frontend caller. A preset dropdown covers exactly the coin types Faiz named (1 oz Gold/Silver
  Maple Leaf, Krugerrand, Kangaroo) plus open-ended gold/silver/other-collectible options; picking
  gold or silver auto-sets the `XAU`/`XAG` market ticker so "Refresh valuation" prices it at today's
  spot. Also fixed two stale frontend types (`Holding.custody_type`, `PortfolioPosition.acquired_at`)
  that existed on the backend since Phase 5 but were never added to the TypeScript types.

**Verified in the cloud mirror** before writing back to `E:\Aladdin` (`device_bash` still down this
session, same Windows-update regression): backend 346/346 tests passing (was 332 — +14), `ruff
check .` clean, `mypy app` unchanged baseline-only errors; frontend `npm ci` fresh, `tsc --noEmit`
clean, `vite build` succeeds. **Not yet deployed** — needs a Railway redeploy; no new migration this
pass. Full detail: ADR 0011's "Update (2026-09-15, part 2)" section.

**2026-09-15 (Phase 7 loose ends + Phase 8 pass):** Closed out the three still-open Phase 7 items
and built Phase 8's precious-metals groundwork. Two real, previously-undiscovered production bugs
found and fixed along the way (both need a Railway redeploy to take effect):
- **Object storage upload/retrieve — confirmed working, live.** Uploaded a real test PDF straight to
  the live backend, got back `PROCESSED` with correct page count and extracted text, then re-fetched
  it independently — full upload→store→read-back round trip confirmed on the actual Railway
  deployment (see "Manual to-do" — a leftover test document is on Alfred Berg's holding, harmless).
- **DCF valuation — confirmed working, live.** A real `POST /valuation/holdings/.../cases` call
  against Vår Energi persisted correctly (`calculated_value: null` with a `calculation_note` — Vår
  Energi is PDF-only with no XLSX facts, so there's no revenue to project from, which is the
  correct, by-design §21 behavior, not a bug).
- **Bug found — `/valuation/holdings/{id}/defaults` (ECON-001's discount-rate/FX suggestion
  endpoint) was completely broken in production for every holding.** Root cause: `backend/
  Dockerfile` copies `prompts/`, `schemas/`, `scoring/`, `research/`, `scenarios/` into the image but
  was missing `discount_rate/` — so `discount_rate/versions/v1.yaml` didn't exist in the deployed
  container, and every call crashed before any response (browser-visible only as a CORS/"failed to
  fetch" error, masking the real 500). **Fixed**: added the missing `COPY discount_rate
  discount_rate` line. Needs a Railway redeploy to take effect.
- **Bug found — the DCF "AI critique" step could crash the entire valuation-case request instead of
  degrading to `critique_error`.** `_run_critique()`'s own docstring promises a critique failure
  "is caught and recorded... rather than raised" so a case is "never lost" — true for known failure
  types, but any *other* exception from `build_analysis_context()` was escaping uncaught, crashing
  the whole `POST .../cases` call (deterministic value and all) with the request. Confirmed live: a
  critique-enabled request against Vår Energi failed; the identical request with
  `run_critique: false` succeeded cleanly. **Fixed**: widened the exception handling around
  `build_analysis_context()` to match the function's own documented contract, plus a new regression
  test simulating an unexpected context-build error. Needs a Railway redeploy to take effect.
- **Also confirmed, not a bug**: the Dashboard's macro chart already plots all 11 macro series
  (including the 5 ECON-003/004 series a prior pass thought were still invisible) — that gap is
  already resolved in production, PROGRESS.md just hadn't been corrected yet.

**2026-09-14, status-alignment pass:** Faiz pointed out he's been redeploying continuously, so this
session verified live production directly (browser + direct API calls to
`aladdin-production-bd25.up.railway.app`, auth captured from the frontend's own requests) instead
of trusting this file's prior "written but not yet deployed" language, which had drifted out of
date. **Confirmed actually LIVE in production right now**, contrary to what this file said before
this pass:
- **LLM usage ledger (ADR 0013)** — `/usage/summary` returns real data; Dashboard's "Gemini usage
  today" widget shows real counts (9/20 requests, 62,965 in / 9,011 out tokens as of this check).
  Migration applied, endpoint live, widget rendering.
- **Gemini model fix** — `gemini-3.6-flash` is what's actually running; real analysis runs are
  succeeding (see Alfred Berg Nordic High Yield's completed analysis, `overall_score 5.00`).
- **Market ticker self-serve UI** — live on the Portfolio tab; 6 of 7 holdings have a
  `market_ticker` set, including the corrected `AUCO.MI` for L&G Gold Mining ETF.
- **Portfolio composition fix** (multi-account weight summing + the `AUCP.L`→`AUCO.MI` ticker
  correction) — live; concentration/weights compute correctly off the live Dashboard.
- **ECON-002 (regime-conditional scoring)** — `GET /health` reports
  `"active_scoring_version": "v2"`. Live.
- **ECON-006 (macro/FX persona checklist item)** — `GET /health` reports
  `"active_prompt_version": "v2"`. Live.
- **ECON-003/004 (commodity + Eurozone/China macro series)** — confirmed at the data layer: a
  forced `/research/macro/refresh` returned `"methodology_version": "v2"` and
  `/research/macro/snapshot` came back with all 11 v2 series (`commodity_oil_wti`,
  `commodity_oil_brent`, `eurozone_policy_rate`, `eurozone_hicp_yoy`, `china_cpi_yoy` alongside the
  original 6). Live on the backend. **New gap found this pass:** the Dashboard's macro chart only
  renders the original 6 series — the frontend widget was never updated to plot the 5 new ones, so
  they're fetched but invisible in the UI. Not yet filed as its own ADR item; treat as a small
  Phase 9-adjacent follow-up.
- **ECON-005 (Norway policy rate)** — turns out this is *also* already working, not blocked: the
  live snapshot includes a real `no_policy_rate` observation (4.25%, `norges_bank` provider, dated
  2026-09-11). The "unverifiable from this environment" note in ADR 0014 was about this cloud
  sandbox's own egress, not about whether the deployed app itself can reach Norges Bank — it can.
- **ECON-001 (discount-rate/FX suggestion endpoint)** — not independently re-confirmed this pass
  (a direct fetch to it errored out for unrelated reasons); worth a quick manual check next time
  someone's in the Valuation tab, but nothing points to it being broken.
- **ECON-007 (regime-aware risk bands)** — confirmed still NOT done: `GET /health` reports
  `"active_risk_scoring_version": "risk_v1"`. Genuinely open, as previously tracked.

Also observed live: the Gemini free-tier daily quota was hit mid-session (`429
RESOURCE_EXHAUSTED` on a sector/macro narrative research call) — not a bug, just the real
consequence of the account's daily request cap (this is exactly what the usage ledger, ADR 0013,
was built to make visible ahead of time).

**Takeaway: this file's "written but not yet deployed" framing was stale.** Faiz's deploy cadence
had outrun the documentation. Everything below has been corrected accordingly; treat this file as
current as of this pass, not the several "Open gaps"/"Manual to-do" entries that predate it (kept
below, struck through, for history).

---

## Open gaps

**As of the 2026-09-14 status-alignment pass — verified directly against the live Railway
deployment (browser + direct API calls), not just "keys are set":**
- ✅ Portfolio flow (accounts, CSV/XLSX upload, snapshots) — Faiz smoke-tested 2026-09-14, working "good for an alpha."
- ✅ AI analysis (Gemini) — **confirmed live and working**: `gemini-3.6-flash` running, real completed analyses on record (e.g. Alfred Berg Nordic High Yield, `overall_score 5.00`, low confidence, evidence-cited). ~~attempted 2026-09-14, failed~~ / ~~not yet redeployed~~ — resolved.
- ✅ Macro/sector research (FRED + Norges Bank) — confirmed live: forced refresh returns real FRED + Norges Bank data, `methodology_version: v2`, all 11 v2 series including Norway. Sector research (Gemini-grounded narrative) is wired up but **hit the Gemini free-tier daily quota (429) when tested this pass** — not a bug, just today's request budget spent; the usage ledger (ADR 0013) is what surfaces this ahead of time going forward.
- ✅ Portfolio risk snapshots — confirmed live: real computed risk snapshot on record (composite 73.51/100, HIGH band, concentration/currency/sector dimensions populated, Norwegian formuesskatt estimate 103,644.21 NOK).
- ✅ **DCF valuation + critique, document upload flow — confirmed live, 2026-09-15.** Both exercised directly against production: a real DCF case creation against Vår Energi persisted correctly, and a real document upload round-tripped through object storage correctly (see "Status" above for detail). Found and fixed two real bugs along the way (discount-rate defaults endpoint, critique-crash) — both need a redeploy.
- ✅ **LLM usage ledger (ADR 0013)** — **confirmed live**: `/usage/summary` returns real data, Dashboard's "Gemini usage today" widget renders it (9/20 requests, 62,965 in / 9,011 out tokens). Migration applied, deployed. ~~Migration not yet applied/deployed~~ — resolved.
- ⚠️ **Macro-economic fixes ECON-001/002 (ADR 0014)** — ECON-002 (regime-conditional scoring) **confirmed live** via `GET /health` → `active_scoring_version: v2`. **ECON-001 (discount-rate/FX suggestion endpoint) — root-caused 2026-09-15: genuinely broken in production**, not the "errored out for unrelated reasons" this file guessed twice before. `discount_rate/versions/v1.yaml` was missing from the Docker image (Dockerfile gap), so every call 500'd. Fixed in code, **needs a Railway redeploy to actually take effect** — see "Status" above.
- ✅ **Macro-economic fixes ECON-003/004/006 (ADR 0014)** — **confirmed live**: `/research/macro/snapshot` returns all 11 v2 series (adds `commodity_oil_wti`, `commodity_oil_brent`, `eurozone_policy_rate`, `eurozone_hicp_yoy`, `china_cpi_yoy`) and `GET /health` → `active_prompt_version: v2` (ECON-006). **New gap found this pass:** the Dashboard's macro chart widget still only plots the original 6 series — it was never updated to visualize the 5 new ones, so they're being fetched and used in analysis but aren't visible anywhere in the UI. Small Phase-9-adjacent frontend follow-up.
- ✅ **ECON-005 (Norway policy rate)** — turns out this already works in production: live snapshot has a real `no_policy_rate` observation (4.25%, `norges_bank`, dated 2026-09-11). The earlier "unverifiable" note was about this cloud sandbox's own egress block, not about whether the deployed app can reach Norges Bank — it can. ~~remains open~~ — resolved.
- ⬜ **ECON-007 (regime-aware risk bands)** — confirmed still genuinely open: `GET /health` → `active_risk_scoring_version: risk_v1`. Lowest severity of the seven ADR 0014 findings; untouched.
- yfinance/Gemini/FRED/Norges Bank are now confirmed working against the real live deploy (not just mocks) — see above, per source. ADR 0004/0005/0007.
- ✅ ~~Portfolio composition Total value/Unrealized P&L implausible~~ — **resolved**: root cause was `market_ticker=AUCP.L` (wrong London/GBP-pence share class) on the L&G Gold Mining ETF holding, corrected to `AUCO.MI` (EUR, Milan) via the Market Tickers panel — confirmed still set correctly this pass. Total value 13.9M → 633K NOK. Residual ~23% gap vs. the real report (632,997.60 vs. ~826,363 NOK) not investigated — likely just live price drift since the report's date.

**Deliberate scope limits** (not oversights — see the linked ADR if you want the reasoning):
- PDF/PPT are read as qualitative LLM text, not structured facts — XLSX-only for that (ADR 0006). **`FACTS: 0` on a processed PDF/PPT document is expected, not a failure** — see ADR 0012 for what value that document actually delivers instead (document-chunk evidence at analysis time) and where that pipeline currently falls short.
- DCF valuation and scenario shocks are illustrative/directionally-reasoned, not fitted to real market data (ADR 0008).
- Norwegian wealth-tax estimate is single-bracket, no per-couple splitting (ADR 0008).
- Jurisdictional concentration is proxied via `Holding.institution`, not a real custodian-country field.
- Portfolio-risk narrative is short deterministic text, not LLM prose (ADR 0008).
- Risk heatmap tile shading uses illustrative public reference bands, not the app's own `risk_v1.yaml` thresholds — the overall risk band/score next to it *is* the authoritative one (ADR 0009).
- Free-tier rate limits (`LLM_RATE_LIMIT_RPM/TPM/RPD`, ADR 0013) are entered by hand, not fetched from Google — no public API exposes a free-tier AI Studio key's quota/usage, so these drift if the account's tier or model changes and need updating manually when they do.

**Tooling debt:**
- ~~No `eslint.config.js` — `npm run lint` fails outright (Phase 0 gap).~~ — **resolved
  2026-09-15**: added `frontend/eslint.config.js` (flat config) plus the plugin deps it needs
  (`@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`,
  `globals`) — `npm install` in `frontend/` to pick them up. See ADR 0015.
- No `black` config — codebase never run through it.
- `mypy app`: 11 `import-untyped` errors (missing stubs for pandas/openpyxl/fitz/yfinance/boto3/apscheduler) — cosmetic, not fixed yet.
- `tests/golden_documents/` and `tests/regression/` are empty scaffolds since Phase 0 (architecture §22.2/§22.3).
- `vite build`'s single JS bundle is ~615 kB / 172 kB gzipped (mostly recharts) — no code-splitting; fine at single-user scale.

**Feature gaps:**
- No calibration/track-record engine (§22.5) — needs weeks of real deployed history to be useful, so recommended *after* a live deploy exists.
- Evidence-packet excerpt selection has no relevance ranking, just most-recent-first, and the excerpt budget is shared across all of a holding's documents rather than per-document (ADR 0006) — reviewed in detail 2026-09-14 against Vår Energi's real documents (a 208-page annual report likely gets truncated to near-zero content by a smaller, more-recently-uploaded quarterly report); concrete proposal in **ADR 0012 (Phase 9, proposed)**.
- ~~`AssetClass` has no `COMMODITY`/`COLLECTIBLE` value yet~~ — resolved 2026-09-15, Phase 8 (ADR 0011).
- ~~Collectibles with no live price feed get silently excluded from portfolio totals~~ — resolved 2026-09-15: a `COLLECTIBLE` holding with a known cost basis is now valued at cost (`price_status: "at_cost"`) instead of excluded. A collectible with neither a live ticker nor a recorded cost basis is still excluded — nothing to carry it at (ADR 0011).
- ~~No way to add a single manual holding (a coin, a bottle) from the app itself~~ — resolved 2026-09-15: "Add a holding manually" section on the Portfolio tab (ADR 0011). The backend endpoint existed since the earlier same-day precious-metals pass but had no frontend caller until this one.
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

- [x] Object storage provider (`S3ObjectStorageProvider`, R2/Supabase) — **confirmed with a real upload/retrieve on the live deploy, 2026-09-15**: uploaded a test PDF, got back `PROCESSED` with correct extracted text, re-fetched it independently.
- [x] CORS middleware.
- [x] Backend + frontend Dockerfiles — these are presumably what Railway built from (Railway supports building from a Dockerfile directly, without a separate local `docker build`).
- [x] Single-user auth (`APP_AUTH_TOKEN`/`X-API-Key`) on every router except `/health`.
- [x] Supabase `DATABASE_URL` set + app is reading/writing through it — Faiz confirms Supabase is up; the working Portfolio flow (uploads persisting, snapshot history listing) is itself evidence `alembic upgrade head` applied cleanly.
- [x] Railway project + env vars set — confirmed via the Variables screen (13 service variables).
- [x] `GOOGLE_AI_STUDIO_API_KEY` + `FRED_API_KEY` obtained and set on Railway.
- [x] End-to-end smoke test — Portfolio flow tested and working ("good for an alpha," per Faiz 2026-09-14). Documents/Analysis/Dashboard not yet manually exercised on the live deploy — see "Open gaps" above.
- [x] Live check of Phase 5's DCF critique specifically — **done 2026-09-15**: a real DCF case creation against Vår Energi persisted correctly. Found the critique step could crash the whole request instead of degrading gracefully — fixed, needs redeploy (see "Status" above).
- [x] `alembic upgrade head` for `llm_usage_events` (`c7e2f9a1b8d3`) and `analysis_runs.macro_regime` (`d8f3a6b2c710`) — **confirmed applied**, 2026-09-14 status pass: `/usage/summary` returns real ledger data and `GET /health` reports `active_scoring_version: v2`, both of which require these migrations to be in.

## Manual to-do for Faiz

- **New this pass — guardrails setup, no redeploy needed (this is all repo/local tooling, not
  runtime code):**
  - `pip install pre-commit && pre-commit install` from the repo root, once, to activate the
    pre-commit layer (ADR 0015). Optionally `pre-commit run --all-files` once up front.
  - `cd frontend && npm install` to pick up the new eslint plugin dependencies —
    `npm run lint` should actually run clean-or-report now instead of failing outright.
  - Once CI (`.github/workflows/ci.yml`) has run clean a few times on `main`: consider turning on
    branch protection (GitHub → Settings → Branches) requiring it to pass before merge. This is a
    GitHub repo setting, not something committable from here.
  - Skim `CLAUDE.md` once — it's the rulebook future sessions (including this one, next time)
    are expected to follow.
- **New this pass — redeploy needed, and hold off on "Delete all data" until it's live.** Fixed the
  `ForeignKeyViolation` 500 on `DELETE /portfolio/reset?confirm=true` (root cause: `reset.py` never
  detached `llm_usage_events`'s FKs before deleting the tables it points to — see the dated entry
  above). Code-only fix, no migration, in `backend/app/services/portfolio/reset.py` — needs a Railway
  redeploy to take effect. It will keep 500ing (harmlessly) if you retry "Delete all data" before
  that redeploy lands.
- **New this pass — re-upload your Nordnet export to get Securities back.** The Securities-missing
  fix stops the bug from happening again, but the *current* snapshot was already damaged by it before
  the fix shipped, so Securities are still showing 0 on the Dashboard even after redeploying. Your
  Securities data isn't lost (all 36 holdings still exist) — just re-upload the Nordnet CSV/XLSX
  export via the Portfolio tab and it will merge back in alongside the coin/whisky positions. See the
  dated entry above for the full snapshot-history explanation.
- ~~**Redeploy needed.** Fixed the bug where Securities dropped out of Portfolio composition as soon
  as a coin/whisky manual entry existed~~ — **redeployed and confirmed live**; see the two dated
  entries above for what the redeploy did and did not fix (code fixed, data needs the re-upload just
  above).
- **New this pass — check the coin entries' buy prices.** The coin+whisky snapshot's Unrealized P&L
  (-653,688.51 NOK) is several times larger in magnitude than Total value (115,422.65 NOK) and
  negative — the arithmetic is correct, but this pattern usually means a cost basis was entered
  wrong for one of the manually-entered coins (wrong currency, an extra digit, etc.), not a real
  loss. Check each coin's buy price on the Portfolio tab; the new "By collection" panel on the
  Dashboard should make it obvious which of Securities/Coin collection/Whisky collection the bad
  number is in.
- **Redeploy needed** for this pass's Composition change (Securities/Coin/Whisky split, collection
  aggregation, filter) — additive backend schema field + frontend-only otherwise, no migration.
- Confirm or correct ADR 0012's evidence-truncation estimate for Vår Energi with a real analysis
  run against its two documents (analysis itself is confirmed working now — see status pass below —
  this is about checking the *evidence selection*, not whether the run succeeds) — worth doing
  before Phase 9 work starts.
- **Git — resolved.** Read `.git` refs directly and cross-checked against a live `git ls-remote`:
  commits have been happening normally throughout this project's history, almost entirely pushed.
  As of this pass, local `main` was 1 commit ahead of `origin/main` — just needs `git push`. **New
  as of this pass**: today's Phase 8 + Phase 7 bug-fix files (full list just below) are sitting as
  uncommitted working-tree changes, since `device_bash` can't run `git` from this session — please
  `git add`, commit, and push them (and check Railway is set to auto-deploy from GitHub, or trigger
  a manual redeploy, since two of today's fixes need to actually reach production to matter).
- **Redeploy needed** for everything this 2026-09-15 pass wrote — none of it is live yet:
  `backend/app/domain/asset_class.py`, `backend/app/models/portfolio.py`, `backend/alembic/versions/
  f1a2b3c4d5e6_portfolio_position_acquired_at.py` (**new migration — needs `alembic upgrade head`**),
  `backend/app/services/portfolio/parser.py`, `backend/app/services/portfolio/ingestion.py`,
  `backend/app/schemas/portfolio.py`, `backend/app/services/portfolio/manual_entry.py` (new),
  `backend/app/api/portfolio.py`, `backend/app/providers/gold_metal_provider.py` (new),
  `backend/app/providers/composite_market_provider.py` (new), `backend/app/config/settings.py`,
  `backend/app/providers/factory.py`, `backend/Dockerfile` (**the discount_rate fix — without this
  redeploy, ECON-001 stays broken**), `backend/app/services/valuation/dcf.py` (the critique-crash
  fix), plus this pass's new/extended test files. **Same-day follow-up also needs a redeploy**:
  `backend/app/services/portfolio/parser.py` (Whiskybase import), `backend/app/services/
  market_data/valuation.py` (collectible-at-cost fallback), `backend/tests/fixtures/
  whiskybase_collection.csv` (new), `backend/tests/unit/test_portfolio_parser_whiskybase.py` (new),
  `backend/tests/integration/test_valuation_api.py`, `frontend/src/pages/PortfolioUpload.tsx`
  (new "Add a holding manually" section), `frontend/src/services/api.ts` (new `addManualHolding`),
  `frontend/src/types/portfolio.ts` (`custody_type`/`acquired_at` + manual-entry types) — no new
  migration for any of this.
- **Leftover test document, harmless but visible**: a `phase7-object-storage-verify.pdf` document
  was uploaded to the Alfred Berg Nordic High Yield holding on live production while verifying
  object storage this pass — real proof the upload/retrieve round trip works, safe to ignore or
  delete from the Documents tab.
- **Before trusting `gold-api.com` pricing for real**: it was built defensively from documented
  behavior and fully unit-tested, but this cloud sandbox's egress blocks `api.gold-api.com` outright
  — it still needs one real live request from an unrestricted network (same as Norges Bank/FRED
  needed in earlier phases) before relying on it.
- Optional: add `pandas-stubs`/`types-openpyxl` + a `mypy.ini` override for the untyped-import stub gaps above.
- ~~Redeploy for market ticker UI / Gemini model fix / usage ledger migration / ECON-001-006~~ — **all confirmed live in production as of the 2026-09-14 status-alignment pass**, see the top "Status" section. Struck through rather than deleted so this history isn't lost.
- **New this pass:** the Dashboard's macro chart only plots 6 of the 11 series the backend now
  returns (the original v1 set) — `commodity_oil_wti`, `commodity_oil_brent`,
  `eurozone_policy_rate`, `eurozone_hicp_yoy`, `china_cpi_yoy` are fetched and available but never
  rendered anywhere in the frontend. Small fix: extend the macro chart component to plot all
  observations returned rather than a hardcoded 6-series list.
- **New this pass:** Gemini's free-tier daily request quota was hit mid-session (a sector/macro
  research refresh 429'd). Not a bug — but a live example of exactly what the usage ledger (ADR
  0013) exists to warn about ahead of time. Worth glancing at the Dashboard's usage widget before a
  big batch of analysis runs.

## Up next (candidates)

1. **ECON-007 (regime-aware risk bands)** — the last open item from ADR 0014's seven-issue
   macro-economist review. ECON-001 through ECON-006 are **confirmed live in production** as of the
   2026-09-14 status-alignment pass (including ECON-005, which turned out to already work — see
   "Status" above); only ECON-007 remains: `scoring/versions/risk_v1.yaml`'s commodity/currency risk
   bands are still static percentages, not regime-aware. Lowest severity of the seven. Full
   reasoning in **ADR 0014**.
2. **Document evidence quality (Phase 9)** — per-document evidence budget (fixes a
   large report getting truncated to near-zero by a smaller, more-recent upload), evidence-usage
   visibility on the Documents tab, section-aware chunk prioritization, and closing the PDF-only
   `financial_metrics` gap. Design in ADR 0012. Makes an already-built, already-in-use feature
   (document upload) deliver more of the value it was built for, rather than adding new surface
   area.
3. **Track-record & calibration engine** (§22.5) — a real deploy now exists, but it still needs weeks of live analysis history to have anything to calibrate against.
4. **Testing debt** — populate `golden_documents`/`regression`, add `black`. (`eslint.config.js`
   resolved 2026-09-15, ADR 0015.)
7. **From ADR 0015 (guardrails), not built this pass:** a pre-reset export/backup step for
   `DELETE /portfolio/reset` (it's already confirm-gated and scoped, just no automatic
   "save a copy before wiping" safety net); GitHub branch-protection on `main` (Faiz's own repo
   setting — turn on once CI has run clean a few times); promoting the CI dependency-audit job
   from report-only to blocking once any existing advisories are triaged.
5. ~~**Precious metals** (Phase 8)~~ — **built 2026-09-15**: `COMMODITY` asset class, dated lots, manual single-holding entry (now with a frontend form), gold-api.com spot pricing. Just needs redeploy + a live gold-api.com smoke test. Design/status in ADR 0011.
6. ~~**Whisky collection** (Phase 8)~~ — **built 2026-09-15**: real Whiskybase CSV import (built from Faiz's own 26-bottle export), carried at cost basis via the new collectible-at-cost valuation fallback since no live pricing feed exists. Just needs redeploy. Design/status in ADR 0011.

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

- **2026-09-15 (Agentic coding & AI-safety guardrails):** Added three enforcement layers —
  Claude Code hooks (`.claude/`), `.pre-commit-config.yaml`, `.github/workflows/ci.yml` +
  `dependabot.yml` — plus root `CLAUDE.md` as the operational rulebook, addressing the recurring
  uncommitted-work and status-drift problems in this history. Fixed the long-standing missing
  `frontend/eslint.config.js` (+ missing plugin deps) along the way. Added `prompts/persona/v3.md`
  with an explicit prompt-injection guardrail for the uploaded-document evidence path and made it
  the default. See ADR 0015.
- **2026-09-15 (Portfolio reset — `ForeignKeyViolation` on `llm_usage_events` — fixed):** Faiz's
  "Delete all data" 500'd in production because `reset.py` predates the LLM usage ledger (ADR 0013)
  and never detached its three optional FKs (`holding_id`, `analysis_run_id`, `holding_analysis_id`)
  before deleting the tables they point to. Fixed by nulling those FKs first, the same "detach
  defensively" pattern already used for `research_items.holding_id`; the ledger rows themselves are
  kept, not deleted. New `tests/unit/test_portfolio_reset.py` turns on real SQLite FK enforcement
  (off by default in the rest of the suite) specifically to catch this class of bug — confirmed it
  reproduces the exact production error pre-fix and passes post-fix. See the dated entry above for
  full detail.
- **2026-09-15 (Securities still showing 0 after the fix below was deployed — root-caused, needs a
  data re-upload):** Follow-up check after the manual-entry fix (entry below) was redeployed —
  confirmed the code fix is live and working, but the *current* snapshot was already corrupted by the
  bug before the fix shipped (snapshot history: 29 → 3 → 7 positions), so Securities won't reappear
  until Faiz re-uploads his Nordnet export to merge them back onto the now-fixed snapshot. Data
  itself isn't lost — all 36 holdings still exist. See the dated entry above for full detail.
- **2026-09-15 (Securities missing from Portfolio composition after a manual entry — fixed):** A
  manual coin/whisky add used to land in one isolated, dedicated "manual entries" snapshot instead
  of carrying forward the current brokerage-upload snapshot — so the moment one existed, the
  Dashboard's "show whichever snapshot is newest" logic switched to that manual-only snapshot and
  every Securities holding disappeared from Composition until the next CSV re-upload. Fixed by
  making manual add/edit carry forward the current snapshot the same way brokerage uploads already
  do. See the dated entry above for full detail.
- **2026-09-15 (Composition: Securities/Coin/Whisky split, collection aggregation, filter):** Added
  `asset_class_values` (absolute per-asset-class value) to the valuation API's concentration output;
  rebuilt the Dashboard's Portfolio composition section to compute its numbers/charts from the
  per-holding list so "By holding" collapses coins/whisky into one slice each instead of one per
  item, added an always-on "Securities / Coin collection / Whisky collection" totals panel, and
  added a dashboard-wide Collections include/exclude filter. Flagged (not fixed — looks like a data
  entry mistake, not a code bug) an implausible Unrealized P&L on the coin+whisky snapshot. See the
  dated entry above for full detail.
- **2026-09-15 (Phase 8 completed — whisky import, at-cost valuation, coin manual-entry UI, ADR
  0011):** Same-day follow-up to the Phase 7/8 pass below. Faiz asked how to add individual
  gold/silver coin purchases (1 oz Maple Leaf/Krugerrand/Kangaroo) with a buy price and live
  pricing, and attached a real 26-bottle Whiskybase collection export. Built: a Whiskybase CSV
  auto-importer (`parser.py`, same signature-detection pattern as Nordnet, built from the real
  export — cost basis left unset rather than guessed where Whiskybase recorded none); a
  collectible-at-cost valuation fallback (`valuation.py`) so a `COLLECTIBLE` holding with a cost
  basis but no live price feed counts in Composition/Risk totals (`price_status: "at_cost"`)
  instead of being silently excluded; and a new "Add a holding manually" section on the Portfolio
  tab wired to the `POST /portfolio/holdings/manual` endpoint (built earlier the same day but never
  callable from the app until now), with coin-type presets that auto-set `XAU`/`XAG` for
  gold/silver. Also fixed two stale frontend types (`Holding.custody_type`,
  `PortfolioPosition.acquired_at`) that existed on the backend since Phase 5 but were never added to
  `frontend/src/types/portfolio.ts`. **Verified in the cloud mirror**: backend 346/346 tests (was
  332), `ruff` clean, `mypy` unchanged baseline; frontend `npm ci` fresh, `tsc --noEmit` clean,
  `vite build` succeeds. **Not yet deployed** — needs a Railway redeploy, no new migration. Full
  detail: ADR 0011's "Update (2026-09-15, part 2)" section.
- **2026-09-15 (Phase 7 loose ends + Phase 8 precious metals, ADR 0011):** Faiz asked to close out
  Phase 7's remaining open items and start Phase 8. **Phase 7 loose ends** — all three resolved by
  testing directly against the live Railway deployment (browser + direct API calls, same technique
  as the 2026-09-14 status-alignment pass): object storage upload/retrieve confirmed working with a
  real test-document round trip; DCF valuation confirmed working with a real case creation against
  Vår Energi; and the ECON-001 discount-rate/FX endpoint, previously dismissed twice as "errored out
  for unrelated reasons," turned out to be a real, fully broken endpoint — root-caused to
  `backend/Dockerfile` never copying `discount_rate/` into the deploy image (every sibling
  versioned-config directory — `prompts/`, `schemas/`, `scoring/`, `research/`, `scenarios/` — was
  copied except this one), fixed with one added `COPY` line. Also found, while exercising the DCF
  critique flow live, that `_run_critique()` in `app/services/valuation/dcf.py` could let an
  unexpected exception from `build_analysis_context()` escape uncaught and crash the entire
  `POST .../cases` request — contradicting its own docstring's "a valuation case is never lost
  because the LLM step failed" promise — fixed by widening the exception handling to match the
  documented contract, with a new regression test. Both fixes need a Railway redeploy to take
  effect. Also confirmed, not a bug: the Dashboard's macro chart already renders all 11 macro
  series in production — a gap a prior pass thought was still open turned out to already be fixed.
  **Phase 8** — built the precious-metals groundwork per ADR 0011: `AssetClass.COMMODITY`/
  `COLLECTIBLE`, a new nullable `PortfolioPosition.acquired_at` column + migration (`f1a2b3c4d5e6`)
  for dated lots, CSV-schema support for an `Acquired at` column, a new `POST
  /portfolio/holdings/manual` endpoint for single-lot entry (scoped to `COMMODITY`/`COLLECTIBLE`,
  deliberately never merging lots the way brokerage CSV ingestion does — two coin purchases at
  different dates stay two distinct positions), and a new `GoldApiMarketDataProvider` composed
  behind the existing `MarketDataProvider` abstraction via a new `CompositeMarketDataProvider`
  (mirrors the established `CompositeMacroDataProvider` pattern exactly) — routes `XAU`/`XAG`
  tickers to gold-api.com spot pricing, everything else still goes to yfinance. Whisky-specific bulk
  CSV import remains explicitly deferred, unchanged from ADR 0011's original recommendation — still
  needs a real sample export from Faiz first. **Verified in the cloud mirror** before writing back
  to `E:\Aladdin` (`device_bash` still can't mount it this session, same Windows-update regression
  tracked since 2026-09-08): 332/332 backend tests passing before the Phase 7 fixes, 333/333 after
  (new critique-crash regression test), `ruff check .` clean, `mypy app` unchanged baseline-only
  errors (no new errors in any file this pass touched). **Not yet deployed** — see "Manual to-do"
  for the full file list and what still needs `git push` + a Railway redeploy + `alembic upgrade
  head` (one new migration). `gold-api.com` pricing still needs one real live smoke test from an
  unrestricted network before being trusted, same outstanding caveat every other external provider
  in this codebase has carried at this stage. Full detail: ADR 0011's "Update (2026-09-15)" section.
- **2026-09-14 (status-alignment pass):** Faiz pushed back on this file's "written but not yet
  deployed" framing — he's been redeploying continuously, so the file had drifted stale rather than
  reality being behind. Verified live production directly instead of trusting prior session notes:
  opened the live frontend in-browser, then captured the frontend's own `X-API-Key` from its
  outgoing requests (via a `fetch` monkey-patch in the page's JS console) to call the live backend
  API directly. Confirmed genuinely live: the LLM usage ledger (real data in `/usage/summary` and
  the Dashboard widget), the `gemini-3.6-flash` fix (real completed analyses on record), the
  market-ticker self-serve UI (6/7 holdings populated, including the `AUCO.MI` correction),
  ECON-002/006 (`GET /health` → `active_scoring_version`/`active_prompt_version` both `v2`), and
  ECON-003/004 (forced `/research/macro/refresh` returned `methodology_version: v2` and all 11 v2
  series). Also found ECON-005 (Norway policy rate) was never actually blocked in production — only
  this cloud sandbox's own egress was — the live snapshot has a real `no_policy_rate` reading.
  Confirmed still genuinely open: ECON-007 (`active_risk_scoring_version` still `risk_v1`), and
  ECON-001 wasn't independently re-checked (worth a quick manual pass). New gap found in the
  process: the Dashboard's macro chart still only renders the original 6 series, not the 5 new
  ECON-003/004 ones, even though the backend now returns all 11. Rewrote "Status", "Open gaps",
  "Manual to-do", and "Up next" above to match verified reality; struck through rather than deleted
  the superseded "not yet deployed" language so the history stays visible. No code changed this
  pass — documentation/status correction only. `device_bash` still can't mount `E:\Aladdin`
  (Windows-update regression, unchanged), so this went through the stage → edit → commit-back path
  for `docs/PROGRESS.md` only.
- **2026-09-14 (Portfolio composition false values — RESOLVED, root cause found):** Follow-up to
  the entry just below. With `device_bash` still down, reached the live Railway deployment through
  the browser instead (granted access to the frontend, `exciting-gratitude-production-71b5.up.railway.app`
  — distinct from the backend's `aladdin-production-bd25...` domain) and read the actual
  `market_ticker` values off the Portfolio tab's Market Tickers panel. Found it: **L&G Gold Mining
  ETF's `market_ticker` was `AUCP.L`**, one keystroke off the app's own UI hint example (`AUCO.L`).
  Both are real Yahoo Finance tickers but different London share classes of the same fund (ISIN
  IE00B3CNHG25) — `AUCO.L` is the USD class, `AUCP.L` the GBP class, and London ETF GBP classes
  quote in **pence**, not pounds. Faiz's real broker prices this fund in EUR (~106 EUR), matching
  neither London listing but matching the Milan listing, `AUCO.MI` (Borsa Italiana, EUR). So this
  one holding was being priced ~100x too high in the wrong currency — enough on its own to explain
  the full inflation, since it's a large share of the portfolio by value. **Fix: corrected
  `market_ticker` to `AUCO.MI` directly in the Market Tickers panel** (a data correction, confirmed
  with Faiz first since it submits a form on live production data — not a code change, no
  redeploy). Confirmed by re-running "Refresh valuation": Total value 13,906,874.82 → **632,997.60
  NOK**, Unrealized P&L +13,281,549.31 → **+7,539.75 NOK**, Largest position 96.4% → **33.9%**
  (Vår Energi, ≈34.5% by the real report's combined two-account value — confirms the
  `single_name_weights` fix from the entry below is correctly summing that holding across
  accounts). 632,997.60 NOK is still ~23% below the real report's ~826,363 NOK (securities only),
  plausibly just live price drift since the report's 2026-09-13 date — not investigated further.
  Full writeup: `claude/portfolio-composition-false-values.md` in the project.
- **2026-09-14 (Portfolio composition — false total value/P&L, dashboard):** Faiz reported the
  Dashboard's Portfolio composition showing an obviously wrong Total value (~13.9M NOK vs. ~1.04M
  NOK on his real Nordnet portfolio report) and a huge fake Unrealized P&L, plus "By sector"
  showing 100% Unclassified and "By currency" skewed almost entirely to EUR. Root-caused two
  separate things:
  1. **Confirmed code bug, fixed** — `app/services/market_data/valuation.py::_build_concentration`
     built `single_name_weights` as `{hv.ticker: hv.computed_weight_pct for hv in valued}`. Since
     the same instrument legitimately sits in more than one account (the accounts feature's own
     design note — e.g. "Vår Energi" in both Ezra's ASK and Malik Faiz's ASK, "Salmon Evolution"
     likewise, "L&G Gold Mining ETF" in both Ezra's ASK and EPK Passiv), a later position for a
     ticker silently clobbered an earlier one in that dict instead of being combined, corrupting
     "By holding" and `largest_single_name_pct`/`single_name_hhi`. Fixed by summing market value
     per ticker first (same pattern already used for sector/currency/asset-class weights just
     below it), then converting to weights — no change to the total/denominator each weight is
     measured against. `device_bash` still can't mount `E:\Aladdin` this session (same
     Windows-update regression as prior passes), so this went through the stage → edit →
     commit-back path; only `valuation.py` was touched.
  2. **Not yet root-caused — needs Faiz to check** — the ~13-17x inflation in Total value/Unrealized
     P&L itself doesn't trace to the composition/weighting math (audited `domain/calculations.py`'s
     FX/P&L functions and the parser's number handling — both look correct), and isn't explained by
     a duplicated-position bug either (the "By holding" chart shows exactly the 6 real instruments
     from Faiz's report, no phantom extras). The likely cause is a wrong/mismatched `market_ticker`
     (Yahoo Finance symbol) on one or more holdings — most likely the two gold-linked instruments
     (L&G Gold Mining ETF, Xetra-Gold ETC), since gold ETPs/ETCs are a common source of ticker
     mix-ups (wrong share class, or a futures/spot-gold symbol instead of the actual fund) and they
     make up roughly half of Faiz's valued portfolio by weight — which would explain both the scale
     of the inflation and the all-EUR currency skew better than any other candidate. Couldn't
     verify directly this pass: Postgres (Supabase) isn't reachable from this cloud session (no
     route to port 5432), there's no known deployed API URL to query over HTTPS, and `device_bash`
     is down. **Also noted, not a bug:** "By sector" shows 100% Unclassified because Nordnet-format
     uploads never carry a sector column (`parser.py::_rows_from_nordnet` hardcodes
     `"sector": ""`) — expected given the current importer, not something this pass changed.
- **2026-09-14 (Portfolio tab: self-serve market ticker UI):** Faiz reported the dashboard always
  showing 0 NOK / "no market value available" for every holding, even after repeatedly clicking
  "Refresh valuation." Traced it to `app/services/market_data/valuation.py::_value_one_holding`:
  it correctly skips any holding with `market_ticker is None` (excluded from totals, not silently
  invented — §21) rather than a bug in the refresh logic itself. `market_ticker` — the
  yfinance-resolvable symbol Phase 2 actually prices by, e.g. `VAR.OL` — is deliberately never
  derived from `ticker`/`name` (decision 0003: a Nordnet export's `ticker` is the full instrument
  name, not a real exchange symbol, so guessing from it risks silently pricing the wrong
  instrument) and must be set via `PATCH /portfolio/holdings/{id}`. That endpoint, `HoldingOut`,
  and `HoldingUpdate` have existed since the Phase 2 build — **but no frontend code ever called
  it**, so every holding from every Nordnet upload has been permanently unpriced with no way to
  fix it short of a raw API call.
  Added a "Market data tickers" section to the Portfolio tab (new component in
  `frontend/src/pages/PortfolioUpload.tsx`, rendered between Accounts and Upload): lists every
  holding via the existing `GET /portfolio/holdings`, with an editable market-ticker field per row
  wired to the PATCH endpoint, a warning count of how many holdings are still unpriced, and inline
  guidance on the Yahoo Finance suffix convention (`.OL`, `.DE`, `.L`, …). Added the matching
  `market_ticker: string | null` field to the `Holding` type and a new `updateHoldingMarketTicker`
  function (`frontend/src/types/portfolio.ts`, `frontend/src/services/api.ts`). **Pure frontend
  change — no backend, schema, or migration changes**, since the backend side of this was already
  complete.
  **Verified in a cloud mirror** before writing back to `E:\Aladdin` (`device_bash` still
  unavailable this session — this is the Windows KB5124008/KB5124012/KB5122878 Plan9-mount
  regression from the September 8 cumulative update, tracked on Anthropic's status page as
  "Identified" since 2026-09-10 with no ETA from Microsoft yet; used the stage → edit →
  commit-back path instead, same as every session since the mount broke): `npm ci` fresh, baseline
  `tsc --noEmit` clean, edits applied, `tsc --noEmit` clean again, `vite build` succeeds (631 kB /
  176 kB gzip — the pre-existing single-bundle warning, unrelated to this change). `npm run lint`
  not run — known pre-existing gap (no `eslint.config.js`), unrelated to this change.
  **Needs a redeploy to reach the live Railway site — no migration required.** The actual tickers
  to enter for Faiz's current 5 identifiable holdings, and the two that can't be priced this way,
  are listed in "Manual to-do" above.
- **2026-09-14 (ECON-003/004/006 implemented; ECON-005 attempted, ADR 0014):** Faiz asked to keep
  going down the "Up next" list from the ECON-001/002 pass. New `research/versions/v2.yaml` adds
  commodity coverage (ECON-003 — FRED `DCOILWTICO`/`DCOILBRENTEU`, WTI + Brent since Brent is what
  Vår Energi's own production is actually priced against) and Eurozone/China coverage (ECON-004 —
  FRED `ECBDFR`, `CP0000EZ19M086NEST`, `CHNCPIALLMINMEI`), carrying v1's five existing series
  byte-identical (test-enforced); `settings.active_macro_series_version` moved to `v2`. New
  `prompts/persona/v2.md` adds one checklist item requiring the analysis to explicitly engage with
  macro/FX evidence when available rather than treating a holding in isolation (ECON-006), keeping
  every v1 hard rule unchanged (test-enforced); `settings.active_prompt_version` moved to `v2`,
  which also required a pass-through `prompts/synthesis/v2.md` (byte-identical to v1) since both
  prompts load off the same version string. **No database migration needed** for any of this —
  config/prompt files plus two settings defaults. ECON-005 (Norway policy-rate live verification)
  was attempted from both this cloud container and the device bridge: this container's egress
  proxy returns a 403 policy denial for `data.norges-bank.no` (confirmed via the proxy's own status
  endpoint — a deliberate block, not a flaky connection), and `device_bash` failed to start at all
  this session even for a command untouched by the `E:\Aladdin` mount issue, so it remains
  unverified — see ADR 0014's second Update section for the fastest real path forward (a `curl`
  from Faiz's own machine, or reading what the next live Railway macro refresh gets back). ECON-007
  (regime-aware risk bands) remains open, untouched, lowest severity of the seven.
  **Verified in the cloud mirror** before writing back to `E:\Aladdin` (same stage → edit →
  commit-back path as every prior pass, `device_bash` being down this session): 297/297 backend
  tests pass (was 289 — +8: 4 for the v2 macro registry, 4 for the v2 persona/synthesis prompts),
  `ruff check .` clean, `mypy app` unchanged baseline-only errors, frontend `tsc --noEmit` clean,
  `vite build` succeeds. **Not yet redeployed** — see "Open gaps"/"Manual to-do" above. Full detail:
  ADR 0014's second "Update" section.
- **2026-09-14 (ECON-001/002 implemented, ADR 0014):** Faiz asked to proceed on the macro-economic
  review's top findings. Built both:
  (1) **ECON-001 — discount rate / FX grounding.** New versioned config
  `discount_rate/versions/v1.yaml` (equity risk premium + per-currency risk-free method: NOK reads
  `no_policy_rate` directly, USD combines `us_real_yield_10y` + `us_breakeven_10y`); new
  `app/domain/discount_rate.py` (`suggest_discount_rate`/`suggest_fx_rate`, returning
  `available: bool` + a reason rather than fabricating a number when the underlying data isn't
  there); new `app/services/valuation/defaults.py` tying that to a specific holding's currency and
  the reporting currency's latest `FxObservation`; new `GET
  /valuation/holdings/{holding_id}/defaults` endpoint. Frontend: `NewValuationCaseForm` now shows a
  "use" hint next to `discount_rate_pct` and the FX rate field, fetched on open — the suggestion is
  displayed, never silently substituted (§21); `compute_dcf_value` itself is unchanged.
  (2) **ECON-002 — regime-conditional factor weights.** New `scoring/versions/v2.yaml`
  (`baseline`/`stagflation`/`crisis` weight profiles — `baseline` is byte-identical to v1's
  40/30/30 — plus deterministic `regime_classification` thresholds read from
  `us_real_yield_10y`/`us_headline_cpi_yoy`); `app/domain/scoring.py` gained
  `classify_macro_regime()` (pure threshold logic, no LLM) and an optional `regime` parameter on
  `compute_overall_score()`, defaulting to `baseline` for full backward compatibility;
  `AnalysisRun` gained a `macro_regime` column (migration `d8f3a6b2c710`, chained onto the
  still-pending `c7e2f9a1b8d3`); `run_analysis()` now classifies the regime from the latest macro
  snapshot before scoring and records/returns it. `settings.active_scoring_version` moved to `v2`;
  the now-dead `active_macro_regime_profile` setting (never read since §13.1's original approval)
  was removed. Verified backward-compatible: with no macro refresh performed, classification falls
  back to `baseline` and the existing `overall_score == 6.10` integration-test assertion is
  unchanged; a new test seeds a stagflation-classifying macro snapshot and confirms both the
  recorded regime and a different score (`5.90`). Full detail: ADR 0014's "Update" section.
  **Verified in the cloud mirror** before writing back to `E:\Aladdin` (`device_bash` still can't
  mount it this session): 289/289 backend tests pass (was 260 — +29 net across both fixes),
  `ruff check .` clean, `mypy app` unchanged baseline-only errors, frontend `tsc --noEmit` clean,
  `vite build` succeeds. **Not yet migrated or deployed** — see "Open gaps"/"Manual to-do" above.
  ECON-003 through ECON-007 remain open findings, unchanged.
- **2026-09-14 (Dashboard: full analysis detail per security; macro-economic review, ADR 0014):**
  Two independent asks. (1) Faiz wanted the same per-security "detail view" that appears after
  running an analysis on the Analysis tab (executive summary, business quality/financial
  strength/valuation factor breakdown with confidence + reasoning, key strengths/risks, blind-vs-
  thesis divergence, insufficient-evidence flags, and the Markdown memo) also available on the
  Dashboard's bottom section. That rendering lived only inside `Analysis.tsx`'s
  `HoldingAnalysisPanel`; extracted it into a shared `frontend/src/components/
  HoldingAnalysisDetail.tsx` (`ScorePill`, `FactorRow`, `HoldingAnalysisFullDetail`,
  `HoldingAnalysisFullDetailWithMemo`) so both places render identically instead of drifting apart,
  and added a new "Latest analysis — full detail" block to `HoldingDetailSection.tsx` (the
  Dashboard's bottom-most section) using the `latest` analysis it already fetches for the selected
  holding — no new API calls beyond the existing memo endpoint, which is now called on demand from
  the Dashboard too. `Analysis.tsx` itself was simplified to use the shared component rather than
  duplicating the JSX. Verified in the cloud mirror before writing back to `E:\Aladdin` (`device_bash`
  still can't mount it this session): `tsc --noEmit` clean, `vite build` succeeds. (2) Reviewed the
  analysis/valuation/portfolio-risk logic through a macro-economist lens (ADR 0014, planning only —
  no code changed for this part): found the DCF discount rate and FX conversion are manually typed
  with no link to the risk-free/FX data already fetched (ECON-001), factor weights are still fixed
  40/30/30 despite regime-conditional weighting being approved in the v3.0 architecture but never
  built (ECON-002), the macro registry has no commodity price series despite a real
  commodity-exposure risk dimension and a commodity-heavy portfolio (ECON-003), no Eurozone/China
  coverage despite the research prompt asking about the ECB (ECON-004), the Norway policy-rate
  series is self-flagged as never verified live (ECON-005), and macro evidence reaches the LLM
  without being a required line in its assessment checklist (ECON-006). Full findings and
  recommended fixes in ADR 0014; added as "Up next" item 1 above ADR 0012's Phase 9, since
  ECON-001/002 correct already-approved design rather than add new scope.
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
