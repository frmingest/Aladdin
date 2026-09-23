# Dashboard, System status, Watchlist, Decision journal — 2026-09-23

Four visible features, plus backend fixes found while building them. This closes Sprint 5 and
delivers F4 (status page part), F6 and F7.

**Status:** committed locally (`bc4de0c`, `4abaf3d`, `ebe4a49`, `bc28502`), **not pushed, not
deployed**. Railway runs `alembic upgrade head` on startup, so the two new tables are created on the
next deploy.

---

## 1. What you'll see

| Page | Where | What it shows |
|---|---|---|
| **Dashboard** | `/` (new home; Holdings moved to `/holdings`) | Value, holdings/accounts, top-5 share and HHI, analysis coverage; a rule-based executive summary; allocation by sector, instrument, currency and account; value-weighted verdict and moat roll-up; positions table |
| **System status** | `/status`, via the "backend ok" badge at the bottom of the nav | Provider settings (keys only as *set*/*missing*), DB migration vs. code, Gemini calls left today, data freshness, failed or stuck analysis runs, a "needs attention" list |
| **Watchlist** | `/watchlist`, plus **☆ Watch** on every holding page | Companies you follow, a buy-below price, the distance to it, DCF base and margin of safety, verdict; a banner when a company is at or below your price |
| **Decision journal** | `/journal`, plus a section on every holding page | Why you acted, what would prove you wrong, confidence; the return since then, whether the move favours the decision, prompts for the 6- and 12-month reviews |

---

## 2. Design decisions

| Decision | Why |
|---|---|
| Dashboard and journal read the **database only** | Instant page loads; never spends LLM quota or waits on Yahoo |
| Executive summary is **fixed rules with named thresholds** (largest position > 20%, sector > 35%, coverage < 50%, analysis > 180 days, snapshot > 31 days) | CLAUDE.md Rule 1: no LLM text on the dashboard. The thresholds are constants in `portfolio_overview.py` |
| A watchlist entry **is a Holding row** | Valuation, research, EDGAR/Newsweb and the analysis all work for watched companies with no new code. Ownership still comes only from portfolio positions |
| Watchlist falls back to the **cached quote** when there's no DCF | A newly watched company rarely has financials, but the buy-below check only needs a price |
| Prices in different currencies are **never compared** | Shown as "Currency differs" instead of a wrong number |
| Deleting a holding **removes its watchlist entry** but **keeps its journal entries** (unlinked) | The journal is your own record and should outlive the data |
| Journal outcome colour follows **the decision**, not the sign | A fall after a sell or pass is shown green |
| System status makes **no network call** | Opening it can't spend quota; it reports configuration, not a live probe |

---

## 3. Backend changes

| Area | Change |
|---|---|
| New endpoints | `GET /portfolio/overview` · `GET /system/status` · `GET/POST/PATCH/DELETE /watchlist` (+ `GET /watchlist/holdings/{id}`) · `GET/POST/PATCH/DELETE /journal` |
| New tables | `watchlist_items` (migration `c4d5e6f7a8b9`), `decision_journal_entries` (`d5e6f7a8b9c0`). Additive only; up/down/up checked on Postgres 16 |
| Destructive safety | Watchlist and journal deletes need `confirm=true` |
| Shared helper | `app/services/analysis/latest.py`: the latest run *with a verdict* per holding |

### Fixes found along the way

| Bug | Effect before | Fix |
|---|---|---|
| Board took the newest run of any status | One failed retry made a holding show "Not analyzed" on Margin of safety | Uses the latest run that has a verdict |
| Provider "unavailable" errors were unhandled | Missing `GOOGLE_AI_STUDIO_API_KEY` showed "Internal Server Error" on the research panel | App-wide handler: **503 with the reason** |
| yfinance `fast_info` raises `KeyError` when Yahoo is unreachable | The watchlist returned 500 instead of "no price" | `_get` treats it as missing |

---

## 4. Verification

| Check | Result |
|---|---|
| Backend tests | 557 passed (41 new) |
| Frontend | `tsc -b`, `eslint`, `vite build` clean |
| Migrations | upgrade → downgrade → upgrade on Postgres 16 |
| Postgres smoke test | Create holding → watch → journal → delete holding (FKs enforced): entry kept with `holding_id = NULL`; cascade delete also works |
| UI | Every page rendered and clicked through (journal entry form, watchlist add and inline edit) against a local SQLite demo DB with **made-up data**. Not checked against Railway or real data |

---

## 5. Known gaps (not built)

| Gap | Note |
|---|---|
| Valuation panel and margin-of-safety board show no price for a holding without a DCF | Pre-existing: `compute_holding_valuation` stops before fetching the price. The watchlist works around it; the other two don't yet |
| Gemini "calls left today" is per server process | Resets on restart, same as before. The LLM usage ledger (with F5) fixes it |
| Post-deploy Playwright smoke test (other half of F4) | Still Sprint 7 |
| Journal returns use only prices the app has stored | Prices are stored whenever a valuation, board or watchlist view refreshes. A holding nobody opened has no price history |
