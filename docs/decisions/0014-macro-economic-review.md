# 14. Macro-economic review of the analysis/valuation/risk logic

## Status

Accepted (review). ECON-001 and ECON-002 implemented 2026-09-14 (see "Update" section below).
ECON-003 through ECON-007 remain findings only, tracked in `docs/PROGRESS.md`'s "Up next" list.

## Context

Faiz asked for the application's logic and stored results to be reviewed "through the lens of a
macro economic expert" — i.e., not a code-correctness pass (Code Auditor's job) but a domain-logic
pass on whether the app's macro/valuation/risk methodology is sound, in the same spirit as the
economic-methodology reviews this session's `cwo-economics-analyst` persona performs for the
separate CWO country-scoring app, adapted here to Aladdin's actual domain: a two-pass Buffett/
Munger holding analysis, a deterministic DCF, a portfolio risk composite, and a central-bank/macro
data registry (Phase 4, ADR 0007).

Reviewed: `app/domain/macro_series.py` + `research/versions/v1.yaml` (the macro data registry),
`app/services/research/macro.py` (refresh/read path), `app/services/analysis/context.py` (evidence
packet assembly), `prompts/persona/v1.md` + `prompts/research/macro_v1.md` (what the LLM is
actually instructed to do with macro evidence), `app/domain/valuation.py` + `app/services/
valuation/dcf.py` (the deterministic DCF), `scoring/versions/v1.yaml` (holding factor weights) and
`scoring/versions/risk_v1.yaml` (portfolio risk weights), and `app/services/portfolio_risk/
builder.py` (currency/commodity exposure calculation). No code was changed — this is a findings
document, per Faiz's request.

## Findings

Severity legend: 🔴 conceptual error (produces a wrong or unfounded number/conclusion) · 🟠
methodology gap (defensible but incomplete or inconsistent with the app's own stated design) · 🟡
data-quality flag · 🔵 enhancement.

---

### 🔴 ECON-001 — DCF discount rate is disconnected from the macro data the app already collects

**Where:** `NewValuationCaseForm` (frontend) → `ValuationCaseCreate.discount_rate_pct` →
`compute_dcf_value` (`app/domain/valuation.py`).

**What it does:** `discount_rate_pct` is a free-text number the user types per valuation case
(placeholder "e.g. 9"), with no default and no relationship to anything else in the system.

**Economic problem:** The application already fetches `us_real_yield_10y`, `us_breakeven_10y`, and
`no_policy_rate` (Phase 4) specifically so a discount rate can be grounded in the current risk-free
rate rather than picked from memory. A DCF discount rate is conventionally built up as *risk-free
rate + equity risk premium (+ a company/country-specific premium)*; typing "9" without reference to
where the risk-free leg actually sits today means the same case type ("base") can silently embed a
very different real discount rate depending only on when the user happened to type the form,
without that drift ever being visible. For a NOK-reporting portfolio this matters twice over: Norway
and the US do not share a policy-rate cycle, and the registry already carries both `no_policy_rate`
and the US real yield/breakeven pair needed to derive a US real rate — neither is surfaced as a
default or even a citation as the form is being filled in.

**Recommended fix:** Pre-fill `discount_rate_pct` from the latest macro snapshot (risk-free leg for
the holding's currency + a configurable equity risk premium constant, both versioned like
`scoring/versions/*.yaml`) and let the user override it — never silently substitute a value the
user didn't see. At minimum, show the macro snapshot's current risk-free reading next to the field
so the "9" is a deliberate choice against a visible anchor, not a guess in a vacuum.

**Same gap, smaller:** `fx_rate_to_reporting` is also free-typed even though Phase 2 already
persists `fx_observations` for exactly this conversion — it should default from the latest
observation the same way.

---

### 🟠 ECON-002 — Factor weights are fixed, contradicting the app's own architecture decision

**Where:** `scoring/versions/v1.yaml` (`business_quality: 0.40, financial_strength: 0.30,
valuation: 0.30`, applied unconditionally by `app/domain/scoring.py`).

**What it does:** Every holding, in every macro environment, is scored with the same three
weights.

**Economic problem:** `docs/architecture.md` §13.1 already specifies this should not be true:
*"Regime-conditional weighting. Fixed weights implicitly assume macro/geopolitical factors matter
the same amount in every environment... define a small set of named weight profiles (e.g.
`baseline`, `stagflation`, `crisis`)... with a `macro_regime` field on the analysis run."* That
design was approved in the v3.0 architecture revision (per project memory) but `scoring/versions/
v1.yaml` still only defines one profile and `AnalysisRun` carries no `macro_regime` field. This is
not a hypothetical concern for this portfolio: `valuation` should mechanically carry more relative
weight than `business_quality` in a high-real-yield regime (higher discount rates compress
long-duration cash-flow value more than they change business quality), and the registry's own
`us_real_yield_10y` series is the input that regime classification would read. Today that signal is
fetched and stored but never used to change anything downstream of it.

**Recommended fix:** This is already correctly scoped as future work in the architecture doc — the
finding here is that it should move from "approved design" to "Up next" in `docs/PROGRESS.md`
(done, below), not that a new design is needed.

---

### 🟠 ECON-003 — No commodity price series, despite a commodity-heavy portfolio and a commodity-exposure risk dimension

**Where:** `research/versions/v1.yaml` (registry has 5 US series + 1 Norway policy rate — no
commodity series at all) vs. `app/services/portfolio_risk/builder.py`'s
`_commodity_exposure_pct`, which flags exposure via sector-name keyword matching (`"gold",
"silver", "oil", "gas", "mining", "metals", ...`).

**What it does:** The portfolio risk composite has a real 10%-weighted `commodity_exposure`
dimension (`scoring/versions/risk_v1.yaml`) computed from *sector labels*, but the macro registry
that's supposed to ground the analysis in current conditions carries no oil, gold/silver spot, or
broad commodity index series — only US rates/inflation/dollar and one Norway policy rate.

**Economic problem:** This portfolio's actual composition (per project memory: Vår Energi —
oil & gas, Salmon Evolution, an L&G Gold Mining ETF, and physical gold/silver holdings under Phase
8) means `commodity_exposure_pct` is very likely non-trivial for Faiz specifically, yet nothing in
the analysis or research layer tells him whether that exposure is being taken *into* a favorable or
unfavorable commodity cycle. The registry already tracks `us_dollar_index_broad`, which is the
single most relevant cross-asset signal for gold (inverse relationship) and, more weakly, broad
commodities — it's fetched but never connected to the commodity-exposure risk dimension or surfaced
as context for the gold ETF/physical metals holdings specifically. Oil (WTI/Brent) has no
representation at all despite being the dominant driver of Vår Energi's own economics.

