# Closing the "Not available" gaps: ROIC, ROE and market multiples (2026-09-25)

Faiz asked what Aladdin is missing to fill the **Not available** column on a holding's metrics panel
(ROIC, ROE, P/E, P/B, P/S, EV/EBITDA, enterprise value — seen on Vår Energi and Salmon Evolution)
and for the best free, robust way to get it.

**Research and proposal only — no code changed.** Filing facts were checked against the public ESEF
copies on filings.xbrl.org (Vår FY2024, Salmon FY2024). Free-tier terms are from search, not from
live calls. Re-check them before building.

---

## 1. The short answer

The 7 missing metrics come down to **3 missing inputs**. Aladdin already has the share price and FX
(yfinance).

| Missing input | Unlocks | Where it comes from | New source needed? |
|---|---|---|---|
| **Tax expense + pre-tax profit** | ROIC | Already in every ESEF file. The integrity check reads them, then drops them | No, just store them |
| **Ordinary equity + prior-year balance** | ROE (and a correct P/B) | Already stored (`total_equity`, `hybrid_capital`, comparative year) | No, just compute it |
| **Shares outstanding** | P/E, P/B, P/S, EV, EV/EBITDA, **and the DCF / margin of safety** | Not tagged in Oslo ESEF files | **Yes**: yfinance, with a filing-based cross-check |

Two of the three are a code change, not a data problem. The share count is the only real data gap,
and it matters most: without it the DCF says *"no positive shares_outstanding fact"*, so the
margin-of-safety board can't rank Oslo holdings either.

---

## 2. What each metric needs

Definitions follow the owner's view already used in `metrics.py` (hybrid capital counts as debt; a
denominator of zero or less gives *n/m*).

| Metric | Formula | Inputs we have | Inputs missing |
|---|---|---|---|
| **ROE** | Net income to ordinary holders ÷ average ordinary equity | `net_income`, `total_equity`, `hybrid_capital`, prior year | — |
| **ROIC** | EBIT × (1 − effective tax rate) ÷ average invested capital | `ebit`, `total_debt`, `hybrid_capital`, `cash`, equity | `income_tax_expense`, `income_before_tax`; lease liabilities (optional) |
| **Market cap** | Price × shares, converted to the reporting currency | price, FX | **shares outstanding** |
| **EV** | Market cap + owner's-view net debt (+ leases, + minority interests) | net debt, hybrid | shares; lease liabilities; minority interests |
| **P/E · P/B · P/S** | Market cap ÷ net income / ordinary equity / revenue | all | shares |
| **EV/EBITDA** | EV ÷ EBITDA | all | shares |

Invested capital = total debt + hybrid capital + lease liabilities + ordinary equity + minority
interests − cash.

---

## 3. What the research found

### 3.1 What ESEF files contain (checked on the FY2024 filings)

| Concept | Vår Energi | Salmon Evolution | Used today? |
|---|---|---|---|
| `ProfitLossBeforeTax` | ✅ 3,313m USD | ✅ −47.4m NOK | Integrity check only, not stored |
| `IncomeTaxExpenseContinuingOperations` | ✅ 2,986m USD | ✅ 0 | Integrity check only, not stored |
| `BasicEarningsLossPerShare` | ✅ 0.11 | ✅ −0.11 | ❌ |
| `OtherEquityInterest` (hybrid) | ✅ 799.5m | — | ✅ `hybrid_capital` |
| Lease liabilities (current + non-current) | ✅ 70.4m + 141.5m | not checked | ❌ |
| `RawMaterialsAndConsumablesUsed` | — | ✅ 200.9m | ❌ (why Salmon has no gross margin) |
| **Any share-count concept** | ❌ | ❌ | — |

### 3.2 Findings that change how the metrics must be built

