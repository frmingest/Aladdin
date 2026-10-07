"""v4 valuation assumptions (2026-10-07): normalised earnings for volatile histories.

Identical to v3 in every market input and guardrail. The only change is the
DCF's starting point when owner earnings are uneven across the filed years.
v3 started from the latest year and extrapolated the endpoint-to-endpoint
growth rate of the latest profitable run. For a cyclical or one-off-driven
history that is not a forecast, and it produced two kinds of useless answer
on the margin-of-safety board:

- Equinor and Telenor: owner earnings fell from a windfall year (FY2022) to a
  trough, so the "growth rate" was -35% to -40% a year, projected for ten
  years: a DCF at 5-10% of the share price, withheld as implausible.
- Aker Solutions: a depressed FY2021 base made the growth 58% a year, and a
  light-capex FY2025 flattered the starting point: a DCF at 3.7x the price,
  also withheld.

v4 follows the usual practice for cyclical earners (Graham's multi-year
average, Damodaran's normalised earnings): when the latest five fiscal years
of owner earnings are volatile, the DCF starts from their MEDIAN (a median,
so one windfall or disposal gain does not lift the base) and grows it at the
terminal rate, with no extrapolated trend. When they are stable, v3's
behaviour is unchanged (latest year, growth over the profitable run, capped at
10% and faded), so a steady compounder is not marked down.

- normalisation window 5 years, minimum 3 years of complete inputs, else v3.
- volatile = any year above 2x the median or below half of it (a loss year
  always counts).

CLAUDE.md Rule 3: do not edit these numbers once a real analysis has used
them. Add v5.py instead.
"""
from __future__ import annotations

from dataclasses import replace
from decimal import Decimal

from app.domain.valuation_assumptions.v3 import VALUATION_ASSUMPTIONS_V3

VALUATION_ASSUMPTIONS_V4 = replace(
    VALUATION_ASSUMPTIONS_V3,
    version="v4",
    base_earnings_method="normalised_median",
    normalisation_window_years=5,
    normalisation_min_years=3,
    normalisation_dispersion=Decimal(2),
)
