# Sprint 9: ROIC, ROE, ROCE and market multiples (2026-09-25)

Built from the research in [gap-closing-roic-roe-multiples-2026-09-25.md](gap-closing-roic-roe-multiples-2026-09-25.md),
layers **A–C**. Layer D (filings.xbrl.org history import) is not built yet; it's still in the backlog.

**Status:** written and tested, **not deployed**. Migration `b1c2d3e4f5a6` (additive, one new table).

---

## 1. What you'll see

| Where | Before | Now |
|---|---|---|
| Holding → Deterministic metrics | ROIC, ROE and 5 multiples under **Not available** | **ROIC (after tax)**, **ROCE (pre-tax)** and **ROE** in *Computed*, each with its definition. Averages this year and last year when last year is on file |
| New card: **Market multiples** | — | Share price (converted into the filing currency), share count with source and date, market cap, EV, P/E, P/B, P/S, EV/EBITDA, **FCF yield** |
| Same card | — | **Enter share count** form (count, date, link, note) and **Use Yahoo / SEC again** |
| Valuation → DCF | "no positive shares_outstanding fact" for Oslo holdings | DCF uses the current share count; the source is shown under the scenarios |
| Valuation → Multiples over time | NOK price divided by USD figures (Vår ~10× too high) | Price converted to the filing currency; notes under the charts |
| System status | — | "Latest share count (Yahoo)" row, with how many holdings have a count and from where |

## 2. Definitions (owner's view)

| Metric | Formula | Not meaningful when |
|---|---|---|
| **ROE** | Net income to ordinary holders ÷ average ordinary equity | Equity ≤ 0, or under 5% of total assets ("book equity depleted by distributions; judge on ROIC") |
| **ROIC** | EBIT × (1 − tax ÷ pre-tax profit) ÷ average invested capital | EBIT ≤ 0 or pre-tax profit ≤ 0 (see ROCE instead) |
| **ROCE** | EBIT ÷ the same average invested capital | Invested capital ≤ 0 |
| Invested capital | Debt + hybrid + leases + ordinary equity + minority interests − cash | |
| **Materials margin** | (Revenue − raw materials & consumables) ÷ revenue. Only when there is no cost of sales (statement by nature) | Revenue ≤ 0 |
| Market cap | Price (in the filing currency) × current share count | |
| **EV** | Market cap + net debt (incl. hybrid) + leases + minority interests | |
| P/E · P/S · EV/EBITDA | Market cap or EV ÷ the year's figure | Denominator ≤ 0 |
| **P/B** | Market cap ÷ ordinary equity | Same depleted-equity rule as ROE |
| **FCF yield** | Free cash flow to owners ÷ market cap | |

The effective tax rate is limited to 0–100%, and the note says so if the filing's rate was outside that range.

## 3. Share count: where it comes from

| Priority | Source | Rule |
|---|---|---|
| 1 | **Entered by you** | Always wins until you click *Use Yahoo / SEC again* |
| 2 | **SEC cover page** (`dei:EntityCommonStockSharesOutstanding`) | Saved by *Import from SEC EDGAR*; used while under 400 days old. Several share classes are not summed |
| 3 | **Yahoo Finance** | Cached 24 h as a dated row. If a refresh fails, the last row is used and a warning says so |
| 4 | **Annual report** `shares_outstanding` fact | Year-end count, last resort |
| check | Net income ÷ basic EPS | Flags a count more than 10% outside the EPS-implied range (EPS is rounded to 2 decimals, so it's a range) |

## 4. New facts stored from uploads

| Fact | ESEF / SEC concept |
|---|---|
| `income_before_tax` | `ifrs-full:ProfitLossBeforeTax`, us-gaap pre-tax income |
| `income_tax_expense` | `ifrs-full:IncomeTaxExpenseContinuingOperations`, `us-gaap:IncomeTaxExpenseBenefit` |
| `lease_liabilities` | `LeaseLiabilities`, or current + non-current (summed, marked derived) |
| `minority_interests` | `ifrs-full:NoncontrollingInterests`, `us-gaap:MinorityInterest` |
| `eps_basic` | `ifrs-full:BasicEarningsLossPerShare`, `us-gaap:EarningsPerShareBasic` (unit `USD/shares`, never scaled) |
| `raw_materials_used` | `ifrs-full:RawMaterialsAndConsumablesUsed` |

Spreadsheet (CSV/XLSX) uploads also read "Profit before tax" labels, but not tax expense: tables print tax as both `2,986` and `(2,986)`, so the sign can't be trusted.

> **Existing uploads don't have these facts yet.** Delete and re-upload each `.xhtml` (Vår Energi, Salmon Evolution) to get ROIC, leases and EPS.

## 5. Analysis impact

Evidence packet **v6**: ROE on average equity (with the depleted-equity reason), ROIC history with the effective tax rate and the hurdle comparison, ROCE history, and a "Current market multiples" item with its inputs. Prompts and schema are unchanged (fund packet unchanged too).

## 6. Tests

725 backend (40 new), 16 frontend vitest (3 new). Ruff, tsc, eslint and the build are clean. Migration checked up/down/up on Postgres 16. Checked in a browser against a local Postgres with Vår-like figures.

## Suggested git commit message

```
Sprint 9: ROIC, ROE, ROCE and market multiples with share counts

- metrics: ROE on average ordinary equity (n/m when book equity is
  depleted), ROIC on the filing's effective tax rate, ROCE, materials
  margin; market cap, owner's-view EV, P/E, P/B, P/S, EV/EBITDA, FCF yield
- ESEF/SEC: store pre-tax profit, tax, leases, minorities, basic EPS,
  raw materials; SEC cover-page share count
- share counts: new share_count_observations table (migration
  b1c2d3e4f5a6, additive): manual > SEC > Yahoo (24 h) > filing, with a
  net income / EPS cross-check; GET/PUT/DELETE /holdings/{id}/share-count
- DCF uses the current share count (fixes "DCF unavailable" for Oslo)
- multiples history converts the price into the filing currency
- evidence packet v6; System status share-count row
- UI: Market multiples card with share-count override form
725 backend tests (40 new), 16 vitest (3 new)
```