| # | Finding | Consequence |
|---|---|---|
| 1 | **Vår's effective tax rate was 90%** in FY2024 (2,986 ÷ 3,313). Norwegian petroleum tax is 78%, plus items that aren't deductible | ROIC **must** use the effective rate from the filing. The 22% company rate would overstate Vår's NOPAT about 8× |
| 2 | **Vår's ordinary equity is close to zero.** FY2024: 832.5m total, of which 799.5m is hybrid, so about 33m belongs to ordinary holders | ROE and P/B are *n/m* for Vår. Dividends have emptied the book equity. **ROIC is the metric to judge Vår on**; the panel should say so instead of showing ROE ≈ 60–100%+ |
| 3 | The screenshots show **D/E 10.61×, FCF 1,787m, Salmon EBITDA −63.1m**. These are the numbers from *before* `34beec7` (the owner's view gives D/E on ordinary equity with hybrid as debt, FCF 1,116m, Salmon EBITDA −79m) | The instance in the screenshot still has the old extraction. The pending "delete and re-upload the `.xhtml` files" item (§2 of progress) is still open there |
| 4 | **Bug in `valuation/multiples.py`:** it multiplies the price (Vår: NOK) by shares and divides by statement figures (Vår: USD) with no FX conversion | Once shares exist, Vår's historical P/E and P/S would be about 10× too high. EV there also uses gross debt − cash (no hybrid, no leases) and P/B uses total equity, which doesn't match the owner's view |
| 5 | EPS is always tagged, so shares ≈ net income ÷ EPS. But EPS is rounded to 2 decimals: Salmon's −47.4m ÷ −0.11 gives **anything from 412m to 451m shares** | Good as a **sanity check**, not as the share count. It is also a weighted average for the year, not the current count |
| 6 | Salmon raises equity often, so a year-end count goes stale mid-year | Current market cap needs a **current** share count, not the annual-report one |

### 3.3 Free sources compared

**Shares outstanding**

| Source | Coverage | Current? | Robustness | Verdict |
|---|---|---|---|---|
| **yfinance** (`fast_info["shares"]`, `info["sharesOutstanding"]`) | Global incl. `.OL` | Yes, daily | Unofficial; Yahoo rate-limits hard, especially from cloud/datacenter IPs like Railway | ✅ **Primary** for Oslo, already a dependency |
| **SEC `dei:EntityCommonStockSharesOutstanding`** | SEC filers | As of each 10-K/10-Q cover page | Official, keyless, already integrated | ✅ **Primary** for US names |
| **Net income ÷ basic EPS** (filing) | Every ESEF filing | Year average | Official, but ±5% from rounding | ✅ **Cross-check only** |
| **Company IR page / Newsweb** | Per company | Yes (Vår: 2,496,406,246 on 24 Sep 2026) | Official, but no structured feed | ✅ **Manual override** with a citation |
| Euronext Oslo Børs *Shares and Voting Rights* file | All Oslo issuers, daily | Yes | Authoritative | ❌ Paid product |
| EODHD free tier | Global | EOD | 20 calls/day, personal use only; fundamentals are paid | ❌ Not for shares. Possible price fallback later |
| FMP / Finnhub free tiers | Mostly US | — | International fundamentals paywalled | ❌ Same verdict as 2026-09-21 |

**Filing history (for ROIC/ROE trends and the DCF's 3+ years)**

| Source | What it gives | Limitation |
|---|---|---|
| **filings.xbrl.org** (XBRL International, free, no key, JSON:API + xBRL-JSON) | 958 Norwegian ESEF filings. Vår and Salmon: **FY2021–FY2024**, zero validation errors | **No FY2025 yet**: the newest Norwegian filing was added 2025-05-21, so Norway is more than a year behind. For history, not the latest year |
| ESEF upload (existing) | Latest year | Manual |

---

## 4. Recommendation

Build it in four layers, in this order. Layers A and C need no new data source.

### A. Filing-only ratios (no new source)

| Change | Detail |
|---|---|
| Store 5 more facts from ESEF | `income_before_tax`, `income_tax_expense`, `lease_liabilities` (current + non-current), `minority_interests`, `eps_basic` |
| **ROE** | Net income to ordinary holders ÷ average ordinary equity (this year + last year). *n/m* when average ordinary equity ≤ 0 or is under ~5% of total assets, with the reason "book equity depleted by distributions — use ROIC" |
| **ROIC** | EBIT × (1 − tax ÷ pre-tax profit) ÷ average invested capital. Effective rate limited to 0–100%. *n/m* when EBIT or pre-tax profit ≤ 0 (Salmon today). The note shows the rate used, e.g. "effective tax 90.1% (Norwegian petroleum tax)" |
| **ROCE** (new, pre-tax) | EBIT ÷ average capital employed. Shows the business's return before the tax regime, which makes Vår readable next to non-petroleum holdings |
| Gross margin fallback | For income statements by nature (Salmon): revenue − raw materials and consumables used, labelled "materials margin" so it isn't mistaken for a true gross margin |

### B. Shares outstanding — layered, with a cross-check

| Priority | Source | Used for |
|---|---|---|
| 1 | Manual override (value + date + cited document/URL) | Always wins; for when the checks below disagree |
| 2 | SEC `dei:EntityCommonStockSharesOutstanding` | US holdings |
| 3 | yfinance current share count | Oslo and other non-SEC holdings |
| check | Net income ÷ basic EPS from the latest filing | Sanity check on 2 and 3 |

Rules:

- Store the share count as a **dated market observation**, not as a filing fact. It describes today,
  not a fiscal year.
- Cache 24 h (like beta). The daily worker run refreshes it.
- If yfinance and the EPS-derived count differ by **more than 10%**, still show the metrics, flag
  *"share count changed since the last report — check Newsweb for a share issue"*, and link the
  holding's announcements (already built).
- The same count feeds the DCF, so this also fixes "DCF unavailable" for Oslo holdings.

### C. Multiples on the metrics panel (+ fix `multiples.py`)

| Item | Rule |
|---|---|
| Market cap | Price × shares, **converted to the filing's reporting currency** with the existing FX provider (Vår: NOK price → USD) |
| EV | Market cap + owner's-view net debt (debt + hybrid − cash) + lease liabilities + minority interests |
| P/E · P/S · EV/EBITDA | On the latest fiscal year. Label it "on FY2025 figures" so it isn't read as trailing-twelve-month |
| P/B | On ordinary equity. *n/m* when that is ≤ 0 (Vår) |
| Negative earnings | *n/m* with the reason, as elsewhere |
| `multiples.py` | Same FX conversion, same EV and P/B definitions, so the history table and the panel agree |

### D. History backfill from filings.xbrl.org (optional, high value)

An **"Import FY2021–FY2024 from the ESEF index"** button, built like the SEC EDGAR import: look up
by LEI (already in the uploaded file names), fetch the xBRL-JSON, feed it through the existing ESEF
mapping, never overwrite a year already on file. That gives Oslo holdings 5 years of history (DCF,
ROIC trend) with only the latest year uploaded by hand.

### Resilience notes

| Risk | Mitigation |
|---|---|
| Yahoo blocks Railway's datacenter IP | 24 h cache for shares, failures shown on System status; the PC worker (residential IP) can refresh shares and prices when Railway fails |
| yfinance changes or breaks | Manual override keeps every metric working; EODHD's free EOD price is a possible later fallback |
| filings.xbrl.org lags or stops | Only used for history; uploads stay the primary route for the latest year |

---

## 5. Proposed build (one sprint)

| Step | Scope | Tests |
|---|---|---|
| 1 | ESEF mapping: 5 new facts; SEC mapping for `dei:EntityCommonStockSharesOutstanding` | Vår/Salmon fixtures |
| 2 | `metrics.py`: ROE, ROIC, ROCE, materials margin; remove the "always skipped" block | Vår (90% tax, depleted equity), Salmon (loss → n/m) |
| 3 | Share-count service: override → SEC → yfinance, EPS cross-check, 24 h cache, status row | 10% flag, missing-source paths |
| 4 | Panel multiples + `multiples.py` FX/EV/P-B fix | NOK price vs USD statements |
| 5 | UI: new rows, notes, share-count source line and override form | vitest |
| 6 (optional) | filings.xbrl.org history import | Offline fixture of the xBRL-JSON |

**Migration:** additive only (a share-count override table, or reuse `market_observations` with a
`kind` column). **Evidence packet:** new version (v6 / fund-v3) so analyses can cite ROIC and
multiples.

---

## Sources

- [filings.xbrl.org — about](https://filings.xbrl.org/docs/about) and API (`/api/filings`, `/api/entities`, queried 2026-09-25)
- [Vår Energi — About the share](https://varenergi.no/en/investor/the-stock/)
- [Euronext Oslo Børs Shares and Voting Rights file](https://www.euronext.com/en/products-services/euronext-oslo-bors-shares-and-voting-rights-file)
- [yfinance rate-limiting discussion #2431](https://github.com/ranaroussi/yfinance/discussions/2431)
- [EODHD free tier review](https://www.findmymoat.com/tools/eodhd)
- [ESEF filings MCP (filings.xbrl.org endpoint notes)](https://github.com/pipeworx-io/mcp-esef-filings)

## Suggested git commit message

```
docs: research on closing ROIC/ROE/multiples gaps

Research only, no code. The 7 "Not available" metrics need 3 inputs:
tax + pre-tax profit (already in ESEF, dropped after the integrity check),
ordinary equity averages (already stored) and shares outstanding (not in
Oslo ESEF). Proposes yfinance + SEC dei shares with an EPS cross-check and
manual override, owner's-view EV, FX fix in multiples.py, and an optional
FY2021-24 backfill from filings.xbrl.org.
```
