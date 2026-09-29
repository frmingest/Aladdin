# Fund look-through valuation via the Xtrackers feed (F30) — 2026-09-29

**Status:** written and tested on branch `feature/fund-look-through` (built on `main` incl. the merged valuation guardrails). Not merged, not deployed, **not run against the live Yahoo/DWS from the build sandbox** (see "Verified vs not"). One additive migration: `m1e3f4a5b6c7`.

## Problem
The Margin-of-safety board showed nothing rankable for the three funds/ETFs: a fund has no financial statements, so the owner-earnings DCF cannot run. The look-through data (what the fund owns) had to be uploaded by hand.

## Part 1 — capture the holdings (free, no key)
`POST /funds/{id}/holdings/fetch-xtrackers {isin}` calls DWS's public feed `https://etf.dws.com/api/pdp/en-lu/etf/{ISIN}/holdings`, converts it to a provider-style CSV, stores it as a real `fund_holdings` document and imports it through the **same** importer as an upload (so provenance, dedup, sector/country splits and auto-linking to companies in the app all work unchanged).
- Confirmed live 2026-09-29 through the built-in browser: **ISIN alone is enough** (slug ignored); the JSON holds **all 41 constituents** of XDEF (not the 15 the page shows); `en-lu` answers, `en-de` returns 204.
- Columns are read by header text, cash lines (`Asset class = Cash`) are dropped, the as-of date comes from the "Source: DWS 28.09.2026" disclaimer.
- Fixture `tests/fixtures/xtrackers_holdings_xdef.json` is a trimmed copy of the real response.

## Part 2 — value the basket (deterministic, no LLM)
1. `POST /funds/{id}/look-through/refresh` fetches each constituent's **trailing P/E** by ISIN (yfinance) and stores it (new table `fund_constituent_multiples`; unpriced lines are kept with a reason).
2. **Fund earnings yield** = Σ(weight × 1/PE) ÷ Σ(weight) over constituents with a positive P/E (aggregate earnings ÷ aggregate price).
3. **Fair P/E** = (1+g)/(r−g) with r = the same CAPM cost of equity the DCF uses (floor 8%) and g = terminal growth 2.5%; bear/bull shift g by ∓/±3 pts (the DCF's offsets).
4. **Fair value per unit** = price × fair P/E × fund earnings yield → bear/base/bull, margin of safety `(value−price)/value`.
5. Guards: **coverage < 60% of the equity weight ⇒ "unavailable"** (never extrapolated); base value > 3× or < ⅓ of the price ⇒ **withheld as implausible**; P/Es older than 14 days are flagged.

It plugs into `compute_holding_valuation`, so the board, the valuation endpoint and the watchlist pick it up; the board row is tagged "look-through".

## What it is and is not
A **screen, not a DCF**: it credits no growth above terminal growth, so a basket of fast growers (defence today) reads expensive by construction. That is stated on the card (`method_note`). It answers "what am I paying per krone of the holdings' current earnings vs what that earnings stream is worth at my required return".

## UI
Fund page → **Look-through valuation** card: ISIN box + *Fetch holdings from Xtrackers*, *Refresh look-through* (one call per holding, so a button — never on page load), bear/base/bull, fund P/E, coverage, notes. Margin of safety board: "look-through" tag on fund rows.

## Verified vs not
| Verified | Not verified |
|---|---|
| Feed shape and 41 rows (real browser capture) | yfinance ISIN→ticker→`trailingPE` for ~40 European constituents (sandbox cannot reach Yahoo; tests mock `yfinance.Ticker`) — first real check is *Refresh look-through* on your machine |
| Maths against hand-worked numbers; 1090 backend tests pass (same 2 pre-existing failures as `main`); ruff clean | Whether Railway's IP is blocked by Yahoo for this (the worker's home IP would not be) |
| Migration up/down/up on Postgres 16 | Coverage on real data — if Yahoo resolves < 60% of the weight the fund stays "unavailable" with the reason shown |
| Frontend tsc/eslint/vitest 22/22/build clean | |

## Not built
- L&G Gold Mining (no free feed; geo-gated T&Cs page) and Xetra-Gold (single-commodity, nothing to look through) — still manual upload / not applicable.
- Constituent fundamentals beyond trailing P/E (ROIC, growth, per-holding DCF).
- ISIN is typed on each fetch (holdings have no ISIN field yet).
- Refresh runs from the API server; a worker-side refresh (home IP) is a follow-up if Yahoo blocks Railway.

## For Faiz
After merge + deploy: open XDEF → Look-through valuation → ISIN `LU3061478973` → *Fetch holdings from Xtrackers* → *Refresh look-through* → then Margin of safety.
