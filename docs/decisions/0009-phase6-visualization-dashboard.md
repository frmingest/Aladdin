# 9. Phase 6 — visualization dashboard

## Status

Accepted

## Context

Phase 6 (§26) is the last build phase in the architecture doc's phasing table, and — unlike every
prior phase — adds no backend capability at all: every endpoint the dashboard reads or triggers
(`POST /portfolio/snapshots/{id}/valuation`, `POST /portfolio/snapshots/{id}/risk-snapshot`,
`GET/POST /thesis/...`, `GET/POST /valuation/...`, `GET/POST /research/...`,
`GET /analysis/...`) already existed from Phases 1-5. What was missing was §19's ten visualizations
and a page to put them on — the frontend had only Phase 1's portfolio/document upload pages and
Phase 3's bare-bones analysis page (`frontend/src/pages/Analysis.tsx`), each landing ahead of its
own phase's real UI per the Phase 2/4/5 precedent PROGRESS.md documents ("no frontend page renders
this phase's endpoints yet").

## Decisions

- **A new `Dashboard` tab, made the default landing tab**, composing every §19 visualization across
  six section components under `frontend/src/pages/dashboard/`: `CompositionSection` (portfolio
  composition), `AllocationDriftSection` (allocation drift), `RiskSection` (portfolio risk heatmap +
  scenario impact + systemic/state risk detail), `FactorProfileSection` (factor profile, across all
  holdings' latest analysis), `MacroSection` (macro dashboard + sector research), and
  `HoldingDetailSection` (a per-holding drill-down: analysis comparison, evidence panel, thesis
  timeline, valuation scenarios — the four §19 items that only make sense for one holding at a
  time). This mirrors the "portfolio-level sections + a holding selector for the rest" split that's
  already implicit in how the Phase 3/5 endpoints are shaped (snapshot-scoped vs. holding-scoped).
- **Manual trigger buttons for every operation that calls a live provider** (valuation refresh, risk
  snapshot compute, macro refresh, sector research refresh) — reading whatever's already on record
  happens automatically on mount. This is exactly `Analysis.tsx`'s existing "Run analysis" convention
  (§2.7: reading is free, a provider call is not) extended to every other provider-backed endpoint
  Phase 6 now surfaces, rather than a new pattern invented for this phase.
- **`recharts` (already a Phase 0 frontend dependency, never previously used) plus one non-chart
  custom grid** (`RiskHeatmap` — a colored stat-tile grid, not an XY chart type) **for every
  visualization**, under `frontend/src/charts/`. Colors follow the dataviz skill's validated
  CVD-safe reference palette (`palette.ts`'s `CATEGORICAL`/`STATUS` — fixed hue order, never
  reassigned by rank) for the hue values themselves, while chrome (gridlines, axis text, tooltip
  surface) reuses this codebase's own Tailwind slate scale rather than the skill's neutral gray ramp
  — the skill's method is explicitly design-system-agnostic; only the categorical/status hues needed
  the CVD validation import, not the surrounding chrome.
- **The portfolio risk heatmap shades its six dimension tiles with illustrative reference bands
  (`charts/referenceBands.ts`), not the app's own scored bands.** `PortfolioRiskSnapshotOut` (§26
  Phase 5) never exposed the per-dimension LOW/MODERATE/MODERATE-HIGH/HIGH bands
  `app.domain.portfolio_risk.score_dimension` computes internally — only the raw metrics plus one
  overall `risk_band` (the worst dimension) and `composite_risk_score`. Re-deriving
  `scoring/versions/risk_v1.yaml`'s actual thresholds in TypeScript would duplicate business logic
  the backend owns and risk silently drifting out of sync with it. Instead the heatmap tiles use
  well-known public reference conventions already cited in the backend's own code — US DOJ/FTC HHI
  merger-guideline bands (from `app.domain.calculations.herfindahl_hirschman_index`'s docstring) and
  standard correlation-strength ranges — with an explicit footnote pointing at the snapshot's own
  `risk_band`/`composite_risk_score` as the authoritative assessment. This is a UI-only illustrative
  shading, never a second source of truth for what the app actually scored.
- **Allocation drift reads every uploaded snapshot's own `weight_pct`, never a re-valuation.** A live
  market-data valuation only exists for whichever snapshot was last refreshed and isn't persisted
  independently of the risk-snapshot/valuation-response it was computed for, so charting drift across
  every historical snapshot uses the number that's unconditionally on record for all of them — the
  weight as uploaded (e.g. from a Nordnet export), not a recomputed market value. This also means the
  chart needs no market-data provider at all and works even for snapshots nobody has ever valued.
- **Two decimal-as-string cases, not one.** Going in, `frontend/src/lib/num.ts` and the module
  docstring on `types/portfolio_risk.ts` only accounted for `PortfolioRiskSnapshotOut`'s five JSON
  dict columns, where `app.services.portfolio_risk.builder._json_safe` explicitly stringifies every
  `Decimal` before it can be persisted to a JSON column. Building this phase's charts against a real
  running backend (`FastAPI TestClient` + an in-memory `MarketDataProvider` fake, since this build
  environment has no network path to yfinance — matching every prior phase's documented networking
  gap) surfaced a second, broader case: pydantic v2's default `Decimal` JSON encoding is a string
  *everywhere* in this API, including directly-typed Pydantic `Decimal` fields like
  `PortfolioValuationOut.total_market_value` or `HoldingAnalysisSummary.overall_score` — not just
  these five JSON-dict columns. `types/market_valuation.ts`, `types/dcf.ts`, `types/research.ts`,
  `types/thesis.ts`, and (pre-existing, from Phases 1/3) `types/portfolio.ts` and `types/analysis.ts`
  were all corrected to type every Decimal-backed field as `string`, with `num()` used at every call
  site that formats or charts one. The Phase 1/3 pages happened to never crash on the old, wrong
  `number` typing only because they never called a number-only method (`.toFixed`, `.toLocaleString`)
  on those fields — arithmetic/comparison operators silently coerce a numeric string, so nothing broke
  visibly until Phase 6's composition/valuation-scenario charts did call those methods.
- **Every `Bar`/`Pie`/`Line` mark sets `isAnimationActive={false}`.** Confirmed by hand against the
  running dashboard: with recharts' default entrance animation on, an already-mounted chart lower on
  the page (e.g. `RiskSection`'s scenario-impact chart) silently lost its fill/stroke — axes and
  reference lines still drew — after an unrelated sibling component's state update reflowed the page
  (reproduced by selecting a different holding in `HoldingDetailSection`). Disabling the animation
  sidesteps whatever recharts/`ResizeObserver`/`react-smooth` interaction causes it; a dashboard that
  re-fetches on every manual refresh has little use for entrance animations regardless.

## Consequences

- **The risk heatmap's per-tile shading is explicitly not authoritative** — see the reference-bands
  decision above. A future phase that exposes `dimension_scores` on `PortfolioRiskSnapshotOut` should
  replace `referenceBands.ts`'s illustrative bands with the real ones rather than layering both.
- **No code-splitting yet** — `vite build` warns the single JS bundle is ~600 kB (167 kB gzipped),
  mostly `recharts`. Acceptable for a single-user personal app per §2.9 (free/low-cost first, scalable
  later), but a real candidate for `dynamic import()` if this ever needs a public multi-user rollout.
- **No project-wide ESLint config exists to run against this phase's new files** — `frontend/`  has
  never had an `eslint.config.js` since Phase 0 (`npm run lint` fails outright: "ESLint couldn't find
  an eslint.config.js file"), a pre-existing gap, not something Phase 6 introduced or fixed.
- **The Decimal-as-string correction (see above) touches Phase 1/3 files** (`types/portfolio.ts`,
  `types/analysis.ts`, `Analysis.tsx`'s `ScorePill`) as well as this phase's new ones — a type-only
  fix (plus one `Number()` conversion at `ScorePill`'s two comparison sites) with no behavior change
  to those pages, made in passing while fixing the same defect in Phase 6's own code.
- **Smoke-testing this phase's UI against real data required a hand-written `FakeMarketDataProvider`
  wired in via `app.dependency_overrides`** (mirroring the pattern already established in
  `tests/integration/test_portfolio_risk_api.py`), not a real `yfinance`/Gemini/FRED call — this build
  environment's lack of network access to those providers is the same documented limitation ADR
  0004/0005/0007/0008 already carry for their own phases, now also the reason Phase 6's own manual
  QA pass used a fake provider rather than the real `MARKET_DATA_PROVIDER=yfinance` default.
- **`black` was still not run against this phase's new files**, for the same reason ADR 0004's
  Consequences already gives (no project-wide `black` config exists) — irrelevant to this phase's
  frontend-only diff, carried forward here only because every other ADR in this sequence notes it.
