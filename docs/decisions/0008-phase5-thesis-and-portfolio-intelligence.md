# 8. Phase 5 — thesis & portfolio intelligence (thesis ledger, valuation/scenario engine, portfolio risk)

## Status

Accepted

## Context

Phase 5 (§26) is the last phase before pure visualization (Phase 6): a thesis ledger (§16), a
deterministic valuation/scenario engine (§17, §18), and a portfolio risk profile including
systemic/state risk (§15, §15.1). It's the first phase that touches *portfolio*-level output
(`portfolio_risk_snapshots`) rather than only per-holding output, and the first to close a loop the
architecture doc left open in Phase 3: §11.3's confirmation-bias guardrail always needed an "existing
thesis" to reconcile against, and used `PortfolioPosition.notes` as a stand-in because there was no
thesis ledger yet (ADR 0006).

## Decisions

- **The investment thesis ledger replaces `PortfolioPosition.notes` as Pass 2's "existing thesis".**
  `app.services.analysis.context._build_user_notes` now prefers the holding's active (`ACTIVE` or
  `UNDER_REVIEW`) `InvestmentThesis`, rendered to text via `format_thesis_for_context` (bull/bear case
  and invalidation conditions included, not just free-text notes), falling back to
  `PortfolioPosition.notes` only when no thesis has been recorded yet. This needed no prompt-version
  bump — Pass 2's synthesis prompt (`prompts/synthesis/v1.md`) already just asks for "the investor's own
  notes/thesis", so a richer text blob in the same field slots in without changing the contract.
- **A thesis row is never mutated by an analysis run.** §25's non-goal ("never automatically alter the
  user's investment thesis without explicit user action") is enforced at the code-boundary level: no
  service in `app.services.thesis` or `app.services.analysis` writes to `InvestmentThesis` except
  `create_thesis`/`update_thesis`, both only reachable from an explicit user-initiated API call
  (`POST`/`PATCH /thesis/...`). `check_invalidation_signal` is read-only by construction — it returns a
  dataclass, never touches the ORM session's dirty state for the thesis object.
- **"Has new evidence strengthened or weakened the thesis" (§16) is answered deterministically, not by
  a new LLM call.** `check_invalidation_signal` compares the thesis's own `status`/`updated_at` against
  the most recent completed `HoldingAnalysis` for the same holding — its `thesis_status` (already an
  LLM-scored field from Phase 3, `weakening`/`broken` counts as a signal) and `invalidation_triggers`
  (already a Phase 3 output field, previously computed but never consumed downstream). This is exactly
  the same category of deterministic-comparison-over-existing-LLM-output the architecture's §22.5
  calibration engine describes for a different purpose (checking scores against outcomes) — applied
  here at thesis granularity instead of waiting for a periodic batch job, since no calibration engine
  exists yet (out of scope this phase — see Consequences).
