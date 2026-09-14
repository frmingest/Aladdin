# 14. Macro-economic review of the analysis/valuation/risk logic

## Status

Accepted (review). Findings below are tracked as new "Up next" candidates in
`docs/PROGRESS.md` — nothing in this ADR has been implemented yet.

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
