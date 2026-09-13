# Aladdin

Investment-grade portfolio analyzer — an evidence-first system for reasoning about a personal
portfolio through a Buffett/Munger value-investing lens, with deterministic financial calculations,
external macro/sector research, and full provenance on every material claim.

This is decision support, not a trading engine — no order execution, no automated financial advice.

## Status

Phase 0 (foundation), Phase 1 (portfolio + document ingestion), Phase 2 (market data, FX,
deterministic financial metrics), Phase 3 (AI analysis), Phase 4 (external research), and Phase 5
(thesis & portfolio intelligence) are built. See [`docs/architecture.md`](docs/architecture.md) for
the full design document (data model, service boundaries, scoring methodology, risk model, build
phasing) and `docs/decisions/` for implementation-level choices made along the way. See
[`docs/PROGRESS.md`](docs/PROGRESS.md) for the current phase-by-phase status and known gaps.

Phase 2 adds a yfinance-backed market-data layer: `POST /portfolio/snapshots/{id}/valuation`
fetches live prices/FX for a snapshot's holdings and returns deterministic market value, unrealized
P&L, and concentration/exposure. A holding ingested from a Nordnet export has no market-data symbol
until you set one via `PATCH /portfolio/holdings/{id}` (see
`docs/decisions/0004-phase2-market-data-and-financial-metrics.md`).

Phase 3 adds the AI analysis engine: `POST /analysis/snapshots/{id}/runs` runs a two-pass
Buffett/Munger assessment (an independent blind read, then reconciliation against any notes on that
holding's position — the confirmation-bias guardrail in architecture §11.3) over every holding in a
snapshot that has at least one document or financial fact on record, using Google AI Studio's
Gemini API rather than the architecture's original Anthropic recommendation (see
`docs/decisions/0005-phase3-google-ai-studio-llm-provider.md`,
`docs/decisions/0006-phase3-ai-analysis-engine.md`). Requires `GOOGLE_AI_STUDIO_API_KEY` in
`backend/.env` — without it, a run fails immediately with an explicit error rather than a silent
no-op.

