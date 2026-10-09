# Aladdin: what we process, and with which technology

A simple overview of what information the app handles, **where an LLM is involved (API or local)**,
what everything else runs on, and why each technology was chosen.

*Written 2026-09-23; refreshed 2026-10-09 against `main` (`53bf98a`; adds the bond/money-market/commodity prompts, the packet token budget and the link to [ollama-what-it-reads-2026-10-09.md](ollama-what-it-reads-2026-10-09.md)). Update this doc whenever a provider,
prompt or data source changes. The structure of the app (services, deployment, jobs, diagrams) is in
[architecture.md](architecture.md). For a per-output view (which thing on screen is code, LLM or your input) see
[AI-VS-DETERMINISTIC.md](AI-VS-DETERMINISTIC.md).*

---

## 1. The big picture

```
 YOUR INPUTS                 DETERMINISTIC CODE (no AI)             LLM (AI)                 YOU SEE
 ─────────────               ──────────────────────────             ────────                 ───────
 Broker CSV        ──►  parse positions, FX, weights      ─┐
 ESEF .xhtml/CSV   ──►  read tagged figures, ratios        ├──►  Evidence  ──►  Blind pass ──►  Verdict,
 SEC EDGAR/Newsweb ──►  official filings & announcements   │     packet         (no notes)       moat,
 yfinance / FRED   ──►  prices, FX, beta, risk-free rate   │   (numbers +        │               risks,
                        DCF, margin of safety             ─┘    sources)          ▼               citations
                                                                            Reconciliation
 Your notes  ──────────────────────────────────────────────────────────────►   pass
 Company/sector/macro ──────────────────────────────►  Gemini + Google Search (research, cached 24h)
```

**Rule of thumb.** Code does every number. The LLM only researches and writes judgement, and every
claim it makes must cite an evidence ID.

---

## 2. Where an LLM is used

There are only **three** places.

| # | Feature (where in app) | What the LLM does | Provider & model | API or local | What it is sent | What comes back |
|---|---|---|---|---|---|---|
| 1 | **Research**: macro, sector and company (Macro / Sector pages, holding page, analysis runs) | Searches the web and summarises current developments | Google **Gemini** (`gemini-3.6-flash`) with **Google Search grounding**; optional **Tavily** fallback when Gemini's daily search budget is spent (`RESEARCH_FALLBACK_PROVIDER=tavily`) | **Always API** (needs live web search) | Company name, ticker, sector. For macro: the prompt only | Text split into research items, each with its source URL. Cached 24h. |
| 2 | **Blind analysis pass** (holding page → *Run analysis*) | Buffett/Munger judgement: moat, capital efficiency, financial fortress, macro stress test, valuation synthesis, verdict | Setting `LLM_PROVIDER`: **Gemini** (default) · **Ollama `qwen3:14b`** (falls back to `qwen3:8b` when the larger model would spill off the GPU) · **Mistral** (`mistral-small-latest`) | **API** (Gemini/Mistral) or **local** (Ollama on your GPU) | The evidence packet only. **Never your notes.** | Structured JSON (schema `v1`, or `fund_v1` for funds/ETFs), every section citing evidence IDs |
| 3 | **Reconciliation pass** (same run, straight after) | Weighs the blind verdict against your notes/thesis; says whether the verdict changed | Same provider as #2 | Same as #2 | Blind output + evidence packet + **your notes** | Final verdict + "changed from blind?" + explanation |

Prompts and schemas are versioned files: `prompts/research/*_v1.md`, `prompts/analysis/blind_v2.md` and
`reconciliation_v2.md` (the active equity version; `v1` is kept for old runs), `blind_fund_v1.md` and
`reconciliation_fund_v1.md` for funds, `blind_income_v1.md` / `reconciliation_income_v1.md` for bond and money-market funds,
`blind_commodity_v1.md` / `reconciliation_commodity_v1.md` for physical commodity ETCs (2026-10-07), and
`app/domain/analysis_schema/` (`v1.py`, `fund_v1.py`, `income_v1.py`, `commodity_v1.py`).

**Exactly what the analysis passes read, per holding type:** [ollama-what-it-reads-2026-10-09.md](ollama-what-it-reads-2026-10-09.md).
Packet size is capped by `services/analysis/packet_budget.py` (default 18,000 estimated tokens; see
[evidence-packet-token-budget-2026-10-02.md](evidence-packet-token-budget-2026-10-02.md)).

### When is it local, and when is it an API?

