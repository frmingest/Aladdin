# Data gaps: what Aladdin cannot calculate yet, and what it needs (2026-10-03)

Faiz asked for a simple overview of every holding and watchlist company: what the app cannot analyse or
value, why not, and a tip to get the missing information. **Read-only assessment, no code changed.**

**How this was checked:** the live app (Railway) through the browser pane: Margin of safety board, Watchlist,
Portfolio risk, Performance and each of the 8 holding pages (readiness, metrics, fund facts, valuation).
The reasons are the app's own messages. Where a cause is my inference it says so. Watchlist companies were
read from the board and list, not opened one by one.

**Update 2026-10-04:** the watchlist "reports never fetched" guess below is wrong for five of the six; see
[db-contents-and-look-through-2026-10-03.md](db-contents-and-look-through-2026-10-03.md) §1 and
[tag-gaps-aker-orkla-subsea-2026-10-04.md](tag-gaps-aker-orkla-subsea-2026-10-04.md) for the confirmed cause.
L&G Gold Mining's holdings are now fixed and priced (40 of 44 P/Es).

---

## 1. Short version

| | Count | State |
|---|---|---|
| Owned holdings | 8 | **0 of 8 have a DCF margin of safety.** 5 have an AI analysis (Vår Energi, Salmon Evolution, the 3 equity funds). 3 cannot be analysed at all by design (gold ETC, money-market fund, bond fund) |
| Watchlist | 15 | **1 of 15 has a usable valuation** (SpareBank 1 Sør-Norge). 7 have too little financial history, 4 are withheld as implausible, 1 lacks a EUR rate, 1 is loss-making, 1 uses a default beta |
| Portfolio pages | | Risk and Performance cover **only 5 of 8 holdings** (705,737 kr). Xetra-Gold and the two income funds are left out (about a third of the portfolio, derived from the 20.4% Xetra-Gold weight on the Dashboard) |

Three kinds of gap, and they need different fixes:

1. **Data is missing** (no reports fetched, no fund returns, no EUR rate): fixable with a click or an upload.
2. **Data is there but the method cannot use it** (loss-making or cyclical companies, hybrid capital): needs a product decision, not more data.
3. **The thing is not an equity** (gold ETC, money-market fund, bond fund): the app has no method for it yet.

---

## 2. Owned holdings

| Holding | Cannot be calculated | Why | Tip |
|---|---|---|---|
| **Vår Energi** (VAR.OL) | DCF and margin of safety. P/B and ROE show "n/m" | Filings FY2019–FY2025 are on file, so **data is not missing**. Only FY2025 has positive owner earnings and the DCF needs two consecutive profitable years. Ordinary equity is negative (-239.5m USD) because 799.5m of hybrid capital is counted as debt, so P/B and ROE have no meaning. Multiples history uses today's NOK→USD rate for every year (no year-end rates stored) | Decide on a method for a cyclical producer: normalised (multi-year average) earnings, or FCF yield and EV/EBITDA against a mid-cycle price. Backfill year-end FX. The stored AI analysis still quotes the old DCF reason: re-run it on the PC worker |
| **Salmon Evolution** (SALME.OL) | DCF, P/E, ROIC, EV/EBITDA, gross margin, materials margin | Loss-making in the build-out phase (net income -171.6m, EBITDA -63.1m, capex 15.8x D&A), so every earnings-based model fails. Gross and materials margin need `cost_of_goods_sold` and `raw_materials_used`, which the filing does not tag. P/E history lacks a share count | Value it on assets (P/B 0.85 already works) and capacity. For that, add harvest volume, cost per kg and licensed capacity from the quarterly reports (upload them). Not fixable with more annual-report fetching |
| **L&G Gold Mining ETF** (ETLX.DE) | Look-through P/E and ROE, tracking difference, track record | The 44 constituents (100% coverage) are loaded, but **constituent P/Es have not been fetched** and no constituent is linked to a company with figures (Newmont, Agnico Eagle and the rest are not in the app). No fund or benchmark returns entered | Press **Refresh look-through** on the fund page (P/E only). Type in the fund and benchmark yearly returns from the fact sheet already uploaded. Look-through ROE would need the top miners as companies with reports: probably not worth it |
| **Heimdal Utbytte N** | Look-through P/E, excess return, track record | P/Es not fetched. ROE is built from 1 holding only (2.7% of the fund). No returns entered | Refresh look-through. Link the largest holdings to companies in the app (several are on your watchlist, e.g. Kongsberg, which improves once those have reports). Add returns from the fact sheet |
| **Xtrackers Europe Defence** (XDEF.DE) | Look-through P/E, tracking difference, track record | P/Es not fetched. ROE from 1 holding (4.2%). No returns. The fund started Aug 2025, so only since-inception returns can exist | Refresh look-through. Add since-inception fund and index return |
| **Xetra-Gold** (4GLD.DE) | AI analysis, DCF, any financials. Left out of Risk and Performance | Tagged Commodity ETC; analysis accepts only Stock, Equity ETF and Equity fund. A physical gold ETC has no income statement, so a DCF can never exist. Price was 6 days old | Treat it as a commodity position: value from gold spot (the app already has gold-api.com for coins), fee and premium to spot. Add it to Risk and Performance (it has prices) |
| **Heimdal Høyrente Pluss B** | Everything except price | Tagged Money-market fund: analysis blocked by type, no financial history, no fund facts page, price 4 days old | Needs a simple income-fund view: yield, duration, credit mix, fee, from the fact sheet. Or treat it as cash-like and exclude it on purpose |
| **Alfred Berg Nordic High Yield II R** | Everything except price | Tagged Bond fund: same block. No sector set either | Same as above, and credit data matters more here: yield to maturity, duration, spread, rating mix, from the monthly report |

