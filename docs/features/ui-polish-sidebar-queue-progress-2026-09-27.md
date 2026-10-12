# UI polish: sidebar, queue progress, correlation names, logo, collapsible holdings — 2026-09-27

Five small UX requests from Faiz, done in one pass. No migration; one additive API field
(`ticker_names` on the correlation payload) with a safe default everywhere it's constructed.

## 1. Grouped sidebar

13 flat nav links had become a wall of text. `Layout.tsx`'s `NAV_ITEMS` array became
`NAV_SECTIONS`, five small groups with a small uppercase header each, same links, same order
within each group, so nothing muscle-memory depended on moved far:

- **Overview** — Dashboard
- **Portfolio** — Holdings, Portfolio, Performance, Portfolio risk, Margin of safety, Precious metals
- **Research** — Analysis queue, Watchlist, Macro
- **Tracking** — Journal, Thesis
- **System** — Settings

Not collapsible — five short groups read fine always-open; collapsing them would just add
clicks. Desktop sidebar and the mobile drawer share the same `NavContents`, so both got this
for free.

## 2. Analysis-queue progress % and ETA

The worker (`backend/app/worker/runner.py`) already reports state via a heartbeat row polled
every 15s by the frontend. Added a `on_stage` callback into `run_full_analysis`
(`backend/app/services/analysis/pipeline.py`), called at each of its four real stage
boundaries (evidence packet → blind pass → reconciliation pass → finalizing), each mapped to a
fixed percentage (`pipeline.STAGE_PROGRESS`: 5/20/65/95). The worker bakes the percentage onto
the end of its existing `detail` text — `"Analyzing EQNR — Running blind pass (LLM) (20%)"` —
rather than adding a DB column: no migration, and an older worker build without the change just
shows plain text (frontend gracefully treats missing `(NN%)` as "no progress bar").

Frontend (`AnalysisQueuePage.tsx`) parses that trailing `(NN%)`, renders a small progress bar +
percentage, and estimates an ETA from the average wall-clock duration of the holding's own
worker's recently COMPLETED runs (`queue.recent`, already had `started_at`/`completed_at` — no
API change needed for that part) times the remaining fraction. Shown both on the worker status
row and on the matching RUNNING row in the queue table.

Percentages are a fixed per-stage estimate, not measured work inside a stage — good enough for
a progress bar / rough ETA, not a guarantee (evidence packet build and the two LLM passes don't
take equal wall-clock time in reality, but blind pass ≈ reconciliation pass in practice).

## 3. Correlation matrix: names instead of tickers

`CorrelationResult`/`CorrelationOut` gained a `ticker_names: dict[str, str]` (ticker → holding
name), populated in `portfolio_risk.py` from the same `equity_positions` list that already has
names (correlation.py itself only ever sees price history keyed by ticker, so it can't build
this map itself). Demo mode (`synthetic_data.py`) populates it too so it doesn't 422 on the new
required field.

`PortfolioRiskPage.tsx`'s heatmap headers now show the name, truncated to the first N characters
(9 for the narrow column headers, 18 for row headers) with `…`, full name in the cell's
`title` tooltip on hover. Cell grid size (h-9 w-14 per data cell) is untouched — only the header
content changed, so the matrix's footprint on screen doesn't move.

## 4. Genie-bottle logo

`Layout.tsx`'s `Brand()` used a plain gradient-chip "A" monogram. Replaced with a 2-shape inline
SVG genie bottle (cork + bulbous body) in the same gradient chip, same size, reused by the
desktop sidebar, mobile top bar and mobile drawer header (all three already shared one `Brand`
component). Also added a matching SVG favicon (`frontend/index.html` had none before).

(Superseded 2026-10-01: the genie bottle was replaced by the golden lamp logo.)

## 5. Collapsible sections on the holding page

Two page-level sections switched to the existing `CollapsibleSection` component (already used
for Thesis tracking / Decision journal / Primary sources, collapsed by default):

- **Reports from Newsweb** (the annual-report fetch card at the top of the page)
- **Documents**

Inside the analysis view (`AnalysisPanel.tsx`), the individual long-text narrative cards — not
just "Business quality & moat" and "Capital efficiency" but all of them (Steward & costs,
Portfolio construction, Macro & industry stress test, Valuation, Role in your portfolio,
Financial fortress) — are now each independently collapsible, collapsed by default, so a full
analysis run doesn't render as 6-8 walls of text at once. Header (icon, title, rating badge /
data-gap badge) stays visible; only the prose body + citations collapse. `VerdictCard` (the
top summary) was left always-open — that's the one card meant to be read immediately.

## Verification

`tsc --noEmit`, `eslint` and `vitest` (19/19) all clean on the frontend; backend changes are
syntax-checked (`ast.parse`) and reviewed by hand — this session's environment couldn't run the
backend's own pytest suite (the checked-out `.venv` is a Windows venv, not runnable from this
session's shell), so **Faiz should run the backend test suite once on the PC before pushing**,
particularly `test_analysis_pipeline.py`, `test_worker.py` and `test_risk_correlation.py`.

Not yet committed or pushed — see progress.md §2.
