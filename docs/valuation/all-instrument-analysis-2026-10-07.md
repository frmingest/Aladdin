# Analysis for every instrument type (2026-10-07)

**Status:** written and tested, **not merged, not deployed, not run against the real database, worker or live app.**
Branch `feature/all-instrument-analysis`.

## What you asked for
"Enable me to use all types of equity types with analysis." Scope you chose: unblock the three blocked
types (bond fund, money-market fund, commodity ETC), no new tags. Each gets its own versioned schema and
prompt, run through the same two-pass pipeline (blind, then reconciliation). Typed-in facts cite documents;
all arithmetic is Python.

## Four analysis paths

| Path | Types | Evidence packet | Schema / prompt |
|---|---|---|---|
| stock | stock | `company-v*` (unchanged) | company (unchanged) |
| fund | equity ETF, equity fund | `fund-v*` (unchanged) | fund (unchanged) |
| **income** (new) | bond fund, money-market fund | `income-v1` | `income_v1` |
| **commodity** (new) | commodity ETC | `commodity-v1` | `commodity_v1` |

Income sections: yield and alternatives, credit and rate risk, steward and costs, portfolio construction,
macro stress test, role in portfolio, verdict. Commodity sections: what you own, cost and carry, macro stress
test, role in portfolio, verdict. Neither has a moat field.

## Figures you type in (new table `instrument_facts`)
Each figure must cite a document uploaded to the same holding (decision 23: no LLM reads numbers from PDFs).
- **Income:** yield to maturity, distribution yield, effective duration, average maturity, weighted average
  maturity (days), average credit rating, high-yield share, largest issuer, currency hedging, liquidity note.
- **Commodity:** metal, backing, custodian, redemption right, issuer structure, metal per unit (g), NAV per
  unit, market price per unit, total metal held (tonnes).

Readiness blocks a run with no figures at all and warns when the key ones are missing (income: yield and
duration; commodity: backing and redemption right).

## Deterministic numbers (Rule 1)
Reference yield (YTM, else distribution yield) · fee share of yield · spread to the Norway 3-month T-bill and
10-year yield (only if the fund currency is NOK or unstated) · real yield vs Norway CPI · rate shock
= −duration × Δrate · breakeven rate rise = yield ÷ duration · carry hurdle = (1+r)^n / (1−fee)^n − 1 ·
premium / discount = price ÷ NAV − 1.

## Deliberately unchanged
Board, Risk, Performance and game-mode roll-ups stay equity-only (`EQUITY_ANALYZABLE_TYPES`), so a bond fund
never counts as equity. Game-mode towers for bond funds and the ETC still show "not applicable". The position
table shows the verdict for the new types. No intrinsic-value (DCF) model for these types.

## Verification
Backend: ruff clean, 1,719 passed / 2 skipped (19 new). Migration `t1f2a3b4c5d6` up/down/up on Postgres 16,
single head. Frontend: tsc clean, ESLint 0 errors, 326 tests (3 new), build OK.
**Not verified:** a real analysis run on these holdings (needs Gemini or local LLM).

## After deploy (you)
1. Check the Railway log shows migration `t1f2a3b4c5d6` ran.
2. On each of Alfred Berg Nordic High Yield II R, Heimdal Høyrente Pluss B and Xetra-Gold: upload the fact
   sheet, then type the figures into the new figures card, citing it.
3. Macro → Refresh data, so the T-bill, 10-year and CPI exist.
4. Run the analyses and tell me what reads wrong.
