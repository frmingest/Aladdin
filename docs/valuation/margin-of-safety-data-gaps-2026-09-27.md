# Margin-of-safety board: why all 5 holdings are unrankable (2026-09-27)

Faiz asked what's specifically missing to get the Margin of safety board working, given
that Newsweb/ESEF now pulls several years of annual-report `.xhtml` data. Checked the live
board (`GET /valuation/board`) and the DCF code (`growth.py`, `holding_valuation.py`,
`metrics.py`) directly. **Research only — no code changed.**

---

## 1. What the DCF actually needs, per holding

For each fiscal-year period, three raw facts must be extracted from the filing:
`net_income`, `depreciation_and_amortization`, `capital_expenditures` (this defines
"owner earnings" — see `app/services/metrics.py:owner_earnings_from_facts`, optionally
reduced by decommissioning payments / lease payments when those are extracted too).

Then, across periods:

| Requirement | Why | Code |
|---|---|---|
| **≥ 2 periods** with all 3 facts present | Need two points to compute a growth rate at all | `growth.py:historical_cagr` |
| **Earliest period's owner earnings > 0** | A CAGR from a loss-making or zero base is mathematically undefined — the app refuses to guess rather than fabricate a rate | `growth.py:historical_cagr` |
| **Latest period's owner earnings > 0** | Same reasoning, at the other end | `growth.py:historical_cagr` |
| A live share price + share count | To turn total intrinsic value into per-share value, and compute the margin vs. today's price | `holding_valuation.py`, `shares.py` |
| A discount rate (risk-free rate + beta + ERP) | Standard CAPM cost of equity | `discount_rate.py` |

This is deliberate, documented design (CLAUDE.md Rule 1: "fail visibly, never guess") — the
board shows *why* a holding can't be ranked instead of silently inventing a number.

## 2. What's actually missing, live right now

Pulled `GET /valuation/board` (2026-09-27). All 5 holdings fall into exactly two buckets:

### A. Vår Energi (VAR.OL) and Salmon Evolution (SALME.OL) — real companies, real filings

**Reason: `Cannot compute CAGR: earliest period's value is not positive`**

This means these two **do** have ≥2 periods with a complete net_income/D&A/capex set
(unlike group B below) — the problem is the *sign* of the earliest one on file, not missing
data fields. Two different plausible causes, and more `.xhtml` years would only help with
the second one:

1. **Not enough history yet** — if only the 2 most recent years are on file and the older of
   those two happened to be a loss year, fetching further back (Newsweb fetch already goes
   back to ~2022) could surface an earlier *profitable* year to use as the CAGR base instead.
2. **A structurally loss-making earliest year that no amount of "more years" fixes** —
   Salmon Evolution is a young, ramping-up aquaculture producer; its earliest filed years are
   genuinely loss-making (pre-production/ramp-up losses), not a data gap. Vår Energi likely has
   a similar issue around decommissioning charges or a specific bad year (oil price crash,
   heavy capex year). In this case, the CAGR-from-oldest-year method itself is the limiting
   factor, not the data.

**Action to actually find out which one it is:** run Newsweb's "Fetch all annual reports" on
both holdings (already built, not yet clicked against the live site — see progress.md §2),
then check `GET /holdings/{id}/periods` and each period's owner earnings. If a profitable
year now appears at the start of the series, the DCF will work immediately with no code
change. If every year on file is still loss-making, this needs a product decision (see §4).

### B. L&G Gold Mining ETF, Heimdal Utbytte N, Xtrackers Europe Defence Technologies UCITS ETF — funds/ETFs

**Reason: `fewer than two periods with complete owner-earnings inputs (net_income,
depreciation_and_amortization, capital_expenditures)`**

These are **passive funds**, not operating companies — they don't publish an income
statement with net income, D&A or capex at all. **No amount of `.xhtml` annual-report
fetching will ever produce these three facts for a fund**, because they don't exist. A
DCF is the wrong tool for a fund by construction.

This is already recognized in the app: Sprint 8 (F9) built a separate `equity_fund` type
with its own "Fund facts" (typed in or CSV-imported) instead of extracted financials, and
the backlog already lists the real fix:

- **Fund look-through valuation** (backlog, not built) — weighted P/E / earnings yield over
  the fund's *underlying* holdings, which is the only way to get an intrinsic-value-style
  number for a fund
- **Fund annual-report holdings parser** (backlog, not built) — deterministic parser for a
  fund's "schedule of investments" table, which look-through valuation would depend on

Today these 3 show up on the Margin-of-safety board only because they're owned positions —
the board doesn't (and structurally can't) exclude non-DCF-able holdings from its ranking
list, it just marks them `unavailable`.

(Update 2026-09-29: fund look-through valuation was built for Xtrackers and L&G funds, F30/F31.)

## 3. Bottom line

| Holding | Fixable by more `.xhtml` data? | What's actually needed |
|---|---|---|
| Vår Energi | Maybe | Run the Newsweb annual-report fetch (already built) back to 2022; if the earliest year is still a loss, this is a methodology question, not a data gap |
| Salmon Evolution | Unlikely | Same fetch, but its whole filed history may be loss-making (ramp-up company) — likely needs a methodology change, not more data |
| L&G Gold Mining ETF | No | Not a DCF candidate at all — needs Fund look-through valuation (unbuilt backlog item) |
| Heimdal Utbytte N | No | Same — it's tagged as a fund; needs Fund look-through valuation |
| Xtrackers Europe Defence Technologies UCITS ETF | No | Same |

So: **2 of 5 might resolve with the Newsweb fetch you already have** (worth trying first,
zero new work); **3 of 5 can never resolve through annual-report data** because they're
funds, and need the (currently backlog, not built) fund look-through valuation feature
instead.

## 4. If the two equities are still unresolved after fetching more years

Two options, either a build item:

1. **Normalize the CAGR base** — instead of "earliest year on file," use e.g. the earliest
   *profitable* year, or a 3-year trailing average as the base-year owner earnings. Changes
   the DCF's growth-rate methodology (would need a new `valuation_assumptions` version per
   CLAUDE.md Rule 3, and disclosure in the UI about what "growth rate" now means).
2. **Leave the exclusion as-is** — a company whose entire filed history is loss-making
   arguably *shouldn't* get a growth-based intrinsic value from an owner-earnings DCF; a
   different model (e.g. price-to-book, sum-of-the-parts, or asset-based) would be more
   honest for a pre-profitability producer. Not something to silently work around.

Neither is a data-sourcing problem — recommend deciding after actually running the Newsweb
fetch and seeing the real period-by-period owner-earnings numbers.
