# What is AI-generated and what is not

One place to answer: **"Is this thing on screen from an LLM, from plain code, or from me?"**

*Written 2026-10-01 against the code on `feature/game-mode-g7b-advisors`. It complements
[llm-and-technology-overview.md](llm-and-technology-overview.md), which is organised by LLM call
(provider, local vs API, prompts, quotas). This doc is organised by **output**: each thing you see,
and where it comes from. Update it when an output starts or stops using an LLM.*

---

## 1. The short version

| Source | What it produces | Marker to look for |
|---|---|---|
| **Plain code (no AI)** | Every number: prices, FX, ratios, DCF, price targets, margin of safety, risk, stress, correlation, tripwires, journal outcomes, performance, game mode | `CLAUDE.md` Rule 1 |
| **LLM** (Gemini, Ollama or Mistral) | Only **text and judgement**: research summaries, moat rating, the narrative sections and the Buy/Hold/Sell verdict | Evidence IDs (`EV-###`) cited on every claim |
| **You** | Positions (Nordnet CSV), cash, notes, journal entries, tripwires, uploaded filings | Your notes reach the LLM **only** in the reconciliation pass |

**Local vs API.** Only the blind and reconciliation analysis passes can run locally (Ollama on
your PC). Research always uses the Gemini API (it needs live web search). Everything else is plain
code and runs wherever the app runs.

---

## 2. Every output, by source

### 2a. LLM-generated (text and judgement)

| Output (where you see it) | What the LLM produced | Provider | Local possible? | Code |
|---|---|---|---|---|
| **Macro, sector and company research** (Macro/Sector pages, research items in an analysis) | Web-search summaries, each with source URLs, cached 24 h | Gemini + Google Search (Tavily fallback) | No, always API | `providers/gemini_research_provider.py`, `services/research/` |
| **Moat rating** (Wide / Narrow / None) and per-source moat reasoning | Blind pass | Gemini, Ollama or Mistral | Yes | `services/analysis/blind_pass.py`, `domain/analysis_schema/v1.py` |
| **Capital efficiency, financial fortress, macro stress test, valuation synthesis** (the four text sections) | Blind pass. Narrative over numbers it was handed; it does not compute them | same | Yes | same |
| **Verdict** (Strong Buy to Avoid), thesis bullets, top risks, metrics to monitor, invalidation triggers | Blind pass, then reconciliation pass | same | Yes | `blind_pass.py`, `reconciliation_pass.py` |
| **"Changed from blind?" and the reconciliation narrative** | Reconciliation pass, the only step that sees your notes | same | Yes | `reconciliation_pass.py` |
| **Fund / ETF analysis text** | Same two passes with the `fund_v1` schema | same | Yes | `services/funds/evidence.py`, `analysis_schema/fund_v1.py` |

Prompts: `backend/prompts/research/*_v1.md`, `backend/prompts/analysis/blind_v2.md`,
`reconciliation_v2.md`, `blind_fund_v1.md`, `reconciliation_fund_v1.md` (older versions kept so
old runs stay traceable).

### 2b. Code only (no LLM anywhere in the path)