| Where you run the app | Research (#1) | Analysis passes (#2, #3) |
|---|---|---|
| Railway (`LLM_PROVIDER=google_ai_studio`) | Gemini API | Gemini API |
| Your PC (`LLM_PROVIDER=ollama`) | Gemini API | **Ollama, local GPU**. Nothing leaves the PC for these passes. |
| Either, with `LLM_FALLBACK_PROVIDER=mistral` | Gemini API | Switches to Mistral API when Gemini's daily quota is used up |
| Railway site, **Run on my PC** | Gemini API (or Tavily fallback) | The run is queued; the PC worker claims it and uses Ollama. Needs the worker running. |

Railway cannot reach Ollama on your PC, so analysis runs started from the Railway site always use an
API.

### What goes into the evidence packet (what the analysis LLM sees)

| Included | Not included |
|---|---|
| Holding name, ticker, sector, trading currency | Quantity, cost basis, total portfolio value |
| Financial history already **computed by code** (margins, FCF, ROE, debt ratios…) | Whole uploaded documents, or table rows as figures |
| Where the figures came from (e.g. SEC filing numbers) | Your notes (blind pass). They go **only** to the reconciliation pass. |
| DCF valuation range (computed by code) | API keys, account names |
| Research items with source URLs; latest Oslo Børs announcements | |
| **Funds, ETFs, bond/money-market funds, commodity ETCs only:** your position value in NOK, overlap with stocks you own directly, and (bond/commodity) its portfolio weight. Equity packets carry no position data | |
| Short **passages** from your uploaded filings, picked by keyword scoring within a token budget (quoted as untrusted data; `services/analysis/document_excerpts.py`) | |

---

## 3. What the LLM never does

| Never | Why |
|---|---|
| Calculates a number: margins, FCF, ROIC/ROE, FX, DCF, price target | LLMs make arithmetic mistakes and aren't reproducible. Every figure must be auditable (CLAUDE.md Rule 1). |
| Reads figures out of uploaded documents | Tried on 2026-09-23 for PDFs and **reverted**. Figures come only from tagged ESEF/XBRL, CSV/Excel and SEC data. |
| Sees your notes in the blind pass | Protects against confirmation bias (Rule 4) |
| Follows instructions found inside documents or search results | That text is framed as data to analyse, never as instructions (Rule 5) |
| Takes any action (trades, transfers, emails) | It only returns a record for you to read |

Cited evidence IDs are checked against the packet. An unknown ID is flagged as a warning on the run.

---

## 4. Everything else: non-LLM technology

| Area | Technology | What it does in Aladdin |
|---|---|---|
| Backend API | **Python, FastAPI, Pydantic** | REST API; validates every request and every LLM JSON reply against a schema |
| Database | **PostgreSQL on Supabase**, SQLAlchemy, Alembic | Holdings, positions, facts, research cache, analysis runs; versioned migrations |
| File storage | **Supabase Storage** (S3 API via boto3); local disk in dev | Stores the uploaded original files |
| Document parsing | **lxml** (ESEF inline XBRL), **PyMuPDF** (PDF text), openpyxl (Excel), python-pptx, own CSV parser | Turns uploads into tagged figures and page text, deterministically |
| LLM usage ledger | **`llm_usage_events` table** | Every LLM request is recorded; the Gemini daily budget is counted from it, so it survives restarts and is shared with the PC worker |
| Financial maths | **Own Python code** (`calculations.py`, `metrics.py`, `valuation/`), `Decimal` arithmetic | Ratios, owner earnings, DCF / reverse DCF, multiples, margin of safety, integrity checks |
| Market data | **yfinance** (Yahoo Finance) | Share prices, FX rates, beta, daily price history |
| Macro data | **Norges Bank, SSB, FRED** | Numeric series cited in every analysis, incl. a derived Norway 10Y-3M curve |
| Fund holdings | **DWS Xtrackers** JSON feed, **LGIM** public CSV | Full look-through baskets so funds can be valued |
| Precious metals | **gold-api.com** | Gold and silver spot for physical coins |
| Interest rates | **FRED** API | Risk-free rate for the DCF discount rate |
| Primary sources | **SEC EDGAR** XBRL company facts; **Oslo Børs Newsweb**; **filings.xbrl.org** | Official US financials; Oslo announcements and ESEF annual/half-year reports |
| Frontend | **React 18 + TypeScript**, Vite, Tailwind, Recharts, React Router | The web UI and charts |
| Hosting | **Railway** (Docker), GitHub Actions | Runs backend + frontend in the cloud; Railway deploys every merge to `main`; CI on every PR |
| Local AI runtime | **Ollama** on your RTX 3060 12GB | Runs `qwen3:14b` (or `qwen3:8b`) for the analysis passes, via the PC worker |

---

## 5. Why these technologies

| Choice | Why we chose it | Trade-off we accepted |
|---|---|---|
| **Code for all numbers, LLM only for judgement** | Numbers must be exact, repeatable and traceable when real money is involved | More code to write and test (about 1,450 backend tests) |
| **Gemini (Google AI Studio)** | Free tier; **Google Search grounding** gives real source URLs for every research claim; supports structured JSON output | Small daily quota (~20 calls/day), hence the budget guard and fallbacks |
| **Ollama + qwen3:14b (local)** | No quota, no cost per run, and analysis data stays on your PC. Fits a 12GB GPU. | Slower. Only works when the app runs on your PC. Research still needs Gemini. |
| **Mistral** | A second, independent vendor when Gemini's quota runs out | Another key and quota to manage |
| **ESEF `.xhtml` over PDF** | Every number is machine-tagged (concept, period, currency, scale), so there's no guessing from layout. Mandatory for Oslo-listed companies. | Notes are only block-tagged, so few note details are available as figures |
| **SEC EDGAR + Newsweb** | Official primary sources, free, no key | Newsweb is an undocumented endpoint and could change |
| **yfinance + FRED** | Free and good enough for prices, FX and rates | yfinance is unofficial and can break without notice |
| **FastAPI + Pydantic** | Python has the best finance and data libraries; Pydantic enforces the LLM output schema | — |
| **Postgres on Supabase** | Managed, free tier, includes file storage | Legacy pre-rebuild tables kept (emptied by the 2026-09-21 wipe, never queried) |
| **React + TypeScript + Vite** | Fast to build, type-safe, large ecosystem | — |
| **Railway** | Deploys straight from GitHub with little setup | Can't reach your local Ollama |
| **Versioned prompts and schemas** | Any past analysis can be traced to the exact prompt/schema that produced it | A change means a new version file, not an edit |
