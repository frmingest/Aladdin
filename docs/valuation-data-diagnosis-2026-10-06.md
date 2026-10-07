# Why 15 holdings and watchlist names cannot be valued: diagnosis from Faiz's SQL results (2026-10-06)

Faiz asked whether thin tags in older annual reports explain the "Data missing / Check inputs / No ROE data /
Loss-making" labels on the Margin-of-safety board. The assistant cannot query the database, so Faiz ran queries
1, 2, 4b, 5 (partly), 6, 7, 8, 9 in the Supabase editor and pasted the results; the valuation code was then read
to explain each. **Read-only analysis, no code or data changed.** Items marked *inference* are not yet proven.

Follow-up build: [valuation-v4-normalised-base-certificates-2026-10-07.md](valuation-v4-normalised-base-certificates-2026-10-07.md).

## 1. Short answer: it is mostly not the age of the reports

| Finding | Evidence |
|---|---|
| FY2019 is only opening balances (2 facts: cash, equity). Real history is FY2020-FY2025 for every company | Query 1 pattern `FY2019:---`; query 3b |
| **D&A is missing in every year for KOG, BOUV, STB**, newest year included | Query 1 pattern `N-C` x6. Query 2: D&A present for 11-12 of 15 companies in *every* year, no age gradient |
| Older years are only mildly thinner | Facts per year: KOG 16 to 19, TEL 14 to 19, SPOG 12 to 14. TEL lacks capex in FY2020-21 only, which does not block its DCF |
| Each year's facts come from the newest report that carries it as a comparative | Query 3b |
| Units and currencies are consistent within every metric | Query 4a returned 0 rows |
| Filing currency differs from trading currency for AKRBP, EQNR, SUBC, VAR (USD) and MOWI (EUR) | Query 4b. Handled by the app |
| Shares outstanding is stored for only 1-2 of 15 companies per year | Query 2 |

## 2. Per holding

| Holding | App says | Cause | Confidence |
|---|---|---|---|
| **KOG** | fewer than two complete periods | D&A tag not recognised in any year. Needs the real tag name from the filing | Confirmed; tag unknown |
| **BOUV** | same | Same pattern | Confirmed |
| **GIGA, PARB** | no history | 0 facts. GIGA is PDF-only, PARB's `.xhtml` is untagged | Confirmed earlier |
| **AKSO** | DCF 3.7x price | Inputs right, model aggressive: owner earnings FY2021 453m to FY2025 2,838m = 58.2%/yr, capped to 10%. FY2025 capex is 0.30x D&A; FY2023 net income probably a one-off gain (*inference*) | Arithmetic confirmed |
| **EQNR** | DCF 6% of price | Negative growth extrapolated: owner earnings FY2021 11,004m USD to FY2025 1,908m = -35.5%/yr | Confirmed |
| **TEL** | DCF 10% of price | Same: FY2022 34,657m to FY2025 7,284m = -40%/yr; FY2022 looks like disposal gains (*inference*) | Confirmed |
| **SPOG** | check inputs | Equity-certificate bank: 20.7m certificates vs 72.5m EPS-implied "shares"; total equity divided by certificates gives book value about 3.5x too high | Strong inference |
| **STB** | No ROE data | Inputs exist; the 5% equity-to-assets guard refused ROE for an insurer (confirmed by Faiz's holding page text) | Confirmed |
| **VAR** | one profitable year | Owner earnings positive only in FY2025 after capex, leases and decommissioning | Inference |
| **VEND** | loss-making | Net income swings on non-operating items; operating cash flow steady; presentation basis changed FY2022 to FY2023 | Confirmed |
| **SALME** | loss-making | Real build-out losses, but FY2020-21 flows look about 1,000x too small (scale anomaly) | Raw values needed |

## 3. Other findings

- **Kongsberg share split:** EPS-implied shares jump 5.0x from FY2023 to FY2024 (5:1 split); pre-split years not restated.
- **EQNR price:** 41.95 USD stored; worth checking against the Oslo quote and USD/NOK.
- **Risk-free rates:** USD 5.24% (2026-10-01), NOK 4.29% (2026-08-01), **EUR 3.22% observed 2026-01-01, nine months old**. Every refresh appends another identical observation row.

## 4. Fix order and status (2026-10-07)

| # | Fix | Status |
|---|---|---|
| 1 | KOG/BOUV D&A tags in the extractor | Left as is: Faiz proposes a separate, generic feature |
| 2 | Normalised owner-earnings base for volatile histories | Built (v4), not merged |
| 3 | Equity-certificate banks | Built, not merged |
| 4 | Storebrand ROE | Built (insurer guard), not merged |
| 5 | Restate per-share history across splits (KOG) | Open |
| 6 | SALME FY2020-21 raw values | Open (query below) |
| 7 | VEND: operating cash flow minus capex base | Open, method decision |
| 8 | EUR rate and duplicate observation rows | Open |

## 5. Queries still worth running

```sql
-- VAR owner-earnings components
select h.ticker, f.period,
  round(max(f.value) filter (where f.metric='net_income')/1e6,1) ni_m,
  round(max(f.value) filter (where f.metric='depreciation_and_amortization')/1e6,1) da_m,
  round(max(f.value) filter (where f.metric='capital_expenditures')/1e6,1) capex_m,
  round(max(f.value) filter (where f.metric='lease_payments_financing')/1e6,1) lease_m,
  round(max(f.value) filter (where f.metric='decommissioning_payments')/1e6,1) decom_m
from financial_line_items f join holdings h on h.id=f.holding_id
where h.ticker in ('VAR.OL','SALME.OL') group by 1,2 order by 1,2;

-- SALME raw stored values (scale check)
select f.period, f.metric, f.value, f.unit, f.currency, f.confidence, f.created_at::date
from financial_line_items f join holdings h on h.id=f.holding_id
where h.ticker='SALME.OL' and f.period in ('FY2020','FY2021','FY2022')
  and f.metric in ('net_income','capital_expenditures','operating_cash_flow','total_equity','revenue')
order by f.period, f.metric;

-- EQNR price and FX actually stored
select h.ticker, m.* from market_observations m join holdings h on h.id=m.holding_id
where h.ticker='EQNR.OL' order by 1 desc limit 5;
select * from fx_observations order by created_at desc limit 10;
```