| Output | How it is made | Code |
|---|---|---|
| Portfolio positions, weights, NOK values | Nordnet CSV parser, FX conversion | `services/portfolio_import/`, `services/portfolio_overview.py` |
| Figures from filings (revenue, margins, debt, cash flow) | Tagged ESEF/XBRL, SEC EDGAR, CSV/Excel. PDFs are **not** read for numbers | `services/documents/extraction/`, `services/filings/` |
| Ratios: margins, FCF, ROIC, ROE, multiples | `Decimal` arithmetic | `services/calculations.py`, `services/metrics.py`, `domain/financial_metrics.py` |
| DCF bear / base / bull, reverse DCF, margin of safety | CAPM cost of equity + owner earnings, versioned assumptions | `services/valuation/`, `domain/valuation_assumptions/` |
| **Price target range** on an analysis | Set from the DCF bear and bull values, never typed by the LLM. Left empty when the DCF is withheld as implausible | `services/analysis/pipeline.py` (`_attach_price_target`) |
| Fund look-through valuation | Constituent holdings (Xtrackers, LGIM) valued by code | `services/valuation/fund_look_through.py` |
| Prices, FX, beta, risk-free rate, macro series | yfinance, FRED, Norges Bank, SSB | `services/market_data/`, `services/macro/` |
| Macro **regime** (baseline / stagflation / crisis) | Rules over 3-month averages of stored macro series | `services/risk/regime.py` |
| Portfolio risk, correlation clusters, stress scenarios | Price history, DCF bear case or volatility shock | `services/risk/` |
| Thesis tripwires and the nightly check | Strict threshold crossing on computed metrics. The "make a tripwire" pre-fill is regex, not an LLM | `services/thesis/` |
| Decision journal outcomes, 6- and 12-month review due dates | Plain arithmetic on stored prices | `services/journal.py` |
| Portfolio performance, real return | Snapshots + prices | `services/performance/` |
| Gold and silver coin values | gold-api.com spot | `services/precious_metals/` |
| Document passages chosen for the analysis | Keyword scoring per topic, inside a token budget. **No embeddings, no LLM** | `services/analysis/document_excerpts.py` |
| Citation check (does each cited `EV-###` exist?) | Set lookup; unknown IDs become a warning on the run | `blind_pass.py`, `reconciliation_pass.py` |
| System readiness and status | Config and database checks. No LLM, market or research call | `services/analysis/readiness.py`, `services/system_status.py` |

### 2c. Game mode ("Fortress"): code only, but it re-presents one LLM output

| Element | Source |
|---|---|
| Wall material, tower size, vault, weather, shantytown, land signs, shared cracked walls | Code, from stored numbers (`services/game/rules.py`, `domain/game_mapping/v1.py`) |
| Temperament meter | Code, from journal, tripwires and snapshot changes (`services/game/temperament.py`) |
| Advisor lines (the Oracle, the Partner) | **Hand-written** text chosen by fixed rules (`domain/game_mapping/advisor_lines_v1.py`, `services/game/advisors.py`). No model writes them. Not quotations from Buffett or Munger |
| **Moat width** | Mapped by code from the **LLM's stored moat rating**. This is the one game element that is LLM judgement underneath |
| Ambience (rain, clock, sound) | Front-end only |

Game mode is read-only: it never changes an analysis, score or stored row, and it never calls an
LLM or a market provider (`services/game/state.py`).

---

## 3. What the LLM sees, and never sees

| Sent to the LLM | Never sent |
|---|---|
| Name, ticker, sector, trading currency | Position size, quantity, cost basis, portfolio value |
| Code-computed financial history, DCF range, macro snapshot | API keys, account names |
| Research items with URLs, recent Oslo Børs announcements | Your notes, **except** in the reconciliation pass |
| Short **passages** from your uploaded filings, chosen by keyword scoring, quoted as untrusted data | Whole documents, or table rows as figures |

The LLM is never asked to calculate a number, never follows instructions found inside documents or
search results, and never takes an action (no trades, transfers or emails).

---

## 4. How to tell on screen

- **Has `EV-###` citations and a model name on the run:** LLM text.
- **Has a figure with a source and a period (filing, FRED series, yfinance date):** code.
- **Says "low confidence", "unavailable" or shows fog:** code reporting a data gap. It does not guess.
- **A past run:** the stored run records provider, model, prompt version and schema version, so you can see which LLM wrote it and whether it ran locally.

## 5. Rules that keep the split honest

From `CLAUDE.md`: (1) code does all numbers, (2) every LLM claim cites evidence, (3) prompts,
schemas and assumptions are versioned files, (4) the blind pass never sees your notes, (5) text
from documents and searches is data, not instructions.