- **A thesis is a ledger row, not a mutable single record per holding.** `investment_theses` has no
  uniqueness constraint on `holding_id` — creating a new thesis for a holding that already has one adds
  a new row rather than replacing it, so `list_theses_for_holding` surfaces real history (§16: "a
  historical thesis ledger, rather than a collection of disconnected AI memos"). `get_active_thesis`
  (the one `AnalysisContext` reads) picks the most-recently-updated `ACTIVE`/`UNDER_REVIEW` row; a user
  closes one out via `PATCH .../status=CLOSED` and creates a fresh one rather than the API silently
  archiving the old one for them.
- **The DCF valuation engine (`app.domain.valuation`) is one constant-growth-rate, constant-margin,
  N-year-explicit-plus-Gordon-terminal-value model** — not a multi-stage ramp. §17 lists the assumption
  set (`revenue_growth`, `margin`, `capex`, `tax`, `discount_rate`, `terminal_growth`,
  `commodity_price`, `fx`, `shares_outstanding`) without prescribing mechanics beyond "the application
  calculates valuation outputs", so the simplest model that uses every listed assumption was chosen
  over a more elaborate one nothing in the architecture doc asks for. `commodity_price` specifically has
  no defined mechanics anywhere in §17 — it's implemented as an optional direct multiplier on the
  starting revenue figure, which only makes sense for a commodity-revenue-sensitive holding; this is a
  reasonable reading, not a confirmed one, and is documented as such in the module docstring rather than
  silently baked in as if it were self-evidently correct.
- **The LLM critique (§17: "the LLM critiques whether assumptions are reasonable...") is a best-effort
  secondary step, never able to block the deterministic `calculated_value` from being persisted.**
  `create_valuation_case` always computes and stores the DCF result first; the critique step
  (`app.services.valuation.dcf._run_critique`) runs after, in the same request, and any failure —
  missing evidence context, LLM provider error, schema-invalid output — is caught and recorded on
  `ValuationCase.critique_error` rather than raised. This mirrors the Phase 2 per-holding valuation and
  Phase 3 per-holding analysis-run precedents (§21: fail visibly, per-item, never all-or-nothing) applied
  at a finer grain than either of those — here, within a *single* valuation case rather than across a
  batch of holdings.
- **The valuation critique reuses `app.services.analysis.context.build_analysis_context` as-is**,
  finding an evidence-context snapshot via whichever portfolio snapshot most recently included the
  holding (a valuation case has no required snapshot/analysis-run tie of its own — `analysis_run_id` is
  nullable). This avoids building a second evidence-packet assembler for materially the same job Phase 3
  already solved (document excerpts, financial metrics, market snapshot, macro/sector research), at the
  cost of the critique needing *some* snapshot to exist for the holding — a holding never uploaded in any
  portfolio snapshot can still get a deterministic valuation, just not a critique (`critique_error`
  explains why).
- **`portfolio_risk_snapshots` gets both `portfolio_snapshot_id` (required) and `analysis_run_id`
  (nullable)**, deviating from §20's literal `analysis_run_id`-only shape — the same kind of deliberate
  naming deviation ADR 0006 made for `evidence_references.holding_analysis_id`. A risk snapshot is
  portfolio-scoped and buildable on demand without a completed analysis run existing yet (mirroring how
  Phase 2's valuation refresh is independent of Phase 3 analysis runs), so it needs its own direct FK to
  `portfolio_snapshots` rather than only reaching one indirectly through an analysis run that might not
  exist.
- **Portfolio risk reuses Phase 2's concentration calculation (`refresh_and_value_snapshot`) rather than
  recomputing it.** `app.services.portfolio_risk.builder` calls it directly and builds everything else —
  correlation, exposure, systemic/state risk, scenario impact — on top of its
  `ConcentrationProfile`/`HoldingValuation` output. This does mean building a risk snapshot re-fetches
  live prices/FX as a side effect (same network dependency Phase 2's endpoint already has), rather than
  reading back whatever concentration figures happened to be computed last; that's judged consistent
  with "a risk profile should reflect current conditions" rather than a staleness risk worth avoiding.
- **Correlation is computed from historical daily prices (`MarketDataProvider.get_historical_prices`,
  already part of the Phase 2 interface but never called by application code until now), Pearson, in
  float** — a statistical estimate, not financial arithmetic, so it's the one calculation in this
  codebase's risk/valuation layer that deliberately doesn't use `Decimal` throughout (documented in
  `app.domain.portfolio_risk.pearson_correlation`'s docstring so it doesn't read as an oversight). A pair
  with fewer than `min_overlap` (default 5) shared observation dates is reported as
  `insufficient_data_pairs`, never a fabricated correlation.
- **Deposit/cash positions are valued from `quantity` directly, not through the market-data pipeline.**
  Cash has no ticker to price via `MarketDataProvider`, so `_compute_cash_positions`
  (`app.services.portfolio_risk.builder`) treats a cash holding's `quantity` as its value in its own
  `trading_currency`, converted to the reporting currency via the most recent `FxObservation` on record
  (falling back to excluding the position, with an explicit warning, if no FX rate has ever been
  observed for that pair). This is a different valuation path from every priced holding, which is
  necessary rather than an inconsistency — cash genuinely doesn't have a market price to fetch.
- **Institution is used as the proxy for "jurisdictional concentration" (§15.1)** — there is no
  dedicated custodian-country field on `Holding` yet, and adding one for a single risk sub-dimension this
  phase was judged premature (§2.9: avoid infrastructure the current need doesn't clearly justify).
  Institution names are jurisdiction-specific in practice for Faiz's own portfolio (e.g. a Norwegian bank
  vs. a Norwegian broker vs. a foreign custodian), so the approximation is reasonable but explicitly
  flagged as such in code, not presented as a true jurisdiction field.
- **The Norwegian wealth-tax estimate (§15.1) is Settings-driven constants, not a new versioned-config
  family.** Unlike scoring weights or scenario shocks — which are genuinely expected to be tuned or
  extended over time — `bunnfradrag`/`rate`/`share_discount` are simple, rarely-changing numbers for
  exactly one jurisdiction (this is explicitly a single-user, NOK-reporting-scope application per the
  architecture's own framing). A `wealth_tax_no_v1.yaml`-style file was considered and rejected as
  over-engineering a one-off calculation relative to the versioned-config machinery scoring/scenarios
  genuinely need. The estimate only runs when `reporting_currency == "NOK"`; any other reporting
  currency gets an explicit "skipped, not implemented for this currency" warning rather than a silently
  wrong number (§15.1's own "optional/skippable per holding... rather than blocking the rest of the risk
  profile" principle, applied at the whole-estimate level).
- **`risk_band` is the single worst-scoring dimension's band (`worst_band`), not the composite score's
  own band.** §15 is explicit that the risk *profile* is primary and a composite score is secondary; a
  portfolio with one severely concentrated dimension and four fine ones would have its real risk masked
  by a blended average, so the headline band deliberately doesn't average that signal away.
  `derive_risk_band` (composite-score-driven) exists as a documented fallback for a future caller that
  specifically wants the composite's own band, but the builder doesn't use it for `risk_band`.
- **Scenario impact is additive across whatever asset-class/sector/currency shocks match**, not a
  single-assignment factor model — a holding matching both an asset-class shock and a sector shock (an
  equity in the energy sector) gets both applied and summed, which can double-count the same economic
  exposure. Documented as a real methodological simplification in `app.domain.scenarios`'s module
  docstring rather than presented as more rigorous than it is; good enough for a directional "what
  happens to my portfolio" estimate, consistent with §18's own framing ("scenario calculations should be
  deterministic where inputs exist, with qualitative LLM interpretation layered on top" — no LLM
  interpretation layer was built this phase either, see Consequences).
- **No LLM-authored portfolio-risk narrative was built this phase.** `PortfolioRiskSnapshot.narrative`
  is a short, deterministic, code-generated summary sentence (`_build_narrative`) — the risk band, the
  two or three highest-severity dimensions, the wealth-tax figure if present, the worst modeled scenario.
  A richer LLM narrative (in the spirit of the §11 persona-driven holding memos) is a natural follow-up
  once there's a specific reason to want prose over a structured summary; building it speculatively this
  phase would have doubled the LLM surface area (a fourth prompt/schema/provider-call path, after
  persona/synthesis/valuation) without a concrete need driving its shape yet.
- **`scoring/versions/risk_v1.yaml` is a separate file/version-namespace from `scoring/versions/v1.yaml`**,
  not a new section appended to the existing file. The two configs drive genuinely different outputs
  (`HoldingAnalysis.overall_score` vs. `PortfolioRiskSnapshot.composite_risk_score`) with different
  versioning lifecycles — bumping holding-factor weights should never force a risk-scoring version bump
  and vice versa. `settings.active_risk_scoring_version` defaults to the literal string `"risk_v1"` (not
  `"v1"`) specifically so the two "v1"-shaped configs can never be confused for each other by a copy-paste
  settings change.
- **A new top-level `scenarios/` directory**, mirroring `research/versions/` and `scoring/versions/`
  exactly (`app.config.paths.SCENARIOS_DIR`, `app.domain.scenarios.load_scenario_registry`) — a
  scenario's shocks are exactly the kind of "a non-engineer can tune this" data §2.4 already established
  the pattern for.

## Consequences

- **The DCF model's numbers, like every scenario-shock number in `scenarios/versions/v1.yaml`, are
  illustrative and directionally-reasoned, not the output of a fitted or externally-validated model** —
  stated explicitly in both modules' docstrings/comments, matching the architecture doc's own §18
  example being illustrative rather than sourced.
- **Correlation and the wealth-tax estimate both depend on data this build environment cannot verify
  live** (historical price series via yfinance; the wealth-tax bracket/discount figures reflect 2024
  Norwegian rules read from public sources, not verified against a live Skatteetaten calculation) — the
  same category of limitation ADR 0004/0005/0007 already documented for their respective external
  dependencies.
- **No calibration/track-record engine (§22.5) was built this phase.** `check_invalidation_signal` covers
  part of the same need at thesis granularity (comparing a past record against subsequent LLM output),
  but the periodic, portfolio-wide "was high confidence actually associated with better outcomes"
  dashboard §22.5 describes — with its own `calibration_checks` table from §20 — remains a deliberate,
  documented follow-up, not something this phase's thesis-invalidation check should be mistaken for.
- **Jurisdictional concentration is approximated via institution, not a real custodian-country field.**
  A holding whose institution name doesn't obviously map to a country (an unfamiliar or ambiguous
  broker name) will still show up in `jurisdictional_weights_pct`, just under a jurisdiction-shaped label
  that isn't actually verified as one.
- **No frontend page renders any Phase 5 endpoint yet** — `POST/GET /thesis/...`,
  `POST/GET /valuation/...`, and `POST/GET /portfolio/.../risk-snapshot(s)` exist and are usable via the
  API/docs only, matching the Phase 2/Phase 4 precedent of API-first landing before a frontend page
  follows in a later phase.
- **`black` was still not run against this phase's new files**, for the same reason ADR 0004's
  Consequences already gives (no project-wide `black` config exists) — Phase 5's files follow the
  existing ~110-120-character-line convention.
