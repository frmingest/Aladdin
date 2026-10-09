# What the local LLM (Ollama) reads and writes

**Date:** 2026-10-09 · **Status:** read from the code on `main` (`53bf98a`); **not checked against a real run**. Companion to
[llm-and-technology-overview.md](llm-and-technology-overview.md) (all LLM uses) and [AI-VS-DETERMINISTIC.md](AI-VS-DETERMINISTIC.md)
(per screen output). Sizes and trimming: [evidence-packet-token-budget-2026-10-02.md](evidence-packet-token-budget-2026-10-02.md).
GPU/model fit: [ollama-adaptive-fit-2026-09-30.md](ollama-adaptive-fit-2026-09-30.md).

## 1. In one paragraph

When you run an analysis locally, code first builds an **evidence packet** for one holding: a list of numbered text items
(`EV-001`, `EV-002`, …) holding numbers that code already computed, short research summaries, announcements and excerpts from
your uploaded filings. Ollama receives that list twice, in two separate calls, and returns a **structured JSON judgement** in
which every claim cites an evidence ID. It calculates nothing, browses nothing and takes no action.

## 2. The two calls

| Call | What Ollama is sent | What it returns |
|---|---|---|
| **Blind pass** (`services/analysis/blind_pass.py`) | The system prompt for the holding type, plus "Evidence list for this holding:" and the packet. **No notes, no position, no thesis.** | Judgement JSON (moat, capital efficiency, financial fortress, macro stress test, valuation synthesis, verdict) |
| **Reconciliation pass** (`reconciliation_pass.py`) | The blind output, the same packet, and **your notes/thesis** (cut at 2,000 tokens, with a visible marker) | Final verdict, whether it changed from the blind pass, and why |

Both are one request each, run one at a time on the GPU (`OLLAMA_NUM_PARALLEL=1`), per holding, serially through the worker queue.
Which model runs: `qwen3:14b` if the call fits fully on the GPU, otherwise `qwen3:8b`; the run record shows which.

## 3. What is in the packet, by holding type

The packet is built by code from data already in the database plus cached research. The category names below are the real ones in code.

### Equity (stocks) — `services/analysis/evidence_packet.py`, schema `v1`, prompts `blind_v2` / `reconciliation_v2`

| Category | Content | Made by |
|---|---|---|
| `holding` | Name, ticker, sector, trading currency | Database |
| `financial_history` | Up to 5 recent years (`history_years=5`): ROE, ROIC, ROCE, gross/operating/net margin, Net Debt/EBITDA, Net Debt/FCF, interest coverage, Debt/Equity and similar series, each with averages and the hurdle comparison (MEETS/BELOW). Items say "not computable" or "not meaningful" rather than guess (for example ROE for financials). | **Code** (`metrics.py`) |
| `financial_sources` | Which SEC EDGAR filings or ESEF import the figures came from | Database |
| `valuation` | DCF range and current market multiples (EV, P/E, P/B, P/S, EV/EBITDA, FCF yield) | **Code** (`services/valuation/`) |
| `macro_research`, `sector_research`, `company_research` | Web research summaries with source URLs, cached 24 h. Sector research is skipped if the holding has no sector. | **Gemini + Google Search** (never Ollama) |
| `macro_indicator` | Stored macro series (Norges Bank, SSB, FRED, incl. the derived Norway curve) | Code / data providers |
| `document_excerpt` | Up to 8-12 short passages (max 1,600 characters each) from your **newest 4** processed documents, about 4,000 tokens in total, chosen by keyword scoring on five topics (moat, capital allocation, risks, outlook, management); boilerplate, auditor text and number-heavy tables are skipped; evidence-ID-like strings in the text are neutralised | **Code** (`document_excerpts.py`, no LLM, no embeddings) |
| `regulatory_announcements` | Up to 15 latest Oslo Børs (Newsweb) announcements, title and summary; Oslo-listed holdings only | Newsweb provider |

### Funds and ETFs — `services/funds/evidence.py`, schema `fund_v1`, prompts `blind_fund_v1` / `reconciliation_fund_v1`
`fund_identity`, `fund_profile` (structure, mandate, the fund's own stated objective), `fund_cost` (ongoing charge and the computed
fee drag), `fund_track_record` (reported returns vs benchmark, differences computed), `fund_holdings`, `fund_look_through`,
`fund_overlap` (your position value in NOK and overlap with stocks you own directly), `fund_exposure`, `fund_concentration`, plus the shared
macro/sector research and indicators. Where nothing is entered the item says so ("unknown"), it is not filled in.

### Bond funds, money-market funds, commodity ETCs — `services/instruments/evidence.py`, schemas `income_v1` / `commodity_v1`
`fund_identity`, `instrument_facts` (figures **you typed in**, each citing a document; missing ones are listed as "not entered"),
`income_metrics` (yield comparison, rate sensitivity, credit quality as typed) or `commodity_metrics` (carry hurdle, premium/discount to
the metal), and `fund_overlap` (your position value in NOK and portfolio weight). Prompts: `blind_income_v1`, `blind_commodity_v1` and the matching reconciliation prompts.

## 4. What Ollama never gets

| Not sent | Why |
|---|---|
| Your notes in the blind pass | Rule 4, confirmation bias |
| Whole documents, PDF pages as figures, table rows | Rule 1: figures reach the model only after code has extracted and computed them |
| Cost basis, quantity, total portfolio value | Not in any packet type I read. **Exception, checked in code:** the fund packet's `fund_overlap` item states your **position value in NOK** and the overlap with stocks you own directly, and the bond/money-market/commodity packet states your position value in NOK and its **share of the portfolio**. Equity packets contain no position data. This also reaches Gemini or Mistral if one of those runs the pass |
| API keys, account names | Never in prompts |
| Anything from the internet at run time | Research is fetched earlier by Gemini, cached, and put in the packet as text |

## 5. Size rules (why a packet can be trimmed)

Every packet is passed through `packet_budget.py` before any prompt is built: per-category caps, a total budget of 18,000 estimated
tokens (lower for the local model), trim order announcements, macro, sector, company research, excerpts, macro indicators, fund lists.
**Never trimmed:** holding identity, financial history, valuation, financial sources, fund facts. The run stores what was kept or dropped
(`evidence_packet_json.token_budget`) and adds an `evidence trimmed …` line to the run's notes.

## 6. How to see exactly what one run read

Each run stores its packet (`evidence_packet_json`: `items` with id, category, label, content and citation, plus `unavailable_reasons`
and `token_budget`). The text sent to the model is those items rendered as `[EV-001] (category) label` followed by the content and
citation. The prompts are the files under `backend/prompts/analysis/`. A page that shows this per run does not exist; not checked whether
the Analysis page exposes the raw packet.

## 7. Not checked

- No real run, packet or database was read for this doc, only code and docs. Real packet sizes per holding are unknown.
- Exact metric list in `financial_history` beyond the series named above (read from code labels, not run).
- Whether other local worker jobs (tripwires, snapshots, game state) call Ollama: nothing in them was read; the analysis passes are the
  only Ollama use found in `services/analysis/`.
