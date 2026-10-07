"""v2 siege-simulator settings (game mode G13, 2026-10-07).

What changed from v1, and why: v1 scaled every holding by the vendor's
(Yahoo) beta. That figure exists for ordinary listed stocks and is usually
missing for funds, ETFs and metal ETCs, which in this book are most of the
value, so the Siege page could not judge anything. It is also measured
against a different market (Yahoo uses the S&P 500) than the one a Norwegian
book cares about.

v2 measures every holding the same way, from data the app already stores:
its own daily closes (converted to NOK) against one benchmark (OSEBX),
looking only at the days the benchmark fell, because the page models a fall.
The vendor beta is kept as a fallback for a holding whose price history is
too short, and is labelled as such. Nothing is defaulted: a holding with
neither stays "not modelled".

The slider, coverage rule and reverse-search step are copied from v1 unchanged.

The numbers below are statistical sample-size floors and a window length, not
predictions about markets:
- 730 days: the longest daily history the vendor serves in practice.
- At least 120 aligned daily returns (about half a year) and at least 40 of
  them on days the benchmark fell: fewer than that and a slope is mostly noise.
- A fit with R-squared below 0.10 is shown with a caution: the benchmark
  explains under a tenth of that holding's moves on those days.
- If 30% or more of a holding's daily prices did not change, the price is
  probably a slowly updating NAV, which pulls a measured beta towards zero;
  the row carries a caution instead of hiding that.

CLAUDE.md Rule 3: once these numbers have been shown for real, a change is a
new `siege_scenarios_v3.py`, not an edit of this file.
"""
from __future__ import annotations

from decimal import Decimal

from app.domain.game_mapping.siege_scenarios_v1 import (
    SIEGE_SCENARIOS_V1,
    SiegeScenarios,
)

SIEGE_SCENARIOS_V2 = SiegeScenarios(
    version="v2",
    drop_min=SIEGE_SCENARIOS_V1.drop_min,
    drop_max=SIEGE_SCENARIOS_V1.drop_max,
    drop_step=SIEGE_SCENARIOS_V1.drop_step,
    drop_default=SIEGE_SCENARIOS_V1.drop_default,
    min_beta_coverage=SIEGE_SCENARIOS_V1.min_beta_coverage,
    reverse_search_step=SIEGE_SCENARIOS_V1.reverse_search_step,
    sensitivity_method="benchmark_downside_beta",
    benchmark_ticker="OSEBX.OL",
    history_lookback_days=730,
    min_observations=120,
    min_down_days=40,
    weak_fit_r_squared=Decimal("0.10"),
    flat_share_warning=Decimal("0.30"),
)
