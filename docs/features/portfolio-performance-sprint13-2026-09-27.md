# Sprint 13 — Portfolio performance over time (F13)

Built 2026-09-26/27, committed locally on `E:\Aladdin` (`ed9ea03`), **not pushed**.

## 1. What this is

`GET /performance/portfolio` (+ `POST .../refresh`) — daily portfolio value history and a
benchmark comparison. New **Performance** page, nav entry, dashboard link card.

**The method, stated plainly (and returned in every response's `method_note`):** this reindexes
each holding's *today's* NOK value backward through that ticker's own price history and FX rate
history — "if you had held exactly today's positions the whole time, what would this portfolio
have been worth on each past day". It is **not** a real historical P&L across actual past
buys/sells. `PortfolioSnapshot` only stores point-in-time broker-export uploads, not a continuous
transaction history, so a true buy/sell-aware P&L isn't computable from what's stored today. This
was flagged as a known limitation in the backlog (`claude/progress.md` §3c, "Historical price/FX
and performance") and is the reason this sprint ships an honest approximation rather than
pretending to something the data can't support.

## 2. Reuse, not reimplementation

No new table, no migration. This sprint reuses Sprint 12's `PriceHistoryObservation` cache
(`app/models/risk.py`) and its staleness-checked fetch helper
(`app/services/risk/price_history.py`'s `get_or_refresh_daily_history`) completely as-is — the
table is a plain `(ticker, date) -> close` cache with no notion of what kind of ticker it holds, so
it works unchanged for:

- **Equity/fund tickers** — same as Sprint 12.
- **FX pairs** — yfinance's own convention (`USDNOK=X`, see
  `app/providers/yfinance_provider.py`'s docstring), fetched and cached exactly like a ticker.
- **The benchmark index** — also just a "ticker" to this cache (default `OSEBX.OL`, Oslo Børs
  Benchmark Index, confirmed via Yahoo Finance).

Position value/weight comes from `app/services/portfolio_overview.py`'s `build_overview` — the same
"currently owned" rule as every other view (dashboard, margin-of-safety board, portfolio risk).

## 3. The calculation (`app/services/performance/portfolio_performance.py`)

1. Build a business-day axis over the requested lookback window (30/90/365/730 days from the
   frontend; up to 730 via the API).
2. For each equity/fund holding: fetch daily price history + (if not already NOK) daily FX history
   to NOK, forward-fill both onto the axis (last known close carried forward — never invented).
3. `unit(day) = price(day) * fx(day)`. Each position is reindexed as
   `value_nok(day) = today's_real_value_nok * unit(day) / unit(today)` — anchored to the *real*
   NOK value from the latest portfolio snapshot, not a recomputed one.
4. Sum across holdings per day. A day is `partial` (no return/P&L computed) until **every**
   included holding has data for it — a return computed against an understated starting value would
   be misleading, so the chart isn't truncated to the newest holding's history, but early days are
   marked rather than silently wrong.
5. Benchmark return is computed the same way (plain % return, no FX conversion needed) and
   re-anchored to the later of (full portfolio coverage start, benchmark's own first day) so the two
   series start from a genuine 0%-vs-0% baseline.
6. A holding with no usable price/FX history is excluded with a stated reason (fail-visibly,
   CLAUDE.md) — never guessed, never silently dropped without a trace.

## 4. What ships

- **Backend:** `app/services/performance/portfolio_performance.py`, `app/api/performance.py`,
  `app/schemas/performance.py`. Settings: `performance_lookback_days_default` (365),
  `performance_max_lookback_days` (730), `performance_default_benchmark_ticker` (`OSEBX.OL`).
- **Frontend:** `PerformancePage.tsx` — cumulative-return line chart (portfolio vs. benchmark),
  stat tiles (total return, ending value, best/worst day), a coverage note (how much of the
  portfolio's equity value has usable history, and what's excluded and why), and the method-note
  disclaimer banner up top, not buried. Nav entry ("Performance"), dashboard link card (same
  pattern as Sprint 12's risk card — a year of daily history per holding is heavier than the rest
  of the dashboard, so it's not auto-loaded there).

## 5. Tests

11 new tests (7 unit — `tests/unit/test_portfolio_performance.py`; 4 integration —
`tests/integration/test_performance_api.py`), covering: empty portfolio, flat-price reindexing,
exclusion of a holding with no history, FX conversion (verified against the exact price/FX arrays
used, not hardcoded numbers — the test doesn't assume "today" falls on a business day), the
partial-day flag when holdings have different history lengths, and both the available and
unavailable benchmark paths.

Full backend suite: **844 passed**, 2 pre-existing unrelated failures (`test_factory.py`'s LLM
provider default — depends on local `.env`'s `LLM_PROVIDER`, not touched by this sprint).
tsc/eslint/vitest(19)/build all clean.

**Not run against real Postgres** — no schema change this sprint, so there's no migration to
verify, but the feature itself hasn't been exercised against a real deployed database or real
yfinance data yet.

## 6. Known limitations / open questions for Faiz

- **This is an approximation, not real P&L.** See §1. A true buy/sell-aware P&L needs either a
  continuous transaction ledger (not currently imported) or accepting that snapshot-to-snapshot
  deltas are the best available anchor points — worth a conversation before investing more here.
- **Default benchmark is OSEBX.OL** (Oslo Børs Benchmark Index) — a reasonable default for a
  NOK-denominated, largely Oslo-listed portfolio, but override-able per-request
  (`?benchmark=^GSPC` for the S&P 500, say). Confirm this is the right default, or whether a
  different/blended benchmark makes more sense given the portfolio's actual mix.
- **Non-equity holdings** (whisky, physical metals, bond/money-market funds) are excluded from the
  performance series entirely, same as they're excluded from portfolio risk — no daily price feed,
  no attempt to reindex them.
- Whether it's worth surfacing `covered_pct` more prominently (e.g. a warning banner below some
  threshold) once real portfolio data shows what fraction typically has usable history.