**Recommended fix:** Add at minimum a WTI or Brent series (FRED carries `DCOILWTICO`) and reuse the
existing gold/silver spot feed from the Phase 8 `MetalPriceProvider` (ADR 0011) as a research-layer
observation, not just a portfolio-valuation input — then let `_commodity_exposure_pct`'s severity
scoring reference recent commodity-price momentum/volatility rather than a static sector-label
percentage alone.

---

### 🟠 ECON-004 — Macro registry covers only the US and Norway; the research prompt asks about a third bloc it has no numeric data for

**Where:** `research/versions/v1.yaml` vs. `prompts/research/macro_v1.md`.

**What it does:** The qualitative research prompt explicitly instructs the LLM to research "major
central bank policy stances... (Fed, ECB, Norges Bank)," but the numeric registry that's supposed
to ground/cross-check that narrative has no Eurozone series at all — only US (Fed) and Norway
(Norges Bank).

**Economic problem:** Norway's economy is tightly coupled to the Eurozone (its largest trading
partner bloc) via NOK/EUR and via imported inflation; a narrative pass that name-checks the ECB with
no numeric anchor behind it is exactly the "qualitative claim without a defensible number behind
it" failure mode this kind of review exists to catch. Separately, China has no representation
anywhere in the registry despite being the dominant marginal buyer for oil and a first-order
driver of the gold/broad-commodity cycle both relevant to this portfolio (ECON-003) — a gap the
research prompt doesn't even ask about.

