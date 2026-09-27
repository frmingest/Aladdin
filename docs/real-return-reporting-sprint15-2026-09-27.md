# Real (CPI-deflated) return reporting on Performance (Sprint 15 quarterly-review plan, item #2)

Built 2026-09-27, committed and pushed, not yet confirmed live.

## 1. Why

The 2026-09-26 economic/mathematical review (`sprint15-plan-and-quarterly-review-2026-09-26.md` §1)
flagged that Sprint 13's Performance page reports nominal NOK returns only — a reviewer checking
"investment-grade" claims would ask about real (inflation-adjusted) returns first, and the macro
catalogue (Sprint 7) already stores the CPI series needed to answer that cheaply. This was item #2
in the quarterly-review Sprint 15 plan (§2.1), ranked highest value-per-effort because it needed no
new data provider and no migration.

## 2. What it does

Alongside the existing nominal cumulative-return series, each covered day on `GET
/performance/portfolio` now also carries a `real_return_pct` — the same reindexed NOK series
deflated by Norway CPI (the `no_cpi_yoy` catalogue series' raw index level, `app/domain/macro_series.py`):

```
nominal_growth = value_nok(day) / value_nok(full_coverage_from)
cpi_growth     = cpi_index(day) / cpi_index(full_coverage_from)
real_growth    = nominal_growth / cpi_growth
real_return_pct = (real_growth - 1) * 100
```

Norway CPI was chosen over US CPI because the portfolio itself is NOK-denominated and largely
Oslo-listed — the same reasoning already used for the OSEBX.OL benchmark default.

## 3. Reuse, not reimplementation

No new table, no migration, no new data provider. `app/services/macro/refresh.py`'s
`stored_points(db, "no_cpi_yoy", since=...)` is read directly — this feature **never fetches CPI
itself**; that stays the Macro page's own refresh (background loop, pre-analysis refresh, or the
"Refresh data" button). If no CPI observation has ever been stored (a fresh deployment before the
first Macro refresh), the real-return series is simply reported unavailable with a stated reason,
never guessed or interpolated. The CPI index is forward-filled onto the exact same business-day
axis `_forward_fill` already builds for price and FX history — no second reindexing method.

## 4. Fail-visibly paths

- **No CPI data at all**: `real_return_available=False`, reason names the missing observation and
  suggests a Macro refresh.
- **CPI data exists but is all dated after `full_coverage_from`**: no anchor point to deflate
  from — same unavailable path, different reason.
- **CPI data covers the anchor but a day later in the window predates the first CPI point somehow**
  (shouldn't happen with a monotonic axis, but handled): that individual day's `real_return_pct`
  stays `None` even while `real_return_available=True` for the rest of the series.

## 5. What ships

- **Backend**: `app/services/performance/portfolio_performance.py` (CPI fetch + deflation math),
  `app/schemas/performance.py` + `app/api/performance.py` (new fields: `real_return_pct` per day,
  `real_return_available`, `real_return_reason`, `cpi_region`, `real_return_note`),
  `app/services/settings/synthetic_data.py` (demo-mode payload updated for the new fields).
- **Frontend**: `PerformancePage.tsx` — a "Real total return" stat tile (the most recent day's
  `real_return_pct`), a checkbox toggle above the chart ("Show real (CPI-adjusted) return",
  disabled with the stated reason when unavailable), and a dashed line on the existing
  cumulative-return chart when toggled on. `types.ts` updated to match.

## 6. Tests

4 new backend tests: 2 unit (`test_portfolio_performance.py` — exact CPI deflation math against a
flat nominal series so the expected figure is computable by hand; both "no CPI data" and "CPI too
recent to anchor" unavailability paths) and 2 integration (`test_performance_api.py` — the new
fields round-trip through the API, both with and without stored CPI data).

Full backend suite: **924 passed**, same 2 pre-existing environment-only failures
(`test_factory.py`'s LLM provider default, depends on local `.env`'s `LLM_PROVIDER`, unrelated to
this change). tsc/eslint/vitest(19)/production build all clean.

**Not run against real Postgres or real stored CPI data** — no schema change, so there's no
migration to verify, but the toggle itself hasn't been exercised against a real deployed database
with actual Norges Bank/SSB-sourced CPI observations yet.

## 7. Open for Faiz

- **Try the toggle**: open **Performance**, tick "Show real (CPI-adjusted) return". If it's greyed
  out, run **Macro → Refresh data** first (needs at least one stored Norway CPI observation).
- Confirm Norway CPI is the right deflator — the alternative (US CPI, already in the same
  catalogue) is a one-line change (`CPI_SERIES_KEY` in `portfolio_performance.py`) if a US-CPI view
  ever matters more than the NOK-purchasing-power one built here.
- The rest of the quarterly-review Sprint 15 plan (LLM usage ledger, rate sensitivity per holding,
  Norway yield-curve/credit-spread sourcing, nightly tripwire check, PDF export) is still open — see
  `sprint15-plan-and-quarterly-review-2026-09-26.md` §2.1.
