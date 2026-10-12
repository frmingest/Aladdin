# SB1NO.OL "incorrect data" investigation — 2026-09-29

**Trigger:** Faiz reported an incorrect price for SB1NO.OL on the Watchlist and asked whether it is one stock or a wider credibility problem.
**Status:** Research only — no code changed. Fix proposals in §4 need Faiz's go-ahead.

## 1. Verdict in one paragraph

**The share price is correct; the valuation next to it is not.** The Watchlist shows 229.50 NOK for SB1NO.OL, exactly Yahoo's price. What is wrong is the DCF: base value **3,953 NOK/share (94.2% "margin of safety")** for a stock that trades at 229.50, which then flowed into a **"Strong Buy"** verdict and a **"price target range 3,170–4,899 NOK"**. This is not one stock: it hits **every bank/financial with a DCF** (SPOG.OL shows 1,091 NOK vs a 74.45 price), and the same weaknesses would hit any company with a fast historical CAGR.

> Correction to my first reply today: I guessed SB1NO.OL was a retired ticker (renamed Sparebanken Norge). That was wrong. Yahoo still lists SB1NO.OL (SpareBank 1 Sør-Norge ASA); SBNOR.OL is a different bank.

## 2. Prices: all match Yahoo

Yahoo chart API (regularMarketPrice, 2026-09-28 14:25 UTC) vs the live Watchlist:

| Ticker | Yahoo | App | Match |
|---|---|---|---|
| ORK.OL | 92.85 | 92.85 | ✅ |
| PARB.OL | 54.80 | 54.80 | ✅ |
| KOG.OL | 311.50 | 311.50 | ✅ |
| SB1NO.OL | 229.50 | 229.50 | ✅ |
| SPOG.OL | 74.45 | 74.45 | ✅ |
| STB.OL | 194.70 | 194.70 | ✅ |

Minor: the holdings on the Margin-of-safety board use cached quotes (ETLX.DE 98.06 vs Yahoo 97.89 EUR, 0.2% off) — by design (24 h cache, stale served on GET, F25). Vår Energi is shown as 5.42 **USD** (its filings are in USD; the 51.60 NOK quote is converted) — correct but easy to misread.
Possible confusion source: the verdict timeline and thesis panel show **NOK 230.00** (the previous close captured at run time) next to the live 229.50.

## 3. What is actually wrong (root causes)

Reproduced: 10-year DCF, owner earnings 6,273m NOK, growth 31.5%, discount 6.72%, terminal 2.5%, 370.6m shares → ≈3,957 NOK (app: 3,953).

1. **Uncapped historical CAGR as forward growth (31.5% for 10 years).** `growth.py` returns raw CAGR over all periods on file; `dcf.py` compounds it for the full projection window. Owner earnings of 6,273m in FY2025 imply ~1,213m in FY2019. FY2021→FY2025 alone is ~20%/yr, and the step-up is consistent with the SR-Bank/Sørøst-Norge merger (announced Q4 2023 per the annual report excerpt in the app) — i.e. inorganic, not repeatable. *(Merger timing vs each fiscal year not verified.)*
2. **Owner-earnings DCF does not fit banks.** Owner earnings = net income + D&A − capex − leases treats all profit as distributable. A bank must retain capital for regulatory ratios, so only the excess is distributable. Even with **0% growth** the same maths gives ~411 NOK (1.8× the price) — the method overstates value before growth is applied.
3. **No plausibility guard.** A value 17× the price is accepted, shown as "margin of safety 94%", used for the price-target range, and fed to the LLM, whose "Strong Buy" verdict rests on it. Nothing says "this is not credible".
4. **Sector-blind metrics shown as findings.** Interest coverage 0.37× is listed as the #1 risk for a bank (interest expense is a bank's cost of goods). Gross margin, net debt, ROIC show "missing" for the same reason.
5. **Display bug:** Valuation panel shows "rf **428.6%**" — `risk_free_rate_pct` is already a percentage (4.286) and the UI formats it as a fraction. The discount rate itself (6.7%) is computed correctly.

## 4. Blast radius

| Area | Affected? |
|---|---|
| Live prices (Yahoo → app) | No — 6/6 watchlist tickers exact |
| DCF for banks/insurers | **Yes** — SB1NO.OL, SPOG.OL confirmed; PARB.OL, STB.OL will hit it once financials are loaded |
| DCF for any company with a very high historical CAGR (merger, recovery from a low base) | **Yes** (mechanism, not yet observed elsewhere) |
| LLM verdict / price target range | **Yes** — inherits the DCF |
| Other holdings on the board | No DCF yet (loss-making earliest year / funds), so nothing wrong is shown |

## 5. Proposed fixes (in priority order — not built)

1. **Plausibility guard (trust fix, smallest change):** when DCF base value is > ~3× (or < ~0.33×) price, or growth exceeds a cap, mark the valuation "not reliable", hide margin of safety, exclude it from the verdict/price-target and say why in the UI.
2. **Cap and fade growth:** clamp base growth (e.g. 10–15%) and fade to terminal growth over the window. Needs `valuation_assumptions/v2.py` — CLAUDE.md Rule 3 (never edit v1).
3. **Financials get a different method:** hide the owner-earnings DCF for banks/insurers and use justified P/B (ROE vs cost of equity) or a dividend-discount model; suppress interest coverage/net debt for them.
4. **Keep unreliable DCFs out of the evidence packet** so the LLM cannot cite a number the app itself distrusts.
5. **Fix the "rf 428.6%" label** (frontend `ValuationPanel.tsx`).
6. Optional: show a small "price as of" timestamp on the Watchlist price cell.

## 6. How this was checked (and limits)

- Prices: Yahoo's public chart JSON fetched in the built-in browser (the build shell cannot reach Yahoo; yfinance could not be run live there).
- App values: read from the live Watchlist and SB1NO.OL holding pages. I did not call the backend API directly.
- Math: re-run with the app's own parameters.
- Not checked: Storebrand/Pareto financials (no DCF yet), and whether other FY2019–FY2024 figures for SB1NO were pre-merger.
