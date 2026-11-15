"""Rules for measuring a holding's own rate and krone sensitivity (Printer P1.5, 2026-11-15).

The Printer's v1 table gives every holding a *sector guess* for how it reacts to long rates and the
krone (Low confidence, so never a krone figure). P1.5 replaces a guess with a measurement, from the
holding's own stored closes (in NOK), only when the history is long enough and the fit is clear.
Everything not measured keeps the sector guess and stays Low.

Method (`printer_sensitivity.py`): weekly returns, one regression per holding

    holding % = a + b_market x benchmark % + b_rate x (change in Norway 10-year yield, pp)
                  + b_krone x (% the krone strengthened against the dollar) + noise

The market term is there so a rate or krone coefficient is not just the market's own move in
disguise; the Printer already carries the market channel through the holding's beta.

CLAUDE.md Rule 3: once these numbers have been shown for real, a change is a new `_v2` file.
"""
from __future__ import annotations

from decimal import Decimal

D = Decimal

VERSION = "v1"

# Weekly closes (last stored close in each ISO week) damp the day-to-day timing noise between exchanges.
LOOKBACK_DAYS = 3 * 365
MIN_WEEKS = 60  # aligned weekly returns needed; fewer and nothing is measured
MIN_ABS_T = D("2")  # a coefficient must be at least this many standard errors from zero
MIN_R_SQUARED = D("0.05")  # the whole fit must explain at least this share of the holding's moves

# A coefficient outside these bounds is a fit artefact, not a sensitivity: it is not used.
MAX_ABS_LONG_RATE = D("25")  # % price change per +1 pp long rate
MAX_ABS_KRONE = D("3")  # % price change per +1% stronger krone vs the dollar

RATE_SERIES = "no_10y"
FX_SERIES = "usd_nok"
BENCHMARK_NOTE = "measured against the same benchmark as the Siege Simulator, in NOK"

MEASURED = "measured"
SECTOR_GUESS = "sector_guess"