**Recommended fix:** Add an ECB policy-rate series (available via FRED as `ECBDFR`, the deposit
facility rate) at minimum, and consider a China policy/growth proxy if commodity-linked holdings
grow (Phase 8's gold/silver additions make this more relevant, not less).

---

### 🟡 ECON-005 — The one NOK-specific macro input is explicitly self-flagged as unverified

**Where:** `research/versions/v1.yaml`, `no_policy_rate` entry: *"this build environment has no
verified live access to the Norges Bank API... a best-effort reading... not a value confirmed
against a real response."*

**Data-quality problem:** For a NOK-reporting portfolio, Norway's own policy rate is arguably the
single most load-bearing macro input in the whole registry (it's the natural risk-free anchor for
NOK-denominated DCF discount rates, per ECON-001), and it's the one series the codebase itself
documents as never having been confirmed to actually resolve. `MacroDataUnavailableError` handling
means a bad key likely just produces a silent gap (an absent observation) rather than a loud
failure — worth confirming which, since a silently-empty NOK rate is a worse failure mode than a
visibly-failed one.

**Recommended fix:** A one-time manual verification against
`https://data.norges-bank.no/api/data/IR/` (as the YAML comment itself already prescribes) closes
this. Flagging it here because it's the kind of gap that's easy to lose track of once other Phase
4/9/10 work moves on.

---

### 🔵 ECON-006 — Macro evidence reaches the LLM as raw citations, not as a required assessment dimension

**Where:** `app/services/analysis/context.py`'s `_add_research_evidence` adds macro observations
and news items into the evidence packet exactly like document excerpts; `prompts/persona/v1.md`'s
"What to assess" checklist (circle of competence, moat, switching costs, management, financial
strength, earnings quality, intrinsic value, temperament) has no line asking the model to reason
about a holding's macro/rate/currency/commodity sensitivity specifically.

**Economic problem:** Nothing is wrong with what's provided — the macro/FX evidence is genuinely in
the packet the LLM sees. But because the persona's explicit checklist never asks for it, whether a
given analysis actually engages with macro sensitivity depends on whether the model happens to pick
it up from the evidence unprompted, which is inherently inconsistent run to run and holding to
holding. For rate-sensitive or commodity-linked names specifically (which, per ECON-003, several of
this portfolio's holdings are) that's exactly the dimension most likely to be skipped silently.

**Recommended fix:** Add one explicit line to the persona prompt's assessment checklist — something
like "macro/rate/currency/commodity sensitivity: how exposed is this business's economics to the
interest-rate, FX, and (where relevant) commodity-price evidence provided?" — so it's a required
factor of the qualitative read rather than an optional one. This is a prompt-only change (no schema
change needed, since it can be folded into the existing `financial_strength` or a new dedicated
field).

---

### ℹ️ ECON-007 — Commodity/currency exposure risk bands are static percentages, not regime-aware

**Where:** `scoring/versions/risk_v1.yaml`'s `dimension_thresholds` for `commodity_exposure` (10% /
25% / 40%) and `currency_exposure` (20% / 50% / 75%).

**Note, not a defect:** Fixed percentage bands are a reasonable first cut and are explicitly
versioned so they can be revised without losing reproducibility (§2.4) — flagging only because a
40%-oil/gold/metals portfolio in a low-volatility commodity regime is a genuinely different risk
than the same 40% in a high-volatility one, and the current bands can't distinguish the two. Lower
priority than ECON-001–004; worth a line in "Up next" rather than immediate action.

## Framework strengths (what's already sound)

- **Evidence-first, not LLM-as-system-of-record**: every material number in the analysis and
  valuation paths is deterministic application code; the LLM interprets and critiques but never
  computes a figure it then asserts as fact (`compute_dcf_value`, `app/domain/calculations.py`).
  This is the single most important methodological property a macro/fundamental review can ask for
  and it's already enforced structurally, not just by convention.
- **Blind-then-reconcile confirmation-bias guardrail** (`prompts/persona/v1.md` rule 6, ADR 0006):
  independent assessment before the model sees the investor's own thesis is good practice and
  mirrors how a real research desk would separate an analyst's independent view from account
  positioning.
- **Explicit uncertainty over false precision**: `compute_dcf_value` returns `None` with a `note`
  rather than a fabricated number whenever inputs don't support one; the persona prompt requires
  `insufficient_evidence_areas` instead of a confident guess. Both are correct discipline for
  single-analyst tools, which are otherwise prone to precision theater.
- **Versioned, reproducible config** (`scoring/versions/*.yaml`, `research/versions/*.yaml`): past
  analyses stay interpretable against the weights/series that actually produced them, which is what
  makes it possible to later add regime-conditional weighting (ECON-002) without breaking history.

## Consequences

Findings ECON-001 through ECON-007 have been added to `docs/PROGRESS.md`'s "Up next" list, ranked
by the order above (discount-rate grounding and regime-conditional weights first, since both were
already-approved architecture gaps rather than new scope). No code changed in this pass — Faiz
asked for the review itself, not implementation.

## Update — 2026-09-14 (ECON-001/002 implemented)

Faiz asked to proceed with the two highest-priority findings. Both are built, tested, and verified
in the cloud mirror (`device_bash` still can't mount `E:\Aladdin` this session — written back via
the stage → edit → commit-back path); neither has been migrated/deployed to Railway yet.

**ECON-001 (discount rate / FX grounding):**
- New versioned config `discount_rate/versions/v1.yaml` (mirrors the `scoring/`/`research/`
  pattern): an equity risk premium constant plus a per-currency risk-free method — NOK reads
  `no_policy_rate` directly (`single_series`); USD combines `us_real_yield_10y` +
  `us_breakeven_10y` (`real_plus_breakeven`) to approximate a nominal 10y rate.
- New `app/domain/discount_rate.py`: `load_discount_rate_config()`, `suggest_discount_rate()`
  (risk-free + ERP from the latest macro observations), `suggest_fx_rate()` (latest
  `FxObservation` for the holding's currency → reporting currency). Both return an
  `available: bool` + `reason` when the underlying series/observation isn't there yet, rather
  than fabricating a number.
- New `app/services/valuation/defaults.py`: `get_valuation_defaults(db, holding)` ties the above
  to a specific holding (its `trading_currency` and the configured `default_reporting_currency`).
- New endpoint `GET /valuation/holdings/{holding_id}/defaults` → `ValuationDefaultsOut`.
- Frontend: `NewValuationCaseForm` now fetches these defaults on open and shows a hint next to
  `discount_rate_pct` and the FX rate field with a "use" button — per §21, the suggestion is
  displayed, never silently substituted; the user still types (or accepts) the final value.
- `compute_dcf_value` itself is untouched — this only changes what pre-fills the form.

**ECON-002 (regime-conditional factor weights):**
- New `scoring/versions/v2.yaml`: three weight profiles (`baseline` — identical to v1's
  40/30/30, `stagflation`, `crisis`) plus deterministic `regime_classification` thresholds read
  from the macro registry (`us_real_yield_10y`, `us_headline_cpi_yoy`), crisis checked before
  stagflation. `settings.active_scoring_version` moved from `v1` to `v2`.
- `app/domain/scoring.py`: `classify_macro_regime()` (pure threshold logic, no LLM involved —
  consistent with the app's evidence-first discipline) and `compute_overall_score()` gained an
  optional `regime` parameter, defaulting to `"baseline"` for full backward compatibility.
- `AnalysisRun` gained a `macro_regime` column (migration `d8f3a6b2c710`, chained onto
  `c7e2f9a1b8d3`, the still-unapplied usage-ledger migration — **both need `alembic upgrade
  head` on the real Postgres**). `run_analysis()` now classifies the regime from the latest
  macro snapshot before scoring and records it on the run; it's surfaced in
  `AnalysisRunSummary.macro_regime` via the API.
- Verified byte-for-byte backward compatible: with no macro refresh yet performed (the common
  case until Faiz runs one on the live deploy), classification falls back to `baseline`, whose
  weights are identical to v1's — the existing `overall_score == 6.10` integration-test
  assertion is unchanged. A new test seeds a stagflation-classifying macro snapshot and confirms
  both the recorded regime and a different resulting score (`5.90`).
- The now-unused `active_macro_regime_profile` setting (present but never read since the
  architecture doc's original §13.1 approval) was removed; the `/health` endpoint reports
  `active_discount_rate_version` instead.

**Verification:** 289 backend tests passing (was 260 — 16 new for ECON-001, 10 new + 1 modified
for ECON-002; net +29 accounting for the 1 modified), `ruff check .` clean, `mypy app` unchanged
baseline-only errors, frontend `tsc --noEmit` clean, `vite build` succeeds.

**Not done as part of this pass:** ECON-003 (commodity series), ECON-004 (Eurozone/China series),
ECON-005 (Norway policy-rate live verification), ECON-006 (macro sensitivity in the persona
checklist), ECON-007 (regime-aware risk bands) — all remain open findings, unchanged from the
original review above.

## Update — 2026-09-14 (ECON-003/004/006 implemented; ECON-005 attempted, still open)

Faiz asked to keep going down the "Up next" list. Built, tested, and verified in the cloud mirror
(`device_bash` still can't mount `E:\Aladdin` this session — confirmed dead for the whole session,
not just this folder, when even a no-`mnt`-touching command failed at shell startup; written back
via the stage → edit → commit-back path as with every prior pass). Unlike ECON-001/002, **none of
this needs a database migration** — it's config/prompt-file additions plus two settings defaults,
no new columns or tables.

**ECON-003 (commodity price series):**
- New `research/versions/v2.yaml`, carrying v1's five series byte-identical (test-enforced — see
  `test_v2_registry_carries_v1_series_byte_identical`) and adding `commodity_oil_wti` (FRED
  `DCOILWTICO`) and `commodity_oil_brent` (FRED `DCOILBRENTEU`). Brent is included specifically
  because it's the benchmark Vår Energi's own North Sea production is priced against, not just WTI
  as the generic global reference. Deliberately does *not* add a macro-registry gold series: gold
  spot pricing is already covered on the market-data side by Phase 8's planned gold-api.com
  integration (ADR 0011) for the physical-metals holdings themselves — this registry is
  portfolio-wide macro *context*, not holding pricing, so duplicating it would be redundant.
- `settings.active_macro_series_version` moved from `v1` to `v2`.

**ECON-004 (Eurozone/China coverage):** same `v2.yaml`, same reasoning — added
`eurozone_policy_rate` (FRED `ECBDFR`, the ECB's operative Deposit Facility Rate),
`eurozone_hicp_yoy` (FRED `CP0000EZ19M086NEST`, `pc1` YoY transform), and `china_cpi_yoy` (FRED
`CHNCPIALLMINMEI`, `pc1` YoY transform) — directly answering the original finding that the research
prompt already asks the LLM about the ECB with nothing behind it. All three series IDs confirmed to
exist on FRED via web search this session (fred.stlouisfed.org/series/&lt;id&gt;); this build
environment still has no live network path to actually call FRED's API (org egress policy blocks
`data.norges-bank.no` outbound with a 403 at the proxy level, and presumably FRED too — confirmed
via `curl`/proxy-status this session, see ECON-005 below), so — same caveat as every prior FRED
series in this registry — the identifiers are search-confirmed, not live-response-confirmed.

**ECON-006 (macro evidence required in the persona checklist):** new `prompts/persona/v2.md` —
v1's text unchanged (test-enforced — `test_persona_v2_keeps_every_v1_hard_rule`) plus one new
checklist item, "Macro and FX backdrop," instructing the model to explicitly engage with
`macro_snapshot`/macro-news evidence when available (which central bank/inflation/yield/dollar/
commodity signals plausibly support or undercut the thesis) and to say so plainly when it isn't,
rather than silently treating the holding in isolation either way. `settings.active_prompt_version`
moved from `v1` to `v2`. Because `run_two_pass_analysis` loads the reconciliation prompt off the
same version string as the persona prompt (`app/services/analysis/prompts.py`,
`app/services/analysis/runner.py`), this also required a `prompts/synthesis/v2.md` — byte-identical
to v1 except for a one-line note explaining why it exists, since ECON-006 only touches the blind
pass, not reconciliation.

**ECON-005 (Norway policy-rate live verification) — attempted, still open, now better understood:**
tried from both sides this session. From this cloud container: `curl` to
`data.norges-bank.no` returned a 403 at the egress proxy (`connect_rejected`, confirmed via the
proxy's own `/__agentproxy/status` — an org-level policy denial, not a transient failure). From the
device bridge (`device_bash`, which runs on Faiz's own machine and would follow *his* egress
instead): the shell failed at startup this session even for a command that never touches the
`E:\Aladdin` mount (`echo hello-world; curl ...` still errored before running) — so the previously
recurring "can't mount this one folder" issue has, at least for this session, become "the whole
`device_bash` shell won't start," a strictly worse state worth flagging on its own. Net effect:
ECON-005 still can't be verified from any tool available this session. **Fastest real path:** run
`curl "https://data.norges-bank.no/api/data/IR/B.KPRA.SD.?format=csv&lastNObservations=1&locale=en"`
directly from Faiz's own machine (outside the device bridge) or check the response the *next* live
macro refresh against the deployed Railway backend actually gets for `no_policy_rate` — either
confirms the dataset/key or hands back the real error to fix it against.

**Not done as part of this pass:** ECON-007 (regime-aware risk bands) remains open, unchanged —
lowest severity (ℹ️) in the original review, and the risk-band thresholds it would touch
(`scoring/versions/risk_v1.yaml`) are a separate versioned config from everything touched this
pass or in the ECON-001/002 pass.

**Verification:** 297 backend tests passing (was 289 — 8 new: 4 for the v2 macro registry, 4 for
the v2 persona/synthesis prompts), `ruff check .` clean, `mypy app` unchanged baseline-only errors,
frontend `tsc --noEmit` clean, `vite build` succeeds.
