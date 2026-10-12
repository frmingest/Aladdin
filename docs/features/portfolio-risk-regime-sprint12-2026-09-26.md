# Sprint 12: portfolio risk & regime intelligence (2026-09-26)

Backlog item "Portfolio risk and regime intelligence" (correlation, drawdown scenarios, rebalancing
flags) — built fresh against the current, post-reset codebase. A pre-reset version of this idea
existed (`phase10-portfolio-risk-and-regime-rigor.md`, 2026-09-15) but its code was wiped in the
2026-09-21 clean-slate rebuild; this sprint does not resurrect that code, it's a new build informed
by that doc's findings.

**Status:** built and committed locally this session, on top of Sprint 11 — **not pushed, not
deployed.**

---

## 1. What you get

| Capability | What it does |
|---|---|
| **Correlation matrix** | Real Pearson correlation from actual fetched historical daily prices (1-year lookback) across owned equity/equity-fund holdings — not a sector-based proxy |
| **Correlated risk cluster flag** | Among the 10 largest positions by weight, flags when two or more are both large **and** highly correlated (\|r\| ≥ 0.6), naming the holdings and their correlation |
| **Drawdown / stress scenarios** | Portfolio-level estimated drawdown + per-holding contribution. Sized from the holding's own DCF bear case when one exists, otherwise 2σ of historical daily returns scaled to a 20-trading-day horizon (√time scaling) |
| **Regime classification** | baseline / stagflation / crisis from `us_hy_spread`, `us_10y_2y`, `us_cpi_yoy`, `no_cpi_yoy` (Norway's own CPI via SSB, not just a US signal), smoothed over a 3-month rolling average so one noisy print can't flip it |
| **New page** | `Portfolio risk` (nav) — matrix, cluster flags, stress numbers, regime + a plain-English note on what it means |
| **Dashboard** | New card/link to Portfolio risk |

**Honesty on regime coverage:** the yield-curve and credit-spread legs are necessarily US-only — no
Norges Bank equivalent exists in the macro catalogue (`app/domain/macro_series.py`) yet. The output
says so explicitly (`curve_and_credit_are_us_only: true`). CPI genuinely uses Norway's own series
when relevant (`home_market_series_included: true`), so this isn't a pure US proxy dressed up as a
NOK-portfolio signal — but it's not fully home-market either. Closing that gap needs a Norwegian
yield-curve/credit-spread data source, which isn't in the free-data list yet (§3d of `progress.md`).

**Deliberately not done:** regime is surfaced as new information only. It is **not** wired into DCF
factor weighting — that would be a real behavior change to every valuation in the app, and is
Faiz's call, not something to switch on silently in the same sprint that introduces the signal.

---

## 2. Methodology (so the numbers are checkable)

| Choice | Value | Why |
|---|---|---|
| Correlation lookback | 365 days of daily returns, per-pair overlapping trading days (not a naive zip) | A full year smooths short-term noise; per-pair overlap handles holdings with different listing/upload histories |
| Minimum data | 30 price points per ticker, 40 overlapping days per pair | Below this, a "correlation" is mostly noise — excluded with a stated reason instead of a misleading number |
| Cluster threshold | \|r\| ≥ 0.6, among the 10 largest holdings by weight | Named constant in `app/config/settings.py` — easy to retune |
| Stress sizing | DCF bear price when the holding has a completed analysis; else 2σ of daily returns × √20 (20-trading-day horizon) | Ties the shock to real analysis output where one exists, falls back to the holding's own realized volatility rather than an arbitrary illustrative percentage everywhere else |
| Regime smoothing | 3-month rolling average of the underlying indicator snapshots (already stored monthly), no new persisted state machine | Stateless — reuses `IndicatorSnapshot.history` rather than adding a table just to remember "which side we were on last time" |

---

## 3. What was actually built

**Backend** (commit `612bc5a`): `app/models/risk.py`, `app/schemas/risk.py`, `app/api/risk.py`,
`app/services/risk/{__init__,price_history,correlation,stress,regime,portfolio_risk}.py`; migration
`a3f5c8d1e942_price_history_observations` (down-revision `c7a1e9f3b2d5`, additive — new table
`price_history_observations`, a cache so a year of daily prices per holding isn't refetched from
yfinance on every request); edits to `app/services/calculations.py`, `app/providers/base.py`,
`app/providers/yfinance_provider.py`, `app/config/settings.py`, `app/models/__init__.py`,
`app/main.py`; 6 new test files.

**Frontend** (commit `cab8272`): new `pages/PortfolioRiskPage.tsx`; edits to `App.tsx`,
`components/Layout.tsx`, `pages/DashboardPage.tsx`, `lib/api.ts`, `lib/types.ts`.

---

## 4. Tests — what was actually run today

| | |
|---|---|
| Backend | **29 new tests** (calculations 9, correlation 7, stress 4, regime 6, price-history cache 6, integration API 3), all passing. Full suite: **832 passed, 3 failed** — the same 3 pre-existing local-`.env`-related failures from before Sprint 11/12 (verified via `git stash`), unrelated to this work |
| Ruff | Zero new real findings (two unsorted-import + one verbose-`Decimal` fix applied). Remaining `EXE002` findings (283, executable-file-no-shebang) are repo-wide and pre-existing — a mount-permissions artifact, not introduced here |
| Frontend | `tsc --noEmit`, `eslint`, `vitest` (19 pre-existing, unchanged), `vite build` — all clean. No new frontend tests: no new pure `src/lib/*.ts` logic was added (risk math is backend-only) |
| Migration | Verified up→down→up on **SQLite** only (no local Postgres in the build sandbox); `alembic heads` shows one head. CI runs the real Postgres 16 check on push. **Faiz: verify on real Postgres before trusting in production**, same caveat as Sprint 11's migration |

---

## 5. Try it (after push + redeploy + migration)

1. Open **Portfolio risk** in the nav.
2. Check the correlation matrix against holdings you know should move together (e.g. two energy
   names) — does it look right?
3. Look at the cluster flag, if any — does the named pair/group match your own sense of concentrated
   co-movement risk?
4. Check the current regime and its inputs — plausible given today's actual rates/CPI/spreads?
5. Tell me if the |r| ≥ 0.6 cluster threshold or the 2σ/20-day stress sizing feel too aggressive or
   too tame.

## 6. Not done (backlog, unblocked or informed by this sprint)

| Item | Note |
|---|---|
| Norway-specific yield curve / credit spread | Needs a data source (Norges Bank doesn't publish an equivalent free series today) |
| Regime → DCF factor-weight wiring | Explicitly deferred — a real valuation-behavior change, Faiz's call |
| Liquidity tier for illiquid alternative assets (whisky, physical metals) | From the old Phase 10 notes; not addressed this sprint |
| Benchmark-relative / real (inflation-adjusted) return reporting | From the old Phase 10 notes; not addressed this sprint |
