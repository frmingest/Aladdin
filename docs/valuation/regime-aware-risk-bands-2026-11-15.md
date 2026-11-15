# Regime-aware risk bands (ECON-007), 2026-11-15

**Status:** written and tested on a local SQLite stack, **not merged, not deployed**, off by default.
Issue #392. Faiz left the reading of "regime-aware risk bands" to me; this is the one I chose.

## What it does

The Portfolio risk page shows a stress scenario: what each holding could lose over about a month.
For holdings without their own DCF bear case (funds, ETFs, stocks with no DCF) that shock is
2 standard deviations of the holding's daily returns, scaled to 20 trading days.

When the switch is on, that number is widened by the current macro regime
(baseline / stagflation / crisis, `app/services/risk/regime.py`):

| Regime | Multiplier | Shock at the default 2 sigma |
|---|---|---|
| baseline | x1.00 | 2.0 sigma (same as before) |
| stagflation | x1.25 | 2.5 sigma |
| crisis | x1.50 | 3.0 sigma |

The multipliers are judgment calls, not fetched data. They live in a versioned file
(`app/domain/risk_bands/v1.py`); change them with a v2, never by editing v1 (CLAUDE.md rule 3).

## What it does not do

- Holdings sized from their own DCF bear case are **not** widened: that number is company-specific
  downside, not a statistical band.
- The correlated-cluster threshold (0.6) is **not** regime-dependent in v1.
- A regime never makes the stress gentler than baseline (multipliers are at least 1).
- No LLM is involved; the arithmetic is deterministic code (rule 1).

## Turning it on

Off by default, like the regime-adjusted DCF (a change to a number you already read is your call).
Set `REGIME_AWARE_RISK_BANDS_ENABLED=true` on the Railway backend service and redeploy.
The Risk page is served from a stored snapshot, so press **Refresh** on it once (or wait for the
04:00 UTC rebuild) before the change shows. When the regime is stagflation or crisis, the stress
heading's hint says how much it was widened; the API (`GET /risk/portfolio`, `stress`) also returns
`regime`, `base_std_devs`, `band_multiplier` and `bands_version` (empty when the switch is off).

## Where

`app/domain/risk_bands/` (new, versioned), `Settings.regime_aware_risk_bands_enabled` and
`active_risk_bands_version`, `app/services/risk/portfolio_risk.py` (classifies the regime first and
passes the widened std-devs to `compute_stress`), `app/schemas/risk.py` and `app/api/risk.py` (new
optional fields, so older stored snapshots still load).

## How it was checked

Backend tests: 2 unit tests on the versions, 3 API tests (off by default changes nothing; crisis
multiplies each volatility shock by 1.5 within 4-decimal rounding; baseline records the regime and
changes nothing). Not run against the live app or real macro data.
