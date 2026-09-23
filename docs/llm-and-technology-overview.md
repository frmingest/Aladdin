# Aladdin: what we process, and with which technology

A simple overview of what information the app handles, **where an LLM is involved (API or local)**,
what everything else runs on, and why each technology was chosen.

*Written 2026-09-23 from the code at `5e6c3eb`. Update this doc whenever a provider, prompt or data
source changes.*

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
| 1 | **Research**: macro, sector and company (Macro / Sector pages, holding page, analysis runs) | Searches the web and summarises current developments | Google **Gemini** (`gemini-3.6-flash`) with **Google Search grounding** | **Always API** (needs live web search) | Company name, ticker, sector. For macro: the prompt only | Text split into research items, each with its source URL. Cached 24h. |
| 2 | **Blind analysis pass** (holding page → *Run analysis*) | Buffett/Munger judgement: moat, capital efficiency, financial fortress, macro stress test, valuation synthesis, verdict | Setting `LLM_PROVIDER`: **Gemini** (default) · **Ollama `qwen3:14b`** · **Mistral** (`mistral-small`) | **API** (Gemini/Mistral) or **local** (Ollama on your GPU) | The evidence packet only. **Never your notes.** | Structured JSON (schema v1), every section citing evidence IDs |
| 3 | **Reconciliation pass** (same run, straight after) | Weighs the blind verdict against your notes/thesis; says whether the verdict changed | Same provider as #2 | Same as #2 | Blind output + evidence packet + **your notes** | Final verdict + "changed from blind?" + explanation |

Prompts and schemas are versioned files: `prompts/research/*_v1.md`, `prompts/analysis/blind_v1.md`,
`reconciliation_v1.md`, and `app/domain/analysis_schema/v1.py`.

### When is it local, and when is it an API?

| Where you run the app | Research (#1) | Analysis passes (#2, #3) |
|---|---|---|
| Railway (`LLM_PROVIDER=google_ai_studio`) | Gemini API | Gemini API |
| Your PC (`LLM_PROVIDER=ollama`) | Gemini API | **Ollama, local GPU**. Nothing leaves the PC for these passes. |
| Either, with `LLM_FALLBACK_PROVIDER=mistral` | Gemini API | Switches to Mistral API when Gemini's daily quota is used up |

Railway cannot reach Ollama on your PC, so analysis runs started from the Railway site always use an
API.

### What goes into the evidence packet (what the analysis LLM sees)

| Included | Not included |
|---|---|
| Holding name, ticker, sector, trading currency | Your position size, quantity, cost basis or portfolio value |
| Financial history already **computed by code** (margins, FCF, ROE, debt ratios…) | Raw text of your uploaded documents |
| Where the figures came from (e.g. SEC filing numbers) | Your notes (blind pass). They go **only** to the reconciliation pass. |
| DCF valuation range (computed by code) | API keys, account names |
| Research items with source URLs; latest Oslo Børs announcements | |

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
| Financial maths | **Own Python code** (`calculations.py`, `metrics.py`, `valuation/`), `Decimal` arithmetic | Ratios, owner earnings, DCF / reverse DCF, multiples, margin of safety, integrity checks |
| Market data | **yfinance** (Yahoo Finance) | Share prices, FX rates, beta |
| Interest rates | **FRED** API | Risk-free rate for the DCF discount rate |
| Primary sources | **SEC EDGAR** XBRL company facts; **Oslo Børs Newsweb** | Official US financials; Oslo regulated announcements |
| Frontend | **React 18 + TypeScript**, Vite, Tailwind, Recharts, React Router | The web UI and charts |
| Hosting | **Railway** (Docker), GitHub | Runs backend + frontend in the cloud |
| Local AI runtime | **Ollama** on your RTX 3060 12GB | Runs `qwen3:14b` for the analysis passes |

---

## 5. Why these technologies

| Choice | Why we chose it | Trade-off we accepted |
|---|---|---|
| **Code for all numbers, LLM only for judgement** | Numbers must be exact, repeatable and traceable when real money is involved | More code to write and test (500+ tests) |
| **Gemini (Google AI Studio)** | Free tier; **Google Search grounding** gives real source URLs for every research claim; supports structured JSON output | Small daily quota (~20 calls/day), hence the budget guard and fallbacks |
| **Ollama + qwen3:14b (local)** | No quota, no cost per run, and analysis data stays on your PC. Fits a 12GB GPU. | Slower. Only works when the app runs on your PC. Research still needs Gemini. |
| **Mistral** | A second, independent vendor when Gemini's quota runs out | Another key and quota to manage |
| **ESEF `.xhtml` over PDF** | Every number is machine-tagged (concept, period, currency, scale), so there's no guessing from layout. Mandatory for Oslo-listed companies. | Notes are only block-tagged, so few note details are available as figures |
| **SEC EDGAR + Newsweb** | Official primary sources, free, no key | Newsweb is an undocumented endpoint and could change |
| **yfinance + FRED** | Free and good enough for prices, FX and rates | yfinance is unofficial and can break without notice |
| **FastAPI + Pydantic** | Python has the best finance and data libraries; Pydantic enforces the LLM output schema | — |
| **Postgres on Supabase** | Managed, free tier, includes file storage; already held the data | Legacy tables kept alongside (not reset) |
| **React + TypeScript + Vite** | Fast to build, type-safe, large ecosystem | — |
| **Railway** | Deploys straight from GitHub with little setup | Can't reach your local Ollama |
| **Versioned prompts and schemas** | Any past analysis can be traced to the exact prompt/schema that produced it | A change means a new version file, not an edit |