---

## 3. Watchlist (15)

| Group | Companies | Why | Tip |
|---|---|---|---|
| **Works** | SpareBank 1 Sør-Norge (base 232.91, MoS 4.7%) | Valued, with a default beta noted | none |
| **Too little financial history** (fewer than two periods with net income, D&A and capex) | Aker BP, Bouvet, Gigante Salmon, Kongsberg, Orkla, Subsea 7 | Reports never fetched, or the capex or D&A tag is not found | Newsweb **Fetch all reports** on each (all Oslo issuers). Check the period list afterwards; if a tag is missing the fix is in the extractor, not more fetching |
| **No history, bank** | Pareto Bank | Price-to-book has nothing to work on. Owner-earnings DCF is the wrong tool for a bank anyway | Fetch reports; value on P/B and return on equity |
| **Result withheld as implausible** | Aker Solutions (3.2x price), Equinor (5% of price), Sparebanken Øst (3.2x), Telenor (10% of price) | The plausibility guard tripped. My inference, not confirmed: a wrong share count, a reporting-currency vs trading-currency mismatch (Equinor reports in USD) or a distorted growth history | Open each holding, check the share count and currency, re-run. Enter the share count from the latest Newsweb notice if needed |
| **Missing market input** | Mowi | No EUR risk-free rate stored (it reports in EUR) | Add a euro-area rate series to the macro data (Bund or ECB via FRED) |
| **Loss-making** | Vend Marketplaces | FY2025 not profitable | Same decision as Salmon Evolution and Vår Energi |
| **Default beta** | Storebrand | Beta unavailable from Yahoo, default 1.0 used (valuation still computed per the board's note) | Accept, or enter a beta by hand if you want one |
| **Buy price unusable** | Aker BP, Equinor, Mowi, Subsea 7 ("currency differs"); Aker Solutions, Bouvet, Gigante ("no buy price") | Price is shown in USD or EUR while your buy-below is in NOK, so no comparison | Set the buy-below price in the quote currency, or make the app convert. Set the three missing ones |
| **Verdict without valuation** | 12 of 15 show Hold, Buy or Strong Buy with no DCF behind them. Aker Solutions says Strong Buy while its DCF is withheld. Pareto and Gigante are not analysed | The AI verdict does not need a DCF, so it can contradict a missing valuation | Read those verdicts as unvalued. Run the analysis on Pareto and Gigante once reports are in |

---

## 4. Portfolio-level gaps

| Page | Gap | Why | Tip |
|---|---|---|---|
| **Risk** | Correlation and stress test cover 5 of 8 holdings. Portfolio impact of -19.9% leaves out the gold ETC and income funds | Scope is equity-type holdings only | Include the ETC and income funds (prices exist) so the stress test covers the whole portfolio |
| **Performance** | Coverage says 705,737 of 705,737 kr, which hides the same three exclusions. Return is reindexed from today's positions, not real P&L | Only point-in-time snapshots are stored, no buy/sell history | Import the Nordnet transaction export for true and money-weighted returns |
| **Macro** | Norway yield curve has a 3-month average (0.12pp) but no latest value. Regime reads US credit and curve only | The latest print is missing; no free Norwegian credit spread exists | Macro → Refresh data. Accept the US-only regime as a known limit |
| **Whole app** | Gemini quota 0 of 20 left today, so research refreshes cannot run. PC worker and Ollama showed offline in the readiness check | Free tier is small | Make sure the Tavily key is set on Railway too (it is in the local `.env`); start the worker before queueing runs |

---

## 5. Suggested order

| # | Do | Effect |
|---|---|---|
| 1 | **Refresh look-through** on ETLX, Heimdal Utbytte N, XDEF (3 clicks) | Fund valuation appears for 3 owned funds |
| 2 | **Fetch all reports** for 6 watchlist companies plus Pareto | Up to 7 more valuations |
| 3 | Check share count and currency on Aker Solutions, Equinor, Telenor, Sparebanken Øst | Un-withholds 4 valuations |
| 4 | Type in fund returns from the fact sheets (3 funds) | Track record and tracking difference |
| 5 | Add a euro-area rate series | Mowi |
| 6 | **Decide:** method for loss-making and cyclical companies (Vår Energi, Salmon Evolution, Vend). Normalised earnings, or P/B and capacity-based | Only way these ever rank |
| 7 | **Decide:** a view for the gold ETC and the income funds, and bring them into Risk and Performance | Closes about a third of the portfolio |