Phase 4 adds external research: a `MacroDataProvider` (FRED primary, Norges Bank for NOK-specific
series) refreshes central-bank/macro numeric series (policy rates, inflation, real yields,
breakevens, the dollar index), and a `ResearchProvider` (Gemini + Google Search grounding) refreshes
macro-news and per-sector qualitative research. Both run on a background schedule (macro daily,
sector research weekly per sector currently held) and are also triggerable on demand via
`POST /research/macro/refresh` and `POST /research/sectors/{sector}/refresh`; `GET
/research/macro/snapshot` and `GET /research/sectors/{sector}/items` read back the latest persisted
data with no provider call. Analysis runs (Phase 3) now cite this data as evidence when it's
available. Requires `FRED_API_KEY` in `backend/.env` (free at
https://fred.stlouisfed.org/docs/api/api_key.html) — without it, macro refresh fails immediately with
an explicit error for FRED-backed series. See `docs/decisions/0007-phase4-external-research.md`.

Phase 5 adds thesis & portfolio intelligence: an investment thesis ledger
(`POST`/`GET`/`PATCH /thesis/...`) that replaces free-text position notes as the "existing thesis"
Phase 3's confirmation-bias guardrail reconciles against, plus a read-only, deterministic
`GET /thesis/{id}/invalidation-check` (never auto-updates the thesis itself); a deterministic DCF
valuation engine with a best-effort LLM assumption critique (`POST /valuation/holdings/{id}/cases`);
and portfolio risk snapshots (`POST /portfolio/snapshots/{id}/risk-snapshot`) covering concentration,
correlation, currency/commodity exposure, systemic/state risk (deposit concentration vs. the
per-institution guarantee limit, custody-type breakdown, a Norwegian wealth-tax estimate,
institution-proxied jurisdictional concentration), and estimated impact under eight macro/stress
scenarios. See `docs/decisions/0008-phase5-thesis-and-portfolio-intelligence.md`.

## Core principles

- **Evidence first, AI second.** The LLM interprets; it is never the system of record.
- **Deterministic code does the arithmetic.** The LLM is reserved for qualitative judgment.
- **Every analysis is reproducible** — snapshotted inputs, versioned prompts/scoring/schemas.
- **Confidence and uncertainty are explicit**, never converted into false precision.
- **Free/low-cost first**, with clear upgrade paths rather than architectural rewrites.

## Repository layout

```text
backend/    FastAPI application (services, domain, providers, tests)
frontend/   React + Vite dashboard
prompts/    Versioned persona/extraction/synthesis/research/valuation prompt templates
scoring/    Versioned scoring configuration (holding factors + portfolio risk)
schemas/    Versioned extraction/output schemas
research/   Versioned macro series registry (FRED/Norges Bank routing)
scenarios/  Versioned macro/stress scenario registry (§18)
docs/       Architecture and design decisions
docker/     Container/deployment config
```

## Local development (Phase 0)

**Backend**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env                                 # fill in GOOGLE_AI_STUDIO_API_KEY (Phase 3) and FRED_API_KEY (Phase 4)
docker compose -f ../docker/docker-compose.yml up -d  # starts local Postgres
uvicorn app.main:app --reload                         # http://localhost:8000/health
```

**Frontend**

```bash
cd frontend
npm install
npm run dev                                           # http://localhost:5173
```

**Tests**

```bash
cd backend
pytest
```

**Migrations** (once the first models exist in `app/models/`)

```bash
cd backend
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## Build phasing

See §26 of the architecture doc. Summary: Foundation → Portfolio & document ingestion
(no AI dependency) → Deterministic financial/market data → AI analysis → External research →
Thesis & portfolio intelligence → Visualization.

## License

TBD.
Investment-Grade Portfolio Analyzer — Architecture & Solution Design

Status: Master design document — development reference Version: 3.0 Last updated: 2026-09-12 Design goal: Best-practice architecture at near-zero cost, built for a single-user personal portfolio first and scalable later without fundamental redesign.

v3.0 changes: Added a systemic/state-risk dimension to the portfolio risk model (§15.1); added a confirmation-bias guardrail requiring a blind LLM pass before user notes are introduced (§11.3); broadened the macro data spec to cover real yields, breakevens, and dollar strength (§9.1); made factor weights regime-conditional rather than fixed (§13.1); added a track-record/calibration engine (§22.5).

1. Purpose & Scope

A personal web application that:

Ingests source documents (quarterly/annual reports, investor presentations, spreadsheets) for holdings in the portfolio.
Ingests the current portfolio itself (holdings, weights, cost basis) from a simple upload format.
Uses an LLM (Claude) to read and reason over source material through a Buffett/Munger value-investing lens: moat, management quality, capital allocation, intrinsic value vs. price, circle of competence, and margin of safety.
Augments that reasoning with external research: central-bank policy/rates, macro/geopolitical developments, and sector-specific research.
Separates deterministic calculations from qualitative LLM judgment.
Produces transparent factor assessments, confidence levels, investment theses, portfolio-risk profiles, and decision-support output (buy/hold/trim/sell tilt, never an automated trading command).
Preserves the evidence and methodology behind every material analysis so results are explainable and reproducible.
Visualizes portfolio composition, risk dimensions, factor assessments, macro conditions, valuation scenarios, and historical thesis changes.

This is decision support, not a trading engine — no order execution and no financial-advice automation.

2. Guiding Design Principles
2.1 Evidence first, AI second

The application is fundamentally an evidence system. The LLM interprets evidence; it does not become the system of record.

Every material factual claim should be traceable to:

a source document and page/section where possible,
a market-data observation,
a research item,
a deterministic calculation,
or explicitly identified user input.

The conceptual flow is:

text
Source
  ↓
Verified / extracted fact
  ↓
Deterministic calculation OR LLM interpretation
  ↓
Investment thesis / conclusion
  ↓
Portfolio implication
  ↓
Human decision
2.2 LLM does the reading and interpretation, not the arithmetic

Use deterministic application code for calculations whenever practical:

revenue growth
margins
debt / EBITDA
net debt
FCF
ROIC / ROE
valuation multiples
dividend yield
portfolio weights
P&L
concentration
FX conversion
scenario calculations

Use the LLM primarily for qualitative judgments:

moat
management quality
capital allocation quality
competitive position
quality of earnings
thesis strength
qualitative macro sensitivity
geopolitical interpretation
reasonableness of valuation assumptions

If a number can be calculated reliably by code, do not ask the LLM to calculate it.

2.3 Reproducibility

Every material analysis must be reconstructable from its inputs and configuration.

An analysis should record:

portfolio snapshot
source documents / research snapshot
market-data snapshot
AI provider and model
prompt/persona version
scoring configuration version
extraction schema version
application version
timestamps
final structured output
2.4 Version everything that can change interpretation

Version:

persona/prompts
factor weights
scoring methodology
extraction schemas
research methodology
analysis output schema
model identifiers
application releases
2.5 Human-in-the-loop by design

The system produces a reasoned memo and evidence-backed considerations, not a black-box command.

Numeric scores are summaries of underlying evidence and reasoning, never the primary artifact.

2.6 Uncertainty must be explicit

Every material qualitative assessment should have a confidence level:

High
Medium
Low

The system must be allowed to say:

Insufficient evidence to assess this factor reliably.

It must never convert missing information into false precision.

2.7 Cache aggressively

Central-bank data, macro research, and sector research do not need to be fetched on every page load. Research is treated as a periodic job, not a per-click API call.

2.8 Own your data, rent the compute

Portfolio data, source documents, evidence, analysis history, and investment theses live in storage controlled by the application.

2.9 Free/low-cost first, scalable later

The initial implementation targets a single user and near-zero fixed cost. Components should have clear upgrade paths rather than requiring architectural replacement.

3. High-Level Architecture
text
                         ┌───────────────────────────────┐
                         │           FRONTEND            │
                         │ React/Vite · Dashboard        │
                         │ Portfolio · Research · Memos  │
                         └───────────────┬───────────────┘
                                         │ REST/JSON
                         ┌───────────────▼───────────────┐
                         │          BACKEND API           │
                         │         FastAPI / Python       │
                         ├─────────────────────────────────┤
                         │ Portfolio Service              │
                         │ Document Service               │
                         │ Market Data Service            │
                         │ Research Service               │
                         │ Analysis Context Builder       │
                         │ LLM Analysis Service           │
                         │ Scoring Engine                 │
                         │ Portfolio Synthesis            │
                         └───────┬───────────────┬────────┘
                                 │               │
                    ┌────────────▼───────┐   ┌───▼──────────────┐
                    │     PostgreSQL     │   │   Claude API     │
                    │                    │   │                  │
                    │ Facts              │   │ Extraction       │
                    │ Evidence           │   │ Reasoning        │
                    │ Runs               │   │ Synthesis        │
                    │ Scores             │   │ Research         │
                    │ Theses             │   └──────────────────┘
                    └────────────┬───────┘
                                 │
                         ┌───────▼────────┐
                         │ Object Storage │
                         │ Original files │
                         └────────────────┘

External Data
 ├── Company filings / reports
 ├── Market prices
 ├── FX
 ├── Central banks
 ├── Macro data
 ├── News / research
 └── Sector sources

Scheduled Jobs
 ├── Market-data refresh
 ├── Macro refresh
 ├── Research refresh
 └── Portfolio-review triggers

Architectural rule

Business logic should depend on interfaces, not specific vendors.

Examples:

text
MarketDataProvider
ResearchProvider
LLMProvider
ObjectStorageProvider

This allows providers to be replaced without redesigning the application.

4. Tech Stack
Layer	Recommendation	Notes
Frontend	React + Vite + Tailwind	Actual package versions pinned in repository
Charts	Recharts initially; Plotly where advanced charts are justified	No paid visualization SaaS
Backend	Python + FastAPI	Async-friendly for AI/API workloads
Database	PostgreSQL	Primary system of record
File storage	Supabase Storage or Cloudflare R2	Raw source files retained
PDF parsing	PyMuPDF / fitz, pdfplumber	Text + tables + page rendering
PPT parsing	python-pptx	Text, notes, slide metadata
Excel parsing	openpyxl / pandas	Structured validation
AI	Anthropic Claude API	Exact model IDs live in configuration
Background jobs	APScheduler initially; external cron/worker later if needed	Avoid Celery/Redis at single-user scale
Hosting	Railway / Supabase / equivalent low-cost managed infrastructure	Exact vendor choice is deployment documentation
Auth	Simple single-user auth initially	Avoid premature multi-tenant complexity
Configuration	YAML/JSON + environment variables	Secrets never committed

Vendor pricing, quotas, and free-tier limits are operational details and should not be treated as permanent architectural assumptions.

5. Source of Truth & Provenance

This is a core architectural requirement.

5.1 Evidence hierarchy

The application distinguishes:

Source facts — directly reported or observed.
Derived metrics — deterministic calculations from source facts.
External research — retrieved information with source metadata.
User thesis/input — explicitly supplied by the user.
LLM interpretation — qualitative reasoning based on the above.
Investment conclusion — synthesized decision-support output.

These categories must not be silently mixed.

5.2 Provenance requirements

For material evidence, retain:

text
source_type
source_id
document_id / research_item_id
page_start
page_end
section
retrieved_at
content_hash where applicable

The UI should be able to show evidence such as:

Revenue growth is slowing.

with a link/reference to the underlying annual report page or data observation.

5.3 Evidence packets

Before an LLM analysis, construct a deterministic AnalysisContext / evidence packet:

text
AnalysisContext
├── Portfolio position
├── Current market price
├── FX snapshot
├── Deterministic financial metrics
├── Relevant report excerpts
├── User thesis
├── Macro snapshot
├── Sector research
├── Recent relevant events
├── Previous analysis
└── Evidence references

The LLM reasons over this context rather than directly querying arbitrary application state.

6. Document Ingestion Pipeline

Goal: turn uploaded PDF/PPT/XLSX files into clean, structured, traceable evidence without repeatedly sending raw binaries to the LLM.

Flow
text
Upload
  ↓
File validation
  ↓
SHA-256 hash / deduplication
  ↓
Store original file
  ↓
Type-specific extraction
  ↓
Extraction quality checks
  ↓
Structured extraction
  ↓
Schema validation
  ↓
Persist facts + evidence + provenance
6.1 File validation

Validate:

file type
file size
expected extension/MIME type
basic readability
duplicate hash
extraction success

Document states:

text
UPLOADED
PROCESSING
PROCESSED
VALIDATED
FAILED
STALE
6.2 Type-specific extraction

PDF

extract text page-by-page
extract tables separately
retain page numbers
render chart-heavy pages when necessary
preserve section boundaries

PPT

extract slide text
extract speaker notes
retain slide numbers
optionally render chart-heavy slides as images
use vision input where charts cannot be represented faithfully as text

Excel

parse with pandas/openpyxl
normalize headers
validate against schemas
detect suspicious units/percentages
preserve source sheet and cell/range provenance where practical
6.3 Long-document processing

For long reports:

text
Raw document
    ↓
Section/page chunks
    ↓
Cheap structured extraction
    ↓
Validated facts
    ↓
Evidence packet
    ↓
Reasoning model

Do not send an 80-page report into every reasoning call.

6.4 Extraction quality

The system should flag:

missing pages
unusually low text extraction
malformed tables
suspicious numeric conversions
missing expected financial statements

Human review may be required for low-quality extraction.

7. Portfolio Upload Format

The ingestion service should be schema-flexible but validate against a stable canonical schema.

Column	Example	Notes
Ticker	VAR.OL	Exchange-qualified ticker where possible
Name	Vår Energi	Canonical display name
Asset class	Aksje / ETF / Fond / Cash	
Quantity	1200	Optional if weight-only
Weight %	27.51	Stored as numeric percentage
Cost basis	28.40	Numeric value; currency stored separately
Currency	NOK	Trading/reporting currency
Sector/Theme	Energy	Used for research routing
Notes	BlueNord merger thesis	User-provided context

Important distinction

The data model must distinguish:

trading currency
portfolio reporting currency
economic exposure, where known

The initial portfolio reporting currency is NOK.

8. Market Data & FX Layer

Market data is foundational, not an optional later feature.

8.1 Provider abstraction
text
MarketDataProvider
├── get_latest_price()
├── get_historical_prices()
├── get_dividends()
├── get_market_metadata()
└── get_fx_rate()

Possible providers can change over time without changing the application layer.

8.2 Required data
current price
historical prices
trading currency
market/exchange
shares outstanding where available
dividends where relevant
FX rates
timestamps
source/provider
8.3 Data quality

Market observations should include:

text
observed_at
provider
currency
source
quality/status

The system must clearly distinguish:

current
delayed
stale
unavailable

from one another.

9. External Research Layer

Three primary research streams are supported.

9.1 Central bank & rates

Potential sources:

FRED
ECB
Norges Bank
other official central-bank sources where appropriate

Track:

policy rate
decision dates
inflation (headline and core)
yield curve
real yields (nominal minus inflation/breakeven, key tenors)
breakeven inflation rates
broad dollar index (e.g. DXY or trade-weighted equivalent)
relevant forward guidance/projections
major monetary-policy changes

Real yields, breakevens, and dollar strength are tracked explicitly rather than left implicit, because they are the transmission variables that actually connect central-bank policy to gold, commodity, and currency-exposed holdings. A macro snapshot limited to policy rate and headline inflation cannot support or invalidate a thesis that depends on real-rate or dollar-debasement dynamics.

Refresh approximately daily unless a specific use case requires more frequent data.

9.2 Macro / world news

Use a ResearchProvider abstraction.

Potential implementation:

text
ResearchProvider
├── Claude web research
├── official/RSS sources
└── future dedicated research APIs

Research should store source-level metadata rather than only an opaque JSON blob.

9.3 Sector-specific research

Research is routed by sector/theme and holding.

Examples:

North Sea E&P outlook
gold mining cost curves
defence spending
commodity outlook
relevant regulatory developments

Sector research can be cached for a rolling period because it does not need to refresh on every portfolio page view.

9.4 Research source record

Each research item should retain:

text
research_run_id
source_url
source_name
published_at
retrieved_at
title
summary
source_type
relevance
content_hash

This makes research auditable and allows an analysis to explain which external information influenced it.

10. Analysis Runs & Reproducibility

An analysis run is a first-class domain object.

text
analysis_runs
├── portfolio snapshot
├── evidence/research snapshot
├── model/provider
├── prompt/persona version
├── scoring version
├── extraction schema version
├── application version
├── input references
├── structured output
└── status / timestamps

Example statuses:

text
QUEUED
RUNNING
COMPLETED
PARTIAL
FAILED

A historical analysis must remain understandable even after the application, model, prompt, or scoring methodology changes.

11. Analysis Services

Avoid a single "god object" orchestrator.

Recommended flow

text
Document Service
        │
Market Data Service
        │
Portfolio Service
        │
Research Service
        │
        ▼
Analysis Context Builder
        │
        ▼
LLM Analysis Service
        │
        ▼
Scoring Engine
        │
        ▼
Portfolio Synthesis
11.1 Buffett/Munger analytical lens

The persona should assess:

circle of competence
moat
pricing power
switching costs
management quality
capital allocation
financial strength
earnings quality
intrinsic value
valuation vs. price
margin of safety
temperament / market-noise considerations

The persona is a versioned prompt template stored in the repository, not hardcoded application logic.

11.2 LLM guardrails

The LLM must:

never invent financial figures
distinguish reported facts from interpretation
cite or reference evidence for material claims
explicitly state when evidence is insufficient
never silently fill missing data
label estimates and assumptions
avoid presenting rough valuation estimates as precise intrinsic values
preserve uncertainty
return schema-valid structured output
11.3 Confirmation-bias guardrail

The user-supplied Notes field (§7) and any existing thesis (§16) reflect the user's own prior conviction. If these enter the evidence packet before the LLM forms an independent view, the analysis risks becoming a rationalization of positions already held rather than an independent stress test — a single-user tool is especially exposed to this because there is no second reviewer to catch it.

To guard against this, the analysis is split into two passes:

text
Pass 1 — Blind analysis
  Evidence packet WITHOUT user notes/existing thesis
  ↓
  Independent Buffett/Munger assessment

Pass 2 — Reconciliation
  Pass 1 output + user notes/existing thesis
  ↓
  Explicit comparison: where do they agree/disagree, and why

Both passes are persisted. The structured output should surface material divergence between the blind assessment and the user's stated thesis as a first-class field, not bury it in narrative text.

12. Structured LLM Output

The application should define a stable output schema before implementation.

Illustrative structure:

json
{
  "executive_summary": "",
  "thesis_status": "intact",
  "business_quality": {
    "score": 8,
    "confidence": "high",
    "reasoning": ""
  },
  "financial_strength": {
    "score": 7,
    "confidence": "high",
    "reasoning": ""
  },
  "valuation": {
    "score": 6,
    "confidence": "medium",
    "reasoning": ""
  },
  "key_strengths": [],
  "key_risks": [],
  "new_information": [],
  "thesis_divergence": {
    "blind_assessment_summary": "",
    "user_thesis_summary": "",
    "material_disagreement": false,
    "disagreement_notes": ""
  },
  "supporting_evidence": [],
  "contradicting_evidence": [],
  "invalidation_triggers": [],
  "decision_considerations": [],
  "source_references": []
}

The exact production schema should be maintained as a versioned contract.

13. Ranking Model & Scoring
13.1 Factor categories

The model should remain transparent and configurable.

Factor	Suggested weight	Primary input
Business quality	25%	Documents + qualitative LLM analysis
Financial strength	20%	Deterministic financial metrics
Valuation	15%	Market data + valuation engine + LLM critique
Macro/rate sensitivity	15%	Macro data + LLM interpretation
Sector outlook	15%	Research
Geopolitical exposure	10%	Research + LLM interpretation

Weights live in configuration, not application code.

Regime-conditional weighting. Fixed weights implicitly assume macro/geopolitical factors matter the same amount in every environment. They don't: in a regime shift (e.g. stagflation, currency stress), macro sensitivity and geopolitical exposure should carry more weight than in a calm environment, and business-quality/valuation should carry relatively less. Rather than hand-tune weights per analysis, define a small set of named weight profiles (e.g. baseline, stagflation, crisis) in the same versioned configuration, with a macro_regime field on the analysis run recording which profile was active. The regime classification itself can start as a simple user-set flag and later be informed by the macro snapshot (§9.1) — it does not need to be automated on day one, but the schema should support it from the start so historical runs remain comparable once it is.

13.2 Deterministic vs qualitative scoring

Where measurable, scores are calculated by the application.

Where qualitative judgment is required, the LLM provides:

text
score
confidence
reasoning
evidence references

The scoring engine then combines these inputs.

13.3 Avoid false precision

A score such as 7.3 should not imply that the difference between 7.3 and 7.2 is economically meaningful.

Prefer:

1–10 factor scores
confidence
qualitative bands
evidence
narrative interpretation

Use precise numbers only where the underlying calculation is actually precise.

14. Business Quality, Valuation & Risk Are Separate Dimensions

A good business can be an expensive stock.

A cheap stock can be a poor business.

A good holding can still create excessive portfolio risk.

Therefore the system should distinguish:

Business Quality — How good is the underlying business/asset?

Valuation — How attractive is today's price relative to reasonable assumptions?

Portfolio Risk — What happens to the portfolio if the thesis is wrong?

Example:

text
Business Quality:     8.1
Financial Strength:   7.4
Valuation:            8.7
Macro Sensitivity:    4.2
Portfolio Risk:       6.8

Overall attractiveness: 7.6
Confidence: High

These dimensions should not be collapsed prematurely.

15. Portfolio Risk Model

The portfolio risk view should prioritize a risk profile over a single number.

Track at minimum:

concentration
correlation
liquidity
currency exposure
commodity exposure
macro sensitivity
geopolitical exposure
sector concentration
single-name concentration
scenario sensitivity
systemic/state risk (§15.1)

Example:

text
Concentration       Medium
Correlation         High
Liquidity            Low
Macro sensitivity   High
Currency exposure   Medium
Commodity exposure  High
Geopolitical        Medium
Systemic/state risk Medium

Overall Risk Band: MODERATE-HIGH

A numeric composite risk score may exist as a secondary summary, but it must not be the primary representation.

15.1 Systemic/state risk

This dimension captures deterministic exposure to state and counterparty risk that is distinct from market risk — the category of risk covered by historical precedent such as deposit bail-ins, capital controls, and extraordinary wealth taxes, rather than price movement. It is calculated, not modeled qualitatively, since the underlying inputs (bank, instrument structure, jurisdiction) are known facts, not judgment calls.

At minimum, track:

Deposit concentration per institution — cash/bank positions require a bank/institution field (extending §7's Asset class model) so exposure can be checked against the relevant deposit-guarantee limit per institution, rather than only against total portfolio cash weight.
Instrument custody structure — for commodity exposure specifically, distinguish physically-allocated holdings from unsecured/issuer-backed structures (e.g. a gold-tracking bearer bond carries issuer counterparty risk that direct allocated bullion does not, even though both are reported under "commodity exposure" in §15). This is a custody_type field on the holding, not a new asset class.
Wealth-tax exposure — a deterministic estimate of applicable wealth tax (jurisdiction-specific, e.g. Norwegian formuesskatt with its bunnfradrag/sats/skjermingsfradrag rules) computed from the portfolio snapshot and reporting currency already tracked in §7/§20. This is arithmetic on known inputs, consistent with §2.2, and gives a concrete number rather than a vague "tax risk" flag.
Jurisdictional concentration — how much of the portfolio sits under a single legal/regulatory regime (custodian country, currency regime), independent of the geopolitical-exposure factor already tracked at the holding level in §13.

This dimension should be optional/skippable per holding when the underlying facts aren't yet modeled (e.g. custody_type not populated) rather than blocking the rest of the risk profile — consistent with §21's "fail visibly rather than silently invent."

16. Thesis Ledger

The portfolio should maintain a first-class investment thesis for each meaningful holding.

Suggested model:

text
investment_theses
├── thesis
├── bull_case
├── bear_case
├── key_assumptions
├── invalidation_conditions
├── confidence
├── status
├── created_at
└── updated_at

The system should be able to answer:

Why do I own this? What must remain true? What would make me reconsider? Has new evidence strengthened or weakened the thesis?

This creates a historical thesis ledger, rather than a collection of disconnected AI memos.

17. Valuation & Scenario Engine

Valuation should become deterministic wherever practical.

Support:

base case
bull case
bear case

with explicit assumptions such as:

text
revenue_growth
margin
capex
tax
discount_rate
terminal_growth
commodity_price
fx
shares_outstanding

The application calculates valuation outputs.

The LLM critiques:

whether assumptions are reasonable
what evidence supports them
what could invalidate them
where uncertainty is highest

The system should never present an LLM-generated valuation as a precise fact.

18. Scenario Analysis

The portfolio should eventually support macro/stress scenarios such as:

recession
stagflation
disinflation
deflation
commodity shock
interest-rate shock
geopolitical escalation
liquidity crisis

Example:

text
Scenario: Inflation resurgence

Oil:             +15%
Rates:          +150bp
Gold:             +20%
Equities:        -15%
NOK:              modeled

Estimated portfolio impact:
...

Scenario calculations should be deterministic where inputs exist, with qualitative LLM interpretation layered on top.

19. Visualizations
Visualization	Purpose
Portfolio composition	Current allocation
Allocation drift	Historical weight changes
Factor profile	Business/financial/valuation/macro assessment
Portfolio risk heatmap	Risk dimensions at a glance
Macro dashboard	Rates, inflation, yield curves
Thesis timeline	How thesis/confidence changes
Valuation scenarios	Bear/base/bull valuation
Scenario impact	Estimated portfolio response
Evidence panel	Sources behind material conclusions
Analysis comparison	Why today's analysis differs from prior runs

A single composite risk gauge may exist, but should not dominate the interface.

20. Data Model

Core model:

text
holdings(
    id,
    ticker,
    name,
    asset_class,
    sector,
    trading_currency,
    institution_nullable,
    custody_type_nullable,
    created_at,
    updated_at
)

portfolio_snapshots(
    id,
    uploaded_at,
    source_file_id,
    reporting_currency,
    status
)

portfolio_positions(
    snapshot_id,
    holding_id,
    weight_pct,
    quantity,
    cost_basis,
    cost_basis_currency,
    notes
)

documents(
    id,
    holding_id,
    type,
    uploaded_at,
    storage_path,
    reporting_period,
    sha256,
    status
)

document_pages(
    id,
    document_id,
    page_number,
    extracted_text,
    extraction_quality
)

document_chunks(
    id,
    document_id,
    page_start,
    page_end,
    section,
    content,
    content_hash
)

financial_line_items(
    id,
    document_id,
    holding_id,
    metric,
    value,
    unit,
    currency,
    period,
    source_page,
    confidence
)

market_observations(
    id,
    holding_id,
    observed_at,
    price,
    currency,
    provider,
    data_status
)

fx_observations(
    id,
    from_currency,
    to_currency,
    rate,
    observed_at,
    provider
)

research_runs(
    id,
    type,
    started_at,
    completed_at,
    status,
    methodology_version
)

research_items(
    id,
    research_run_id,
    holding_id_nullable,
    source_url,
    source_name,
    published_at,
    retrieved_at,
    title,
    summary,
    source_type,
    relevance,
    content_hash
)

investment_theses(
    id,
    holding_id,
    thesis,
    bull_case,
    bear_case,
    key_assumptions_json,
    invalidation_conditions_json,
    confidence,
    status,
    created_at,
    updated_at
)

analysis_runs(
    id,
    portfolio_snapshot_id,
    started_at,
    completed_at,
    status,
    provider,
    model_name,
    prompt_version,
    scoring_version,
    extraction_schema_version,
    application_version,
    research_snapshot_id
)

holding_analyses(
    id,
    analysis_run_id,
    holding_id,
    structured_output_json,
    overall_score,
    confidence
)

factor_assessments(
    id,
    holding_analysis_id,
    factor,
    score,
    confidence,
    methodology,
    reasoning
)

evidence_references(
    id,
    analysis_id,
    source_type,
    source_id,
    page_start,
    page_end,
    section,
    relevance
)

valuation_cases(
    id,
    holding_id,
    analysis_run_id,
    case_type,
    assumptions_json,
    calculated_value,
    confidence
)

portfolio_risk_snapshots(
    id,
    analysis_run_id,
    concentration_json,
    correlation_json,
    exposure_json,
    scenario_json,
    systemic_state_risk_json,
    risk_band,
    composite_risk_score,
    narrative
)

calibration_checks(
    id,
    analysis_run_id,
    holding_id,
    checked_at,
    original_score,
    original_thesis_status,
    subsequent_price_change_pct,
    subsequent_fundamental_change_json,
    invalidation_triggered,
    retrospective_note
)

JSON is appropriate for genuinely flexible outputs, but important reusable facts and metrics should remain queryable relational data.

21. Data Quality & Validation

Every ingestion and analysis stage should expose quality state.

Source data

text
VALID
PARTIAL
STALE
FAILED
UNVERIFIED

Analysis

text
QUEUED
RUNNING
COMPLETED
PARTIAL
FAILED

Quality checks

Examples:

percentage sanity checks
currency consistency
missing required fields
negative/positive sign validation
date-period validation
duplicate document detection
unexpected unit detection
market-price freshness
extraction quality

The system should fail visibly rather than silently inventing or filling data.

22. Testing Strategy

Testing is part of the architecture, not an afterthought.

22.1 Unit tests

Test:

financial calculations
FX conversion
portfolio weighting
scoring
scenario calculations
validation
22.2 Golden document tests

Maintain known source documents with expected extraction results.

Example:

text
Revenue = expected value
EBITDA = expected value
Debt = expected value

This protects against extraction-library or parser changes.

22.3 Prompt/model regression tests

For a fixed AnalysisContext, compare new model/prompt versions against the previous version for:

required fields
scores
confidence
evidence references
thesis status
hallucination/error indicators
22.4 Integration tests

Validate:

text
upload → extraction → validation → evidence → analysis → persistence
22.5 Track record & calibration

A decision-support system that never checks whether its own past assessments were useful has no way to earn or lose trust over time, and no way for the user to know when to weight it more or less heavily. This is distinct from the prompt/model regression tests in §22.3, which check consistency between versions — this checks accuracy against reality.

For each past analysis run, periodically (e.g. quarterly) record:

text
calibration_checks
├── analysis_run_id
├── holding_id
├── original_score / thesis_status / decision_considerations
├── subsequent_price_change
├── subsequent_fundamental_change (if new documents ingested)
├── did_invalidation_trigger_fire
└── retrospective_note

This is a deterministic comparison (price/fundamentals now vs. score then), not a new LLM judgment call, so it fits the same evidence-first principle as the rest of the system. Over time it answers: was high confidence actually associated with better outcomes, or is the system systematically over- or under-confident in particular factors (e.g. consistently too optimistic on valuation, too cautious on macro)? This should surface as a simple dashboard view, not feed back automatically into scoring — calibration informs the user's trust in the tool, it does not silently retrain it.

23. Observability & Cost Tracking

Each AI analysis should log:

text
analysis_id
holding_id
provider
model
prompt_version
input_tokens
output_tokens
latency
estimated_cost
status
error

This makes the near-zero-cost objective measurable.

Do not log sensitive secrets or raw credentials.

24. Security & Data Handling

Initial scope is single-user, but the application should still:

keep API keys server-side
store secrets only in environment/configuration management
validate uploads
restrict file access
avoid exposing raw source files through public URLs
authenticate application access
avoid logging sensitive portfolio data unnecessarily
maintain database backups where practical
25. Non-Goals

The initial system will not:

execute trades
provide automated financial advice
operate as a real-time trading engine
perform high-frequency analysis
attempt short-term price prediction as a core function
replace audited financial statements
automatically alter the user's investment thesis without explicit user action
operate as a multi-user SaaS platform
train a proprietary ML model
treat LLM output as authoritative financial truth
26. Build Phasing

Phase 0 — Foundation

repository structure
configuration management
database migrations
logging
testing framework
versioning conventions
provider interfaces
environment setup

Phase 1 — Portfolio + document ingestion

portfolio CSV/XLSX upload
portfolio snapshots
PDF/PPT/XLSX ingestion
validation
hashing/deduplication
provenance
object storage
structured financial facts

No AI dependency yet.

Phase 2 — Deterministic financial & market data

market-data provider abstraction
current/historical prices
FX
deterministic financial metrics
portfolio calculations
P&L
concentration/exposure calculations

Phase 3 — AI analysis

evidence packet / AnalysisContext
extraction assistance
Buffett/Munger reasoning
structured LLM output
evidence references
confidence
analysis runs
memo generation

Phase 4 — External research

central-bank data
macro research
sector research
source-level research storage
scheduled refresh
caching

Phase 5 — Thesis & portfolio intelligence

thesis ledger
invalidation tracking
valuation cases
scenario analysis
portfolio synthesis
risk profiles

Phase 6 — Visualization

dashboard
allocation history
factor views
risk heatmaps
macro dashboard
thesis timeline
valuation/scenario visualization
historical analysis comparison

Each phase should leave the application in a usable state.

27. Definition of Done

Holding analysis

A holding analysis is complete when:

 Current portfolio position loaded
 Latest relevant source documents identified
 Documents successfully extracted
 Financial facts validated
 Current market price available or explicitly marked unavailable
 FX context available where required
 Macro context available
 Sector research available
 User thesis loaded
 Evidence packet constructed
 AI analysis generated (blind pass, then reconciliation pass)
 Structured output passes schema validation
 Material claims have evidence references
 Factor scores have confidence values
 Thesis divergence between blind assessment and user thesis recorded
 Analysis run persisted
 Memo rendered successfully

Portfolio analysis

Additionally:

 Portfolio snapshot identified
 Position weights validated
 Concentration calculated
 Correlation/exposure analysis calculated or clearly marked unavailable
 Scenario assumptions identified
 Systemic/state risk (deposit concentration, custody type, wealth-tax exposure) calculated or explicitly marked unavailable
 Portfolio risk profile generated
 Portfolio-level synthesis references underlying holding analyses
28. Operational Rules
Never silently overwrite historical analysis.
Never silently replace source data.
Never delete evidence required to reproduce a historical conclusion unless explicitly intended.
Never use an LLM to calculate a metric that application code can calculate reliably.
Never present missing data as zero.
Never present an estimate as a reported fact.
Never treat a score as more reliable than its evidence and confidence indicate.
Never allow provider-specific implementation details to leak into core domain logic.
Never make a historical analysis depend on today's prompt/model/configuration.
Prefer explicit failure over plausible-looking but unsupported output.
29. Open Design Questions

These are implementation decisions, not reasons to block the architecture.

Portfolio format — Finalize the canonical CSV/XLSX schema and determine which fields are mandatory.

Market-data provider — Select the initial provider and implement it behind MarketDataProvider. The rest of the application must remain provider-independent.

Persona/scoring configuration — Use versioned YAML/config files for factor definitions, weights, scoring methodology, and persona prompts.

Multi-currency — Initial reporting currency: NOK. At minimum distinguish trading currency, reporting currency, and FX conversion rate. Economic exposure can be added progressively.

Authentication — Start with simple single-user authentication. Do not design multi-tenancy until there is a real requirement.

Research provider — Start with the lowest-cost reliable source combination and preserve the ResearchProvider abstraction for future replacement.

30. Recommended Repository Structure
text
portfolio-analyzer/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── services/
│   │   │   ├── portfolio/
│   │   │   ├── documents/
│   │   │   ├── market_data/
│   │   │   ├── research/
│   │   │   ├── analysis/
│   │   │   └── valuation/
│   │   ├── domain/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── providers/
│   │   └── config/
│   └── tests/
│       ├── unit/
│       ├── integration/
│       ├── golden_documents/
│       └── regression/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── charts/
│   │   ├── services/
│   │   └── types/
├── prompts/
│   ├── persona/
│   ├── extraction/
│   └── synthesis/
├── scoring/
│   └── versions/
├── schemas/
│   └── versions/
├── docs/
│   ├── architecture.md
│   ├── deployment.md
│   └── decisions/
├── docker/
└── README.md
31. Architectural Decision Summary

The project should be built around these core decisions:

PostgreSQL is the system of record.
Original documents are retained in object storage.
Evidence/provenance is first-class data.
Deterministic calculations are preferred over LLM arithmetic.
LLMs provide interpretation and qualitative judgment.
Analysis runs are immutable historical records.
Prompts, models, schemas, scoring, and research methodologies are versioned.
Market data, research, LLMs, and storage are provider abstractions.
Confidence and uncertainty are mandatory parts of qualitative analysis.
Business quality, valuation, and portfolio risk remain separate dimensions.
Investment theses and invalidation conditions are persistent portfolio data.
Scenario analysis is layered over deterministic portfolio calculations.
The system is decision support, never an automated trading system.
The architecture should favor explainability and reproducibility over apparent sophistication.
Systemic/state risk (deposit concentration, custody structure, wealth-tax exposure) is tracked as a deterministic risk dimension alongside market risk, not folded into it.
LLM analysis runs blind to the user's existing thesis/notes first, then reconciles against them, so the system stress-tests convictions rather than only validating them.
Factor weights are regime-conditional, versioned configuration, not fixed constants.
Past analysis runs are periodically checked against subsequent outcomes so the system's own track record is visible over time.
32. Final Architectural Principle

The application should be an evidence system first and an AI system second.

The goal is not to build a system that produces impressive investment opinions.

The goal is to build a system that can reliably answer:

What do we know?
Where did we get it from?
What did we calculate?
What is interpretation rather than fact?
What changed since the previous analysis?
How confident are we?
What would invalidate the thesis?
How does this affect the portfolio?
Why did the system reach this conclusion?

If those questions can be answered, the application remains useful even as models, data providers, prompts, and investment views evolve.