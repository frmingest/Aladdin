# What is in the database today, and why "Refresh look-through" seemed to do nothing (2026-10-03, late; updated 2026-10-04)

Faiz asked for SQL to inspect the database, and what to expect from **Refresh look-through** on L&G Gold
Mining, Heimdal Utbytte N and Xtrackers Europe Defence. **Corrects the 2026-10-03 data-gap overview** (see §1).

I cannot run SQL: the shell on Faiz's PC has no route to Supabase. I first read the live app and the code, then
Faiz ran the queries in the Supabase SQL editor and pasted the results. **§0 holds what they showed.** The
queries are in §4.

**Update 2026-10-04:** the L&G mix-up is fixed (§3, §4): the wrong list was deleted, L&G was re-fetched with
Issuer L&G (44 rows with ISINs, as of 2026-10-01) and Refresh look-through priced 40 of 44 holdings.

---

## 0. Results of Faiz's queries (same night)

### 0a. Years on file (query 1)

| Ticker | Periods | Facts | Note |
|---|---|---|---|
| Aker BP, Bouvet, Kongsberg, Orkla, Subsea 7 | FY2019–FY2025 (7) | 102–121 each | **FY2019 holds only cash and equity** (opening balances from the FY2020 report). Real full years: **FY2020–FY2025 = 6** |
| Gigante Salmon `GIGA.OL` | 0 | 0 | No facts at all |
| Pareto Bank `PARB.OL` | 0 | 0 | Also no facts (not on Faiz's list) |
| Funds and the ETC (`ETLX.DE`, `XDEF.DE`, `4GLD.DE`, three Heimdal / Alfred Berg codes) | 0 | 0 | Expected: funds have no statements |
| Other watchlist companies (Mowi, Equinor, Aker Solutions, Telenor, SB1NO, SPOG (Sparebanken Øst), Stb, Vår, Vend, Salmon Evolution) | 7–8 | 84–148 | Loaded |

So **the 4–5 years Faiz expected do exist** for five of the six. What differs is which line items each year has.

### 0b. Which DCF inputs exist (query 2, FY2020–FY2025; FY2019 has none)

| Company | Net income | D&A | Capex | Total debt | Op. cash flow | COGS | Shares |
|---|---|---|---|---|---|---|---|
| Aker BP | all years | **none** | all | **none** | all | all | FY2021+ |
| Bouvet | all years | **none** | all | **none** | all | all | **none** |
| Kongsberg | all years | **none** | all | all | all | **none** | **none** |
| Orkla | all years | all | **none** | FY2020–21 only | all | **none** | **none** |
| Subsea 7 | all years | **none** | FY2020–21 only | all | **none** | **none** | **none** |

The owner-earnings DCF needs net income, D&A **and** capex together in at least two years. Result:

| Company | Blocked by |
|---|---|
| Aker BP | D&A missing (every year) |
| Bouvet | D&A missing (every year) |
| Kongsberg | D&A missing (every year) |
| Orkla | Capex missing (every year) |
| Subsea 7 | D&A missing; capex only FY2020–21; operating cash flow missing |
| Gigante Salmon | Nothing stored |

**Second finding:** share counts are stored for almost nobody in this group (only Aker BP from FY2021). Per-share
value then depends on the live share count from Yahoo, which is fine for today's price but not for history.

**Cause confirmed 2026-10-04** from the real filings: see [tag-gaps-aker-orkla-subsea-2026-10-04.md](tag-gaps-aker-orkla-subsea-2026-10-04.md).

### 0c. What is stored for Aker BP (query 4, 20 metrics; the output appeared twice, identical)

Present: capital_expenditures, cash_and_equivalents (7 periods), cost_of_goods_sold, decommissioning_payments,
ebit, eps_basic, income_before_tax, income_tax_expense, interest_expense, interest_paid_financing,
lease_liabilities, lease_payments_financing, net_income, operating_cash_flow, operating_income, revenue,
shares_outstanding (5), total_assets, total_equity (7), total_liabilities.
**Absent: depreciation_and_amortization, total_debt (only lease liabilities are stored, no loans or bonds).**
That confirms what is missing. It did not show why; the later tag listing did (Aker BP tags D&A as
`ifrs-full:DepreciationExpense`, which the extractor does not look for).

### 0d. Fund holdings (queries 5, 5b, 6a)

| Fund | Import (as-of) | Lines | With ISIN | Imported | Reading |
|---|---|---|---|---|---|
| Heimdal Utbytte N | 2026-09-25 | 45 | **0** | 09-25 | No ISINs, so look-through can fetch nothing |
| L&G Gold Mining | 2026-09-25 | 44 | **0** | 09-25 | The right list (first line Agnico Eagle), but without ISINs |
| L&G Gold Mining | 2026-10-01 | 34 (as first read) | 34 | **10-03** | **The wrong list** (first line Airbus; weight sum 99.9, same as XDEF). The delete on 2026-10-04 removed **44** rows for this date, so the count read here was low |
| Xtrackers Defence | 2026-07-31 | 10 | 0 | 09-25 | Old, from the prospectus |
| Xtrackers Defence | 2026-09-28 | 34 | 34 | 09-29 | Current |

Stored P/Es (5b): L&G 30 of 34 priced, Xtrackers 30 of 34 priced, both latest 2026-10-03. L&G's were the defence
stocks' P/Es (the 2026-10-04 delete removed 44 stored P/E rows for ETLX.DE). Heimdal has none.

**Query 6a confirmed the L&G mix-up**, so the delete (6b) was safe to run.

**New catch:** the *correct* L&G list (2026-09-25) has **no ISINs**, so Refresh look-through would fetch 0 of 44
from it. The LGIM CSV carries an ISIN column, so the fix is a fresh fetch with Issuer = L&G and ISIN
`IE00B3CNHG25`. (That fetch checks that the file's fund ID equals the typed ISIN, so it cannot import the wrong basket.)

---

## 1. The six watchlist companies: reports ARE loaded (correction)

The earlier overview guessed "reports never fetched". **Wrong for five of the six.** The holding pages and the
queries show FY2019–FY2025 (7 periods) for Aker BP, Bouvet, Kongsberg, Orkla and Subsea 7. What is missing is
individual line items, so fewer than two years have net income **and** D&A **and** capex together (table in §0b).

**Cause (confirmed 2026-10-04 for Aker BP, Orkla and Subsea 7):** the ESEF extractor
(`backend/app/services/documents/extraction/ixbrl.py`) maps D&A to only two IFRS concepts
(`DepreciationAndAmortisationExpense` and the impairment-combined variant) and capex to three standard
concepts. The companies tag D&A as `DepreciationExpense` or as a cash-flow add-back, and capex as a company
extension. So **more fetching will not help; the extractor needs more concepts.** Bouvet and Kongsberg still
need their filings checked.

Gigante Salmon: confirmed a PDF-only filer (Faiz, 2026-10-04); no ESEF `.xhtml` exists.

## 2. Refresh look-through: what happens, and what I saw

**Expected:** the button turns grey ("Fetching P/Es… (can take a minute)"); the backend asks Yahoo for the
trailing P/E of each holding by ISIN, one call each, then shows a note under the button ("Fetched P/E for X of
N holdings…") and stores the numbers. Then the card should show three fair-value scenarios, coverage % and the
fund P/E. **After that, the Margin of safety board needs one Refresh** to rank the fund (it serves a stored page).

**Observed 2026-10-03** (pressed on all three):

| Fund | Result | What blocks the valuation |
|---|---|---|
| Xtrackers Europe Defence | 9 s, "Fetched P/E for 30 of 34 (4 without a usable P/E)" | **No EUR risk-free rate stored** ("not fetched yet"). The note sits under the button and the reason sits further down, so it reads as "nothing happened" |
| Heimdal Utbytte N | 3 s, "0 of 45 (45 without an ISIN)" | The 45 holdings have **no ISINs** (typed or parsed from the prospectus), so Yahoo cannot be asked |
| L&G Gold Mining | 6 s, "30 of 34" | **Wrong data, see §3.** Also the EUR rate |

**Observed 2026-10-04, L&G after the fix:** "Fetched P/E for 40 of 44 holdings (4 without a usable P/E)". The
valuation still reads "no risk-free rate for EUR".

So the button works. The remaining blockers are: (1) a euro-area risk-free rate, (2) ISINs on Heimdal's holdings.

## 3. L&G Gold Mining held the wrong fund's holdings (fixed 2026-10-04)

The L&G page listed **Rolls-Royce, Safran, Airbus, BAE Systems, Rheinmetall…** (as of 2026-10-01, HHI 746,
imported 2026-10-03). That is the Xtrackers Europe Defence list (HHI 747). Earlier the same page showed the 44
gold miners as of 2026-09-25 (Newmont, Agnico Eagle…). Most likely someone fetched with Issuer = Xtrackers and
the XDEF ISIN on the L&G page. The default issuer on that card is **Xtrackers**, and the app shows the latest
as-of date, so the newer wrong list hid the right one.

My Refresh press on 2026-10-03 stored defence-stock P/Es under L&G (it replaces the stored P/Es for the fund
each time); the delete removed them.

**Done, in this order:** (1) the delete in §4 (first attempt with `begin;` and no `commit;` was discarded by the
Supabase editor; the one-statement version worked: 44 holdings rows and 44 stored P/Es removed); (2) a check
query showed only the old 2026-09-25 list left (44 rows, 0 ISINs); (3) Fetch with Issuer **L&G**, ISIN
`IE00B3CNHG25`: a new list as of **2026-10-01, 44 rows, 44 with ISINs**, beside the old list; (4) Refresh
look-through: 40 of 44 priced. Still to do: Refresh on the Margin of safety board once the euro rate exists.

## 4. SQL for the Supabase SQL editor (read-only, except 6b)

```sql
-- 1. Years and facts per company
select h.ticker, count(distinct f.period) as periods, min(f.period) as first_period,
       max(f.period) as last_period, count(f.id) as facts
from holdings h left join financial_line_items f on f.holding_id = h.id
group by h.ticker order by h.ticker;

-- 2. Which DCF inputs exist per company and year (t = present)
select h.ticker, f.period,
  count(*) filter (where f.metric = 'net_income') > 0                      as net_income,
  count(*) filter (where f.metric = 'depreciation_and_amortization') > 0  as d_and_a,
  count(*) filter (where f.metric = 'capital_expenditures') > 0           as capex,
  count(*) filter (where f.metric = 'total_debt') > 0                     as total_debt,
  count(*) filter (where f.metric = 'operating_cash_flow') > 0            as op_cash_flow,
  count(*) filter (where f.metric = 'cost_of_goods_sold') > 0             as cogs,
  count(*) filter (where f.metric = 'shares_outstanding') > 0             as shares
from holdings h join financial_line_items f on f.holding_id = h.id
where h.ticker in ('AKRBP.OL','BOUV.OL','GIGA.OL','KOG.OL','ORK.OL','SUBC.OL')
group by h.ticker, f.period order by h.ticker, f.period;

-- 3. Documents on file per company (what was actually fetched)
select h.ticker, d.type, d.reporting_period, d.original_filename, d.mime_type, d.status,
       d.size_bytes, d.uploaded_at::date as uploaded
from holdings h left join documents d on d.holding_id = h.id
where h.ticker in ('AKRBP.OL','BOUV.OL','GIGA.OL','KOG.OL','ORK.OL','SUBC.OL')
order by h.ticker, d.reporting_period, d.uploaded_at;

-- 4. Every metric name stored for one company (spot unmapped line items)
select f.metric, count(distinct f.period) as periods
from financial_line_items f join holdings h on h.id = f.holding_id
where h.ticker = 'AKRBP.OL' group by f.metric order by f.metric;

-- 5. Fund holdings per import date, and how many carry an ISIN
select h.ticker, e.as_of_date, count(*) as lines,
       count(e.isin) as with_isin, round(sum(e.weight_pct), 1) as weight_sum,
       min(e.created_at)::date as imported
from fund_exposures e join holdings h on h.id = e.holding_id
where e.dimension = 'holding'
group by h.ticker, e.as_of_date order by h.ticker, e.as_of_date;

-- 5b. Stored look-through P/Es
select h.ticker, count(*) as lines, count(m.trailing_pe) as priced,
       max(m.observed_at)::date as latest
from fund_constituent_multiples m join holdings h on h.id = m.holding_id
group by h.ticker order by h.ticker;

-- 6a. L&G Gold Mining: what imports exist?
select e.as_of_date, count(*) as lines, min(e.label) as first_label
from fund_exposures e join holdings h on h.id = e.holding_id
where h.ticker = 'ETLX.DE' and e.dimension = 'holding'
group by e.as_of_date order by e.as_of_date;

-- 6b. Remove a wrong holdings list and its stale P/Es. ONE statement, no begin/commit:
-- the Supabase editor discards an unterminated transaction, so a `begin;` version silently does nothing.
-- It returns how many rows each delete removed.
with d1 as (
  delete from fund_exposures
   where dimension = 'holding'
     and as_of_date = date '2026-10-01'
     and holding_id = (select id from holdings where ticker = 'ETLX.DE')
  returning 1
), d2 as (
  delete from fund_constituent_multiples
   where holding_id = (select id from holdings where ticker = 'ETLX.DE')
  returning 1
)
select (select count(*) from d1) as exposures_deleted,
       (select count(*) from d2) as multiples_deleted;

-- 6c. Check what is left for L&G (and whether ISINs are there)
select as_of_date, count(*) as rows, count(isin) as with_isin
  from fund_exposures
 where dimension = 'holding'
   and holding_id = (select id from holdings where ticker = 'ETLX.DE')
 group by as_of_date order by as_of_date desc;
```

Status: queries 1, 2, 4 (Aker BP), 5, 5b, 6a, 6b and 6c have been run. **Query 3 (documents) has not**, and
query 4 was only run for Aker BP. Result of 6b on 2026-10-04: 44 holdings rows and 44 stored P/Es deleted. 6c
after the fetch: 2026-10-01 with 44 rows and 44 ISINs, beside the old 2026-09-25 list (44 rows, 0 ISINs).

Column names come from the models (`financial_line_items`, `documents`, `fund_exposures`,
`fund_constituent_multiples`, `holdings`). The `dimension = 'holding'` value is what the look-through code
reads (`latest_exposures(..., "holding")`).

## 5. Next steps

| # | What | Status |
|---|---|---|
| 1 | Delete the wrong L&G list, fetch with Issuer L&G, Refresh look-through | **Done 2026-10-04** |
| 2 | Add a euro-area risk-free rate series (fixes both EUR funds and Mowi) | Build, small; awaiting go |
| 3 | Heimdal's 45 holdings need ISINs (a provider file or a name-to-ISIN lookup) | Build or data |
| 4 | Widen the extractor's concept lists (D&A, capex, operating cash flow; later debt, COGS, share count) | Tags listed for Aker BP, Orkla, Subsea 7; awaiting go |
| 5 | Gigante Salmon: confirmed PDF-only; text evidence for now | Decided |
| 6 | Make the look-through card show the blocking reason next to the button | Small UI fix |
| 7 | Add a guard: refuse an Xtrackers fetch whose fund ISIN does not match the holding being fetched | Small build |
