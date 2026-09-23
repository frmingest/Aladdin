# Owner's-view metric definitions + plan for local LLM from Railway (2026-09-23)

Faiz reviewed the known issues and asked for:

- items 5–9 fixed using the recommended Buffett/Munger definitions;
- items 1, 3 and 4 closed;
- item 2 (Railway can't use the local LLM) planned as a sprint.

Status: **written and tested locally, committed locally (not pushed, not deployed).**

---

## 1. Known issues closed without code

| # | Issue | Outcome |
|---|---|---|
| 1 | Hand-made holdings tagged `equity` | ✅ Closed. The Holdings page has an Instrument Type dropdown, and new holdings are classified automatically (F2). |
| 3 | Sidebar not responsive | ✅ Closed as **out of scope**. Mobile is not a target for now. |
| 4 | Old positions with `NULL` price/value | ✅ Closed. Faiz deletes and re-uploads everything during testing, and that works. |

---

## 2. The definitions we now use (items 5–9)

The guiding question: **what cash does an ordinary shareholder actually own?** Anything that ranks
ahead of the owner, or leaves the company in cash, is taken off. It doesn't matter where IFRS lets the
company show it.

| # | Metric | Old definition | New definition | Why (Buffett/Munger) |
|---|---|---|---|---|
| 5 | Net debt | Borrowings − cash | Borrowings **+ hybrid capital** − cash (leases still excluded) | Hybrid holders get paid before the owner. Coupons are skipped only in distress. That's debt in practice. |
| 5 | Debt / equity | Debt ÷ total equity | (Debt + hybrid) ÷ **ordinary equity**. Shown as *n/m* when ordinary equity ≤ 0. | Total equity included capital that belongs to hybrid holders |
| 5 | ROE (evidence packet) | Net income ÷ total equity | Net income to ordinary holders ÷ **ordinary equity**. None when ≤ 0. | Same numerator and denominator owner |
| 6 | Free cash flow | CFO − capex | CFO − capex − decommissioning − **interest paid** − **lease payments** − **hybrid coupons**. Interest and leases are only deducted when the company classifies them in financing. | Under IFRS these cash costs can sit in financing, so CFO − capex overstates what's left for the owner |
| 7 | Decommissioning | Ignored | Deducted from FCF **and** owner earnings | Taking down old fields is a real and growing cash cost for an E&P company |
| — | Owner earnings (also used by the DCF) | NI + D&A − capex | NI + D&A − capex − decommissioning − lease payments. Adds a note when capex > 1.5× D&A (growth capex). | IFRS 16 puts rent into the D&A that gets added back. Interest and hybrid coupons are already inside net income. |
| 8 | EBIT / EBITDA | Included biological-asset fair-value gains | Excludes them (industry "operational EBIT/EBITDA") | A gain on fish that haven't been sold isn't earnings |
| 9 | Ratios with denominator ≤ 0 | Shown as a number (e.g. −27.2×) | Shown as **n/m** plus the reason, in the Computed column | A negative multiple can't be read either way |

### Result on the real files

| Metric | Vår Energi FY2025 (USD) before → now | Salmon Evolution FY2025 (NOK) before → now |
|---|---|---|
| EBITDA | 6,344.2m → 6,344.2m | −63.1m → **−78.7m** (= company) |
| EBIT (for interest coverage) | 4,184.7m | −143.3m → **−158.9m** (= company operational EBIT) |
| Free cash flow | 1,787.4m → **1,115.5m** | −1,323.5m → **−1,430.2m** |
| Owner earnings | 675.6m → **433.6m** | −1,355.8m → **−1,368.0m** + "capex is 15.8× D&A" note |
| Net debt | 5,242.0m → **6,041.5m** (incl. hybrid) | 1,716.4m (no hybrid) |
| Net debt / EBITDA | 0.83× → **0.95×** | −27.2× → **n/m** (EBITDA negative) |
| Net debt / FCF | 2.93× → **5.42×** | −1.30× → **n/m** |
| Interest coverage | 11.4× | −4.4× → **n/m** (EBIT negative) |
| Debt / equity | 10.61× → **n/m** (ordinary equity −239.5m) | 0.91× |

Vår's own "free cash flow" (1,671m) is before interest, leases and hybrid coupons. Ours (1,115.5m)
is what's left for the ordinary shareholder, and it's **less than the 1,170m of dividends Vår paid in
2025**. That is the kind of thing this app is meant to surface.

### Not changed (open)

- **Interest coverage** still uses P&L finance cost, or cash interest paid as a proxy when only net
  finance items are tagged. Interest that was capitalised into construction (Salmon: 36m) is not
  included.
- **Leases** are still left out of net debt, the same convention the companies use.
- **Operating margin** still uses the reported operating profit (Salmon includes the fair-value gain).
  Only EBIT and EBITDA are adjusted.

### What changed in code

| File | Change |
|---|---|
| `app/domain/financial_metrics.py` | 5 new canonical facts: `hybrid_capital`, `decommissioning_payments`, `interest_paid_financing`, `lease_payments_financing`, `hybrid_distributions` (all positive amounts) |
| `app/services/documents/extraction/ixbrl.py` | Extracts the 5 facts: standard IFRS tag first, otherwise company-extension cash-flow lines matched by name and summed (issue proceeds and repayments excluded). EBIT and EBITDA net of biological fair-value changes. |
| `app/services/metrics.py` | The new definitions above. Shared helpers `free_cash_flow_to_owners`, `owner_earnings_from_facts` and `ordinary_equity`. |
| `app/services/valuation/holding_valuation.py` | The DCF's owner earnings now use the shared helper, so the panel, the evidence packet and the DCF agree |
| `app/services/analysis/evidence_packet.py` | ROE on ordinary equity; label updated; **packet version v3** |
| `app/api/holdings.py` | Notes merged instead of overwritten; the hybrid warning says it's counted as debt |
| Frontend | *n/m* ratios shown in Computed with their reason; labels for the 5 new facts |
| Tests | 12 new (4 extraction, 8 metrics): 514 of 516 pass. The 2 `test_factory` failures are pre-existing and local only (`.env`). tsc, eslint and vite build are clean. |

**To see it:** deploy, then **delete and re-upload** both `.xhtml` files. The new facts are only
created when a file is extracted.

---

## 3. Plan: local LLM from Railway (item 2) → new F8, built together with F5

### Options considered

| Option | How | Verdict |
|---|---|---|
| A. Tunnel (Cloudflare Tunnel / Tailscale Funnel) to Ollama | Railway calls `https://…` → your PC's port 11434 | ❌ Exposes the GPU endpoint to the internet. A run blocks for up to 15 min. Fails whenever the PC sleeps. |
| B. Worker pulls jobs from a Railway API | The PC polls `GET /worker/jobs`, posts results back | ⚠️ Works, but needs a new authenticated API surface and a worker token |
| **C. Worker pulls jobs from the shared database** (recommended) | Railway only **queues** the run. A worker on the PC, using the same code and the same Supabase DB (the credentials are already in `backend/.env`), claims queued runs, runs them on Ollama and writes the result. | ✅ No inbound port, no tunnel, no new API. If the PC is off, the run waits. It's also the overnight queue (F5). |

### How it would work (option C)

```
Railway UI: "Run analysis" → engine: Local (your PC)
      │  inserts equity_analysis_runs row, status = QUEUED
      ▼
Supabase (shared DB) ◄──── worker on your PC polls every 30 s
                            claims 1 row (FOR UPDATE SKIP LOCKED) → RUNNING
                            builds evidence packet → Ollama blind + reconciliation
                            writes result → COMPLETED / FAILED
Railway UI polls the run → shows "queued – local worker online (seen 20 s ago)"
```

### Stories (Sprint 5B, before Sprint 6)

| # | Story | Detail |
|---|---|---|
| 1 | Queue columns | Migration: run status `QUEUED` / `RUNNING`, plus `engine` (`cloud` / `local`), `claimed_by`, `claimed_at`, `heartbeat_at`, `attempts`. New small `worker_heartbeats` table (worker id, model, last seen). |
| 2 | Queue from the UI | `POST /analysis/holdings/{id}/run?engine=local` returns 202 with a QUEUED run. Also **Queue all ready holdings** (F5). |
| 3 | Worker | `python -m app.worker` using the existing pipeline with `OllamaProvider`. Heartbeat every 30 s. A run is released after 30 min without a heartbeat, max 2 attempts. A Windows start-up script / Task Scheduler entry. |
| 4 | Status in UI | Queued/running badge on the holding and a queue list. Readiness gets a "Local worker online" check. Optional **Run in cloud instead** button for a run that's been waiting. |
| 5 | Safety | The worker only reads its inputs and writes to the analysis tables. Nothing on the PC listens for inbound connections, and Railway never gets the Ollama URL. |
| 6 | Tests + guide | Claim/lease/expiry tests and the fake LLM end-to-end. Update `local-llm-ollama-setup.md`. |

**Decision needed at sprint start:** should the research step (Gemini, internet) run on Railway
when the job is queued, or on the PC? Recommended: **on the PC**. Everything for one run then happens
in one place, with no half-finished state.
