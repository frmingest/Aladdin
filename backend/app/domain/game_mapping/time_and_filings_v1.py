"""v1 settings for game mode Sprint 24: Chronicle (G14), Ravens (G15) and
Night Watch (G16), 2026-10-04.

None of these numbers is a prediction or a recommendation. They decide only
how much change is worth a line when two stored readings are compared, and
how long a thing stays "new". CLAUDE.md Rule 3: once shown for real, a change
is a new `time_and_filings_v2.py`, not an edit of this file.

Why these values:
- Chronicle: a position that moved by at least 2 percentage points of the
  portfolio is "resized" (smaller moves are price drift, not news); at most
  120 frames are returned, newest kept, so the payload stays small however
  long the history grows.
- Ravens: a captured report stays "new" for 45 days (about one reporting
  cycle's worth of attention). A measure is only called better or worse when
  it moved by at least the step below; anything smaller is "steady". The
  steps are reading aids, not thresholds of quality: 2 points of margin or
  return, half a turn of leverage, a 15% move in an amount.
- Night Watch: "overnight" is the last 36 hours (a nightly job plus slack for
  a late worker); a watch that has not reported in 36 hours is "old".
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Literal

RavenKind = Literal["points", "multiple", "relative"]
RavenDirection = Literal["higher_better", "lower_better"]


@dataclass(frozen=True)
class RavenMeasure:
    metric: str  # name in services/metrics.py `computed`
    label: str
    kind: RavenKind
    direction: RavenDirection
    min_change: Decimal  # points: fraction (0.02 = 2 pts); multiple: turns; relative: fraction of the old value


@dataclass(frozen=True)
class TimeAndFilingsRules:
    version: str
    # Chronicle
    chronicle_max_frames: int
    resize_min_points: Decimal  # percentage points of the portfolio
    # Ravens
    raven_window_days: int
    raven_measures: tuple[RavenMeasure, ...]
    # Night Watch
    overnight_hours: int
    watch_old_hours: int


TIME_AND_FILINGS_V1 = TimeAndFilingsRules(
    version="v1",
    chronicle_max_frames=120,
    resize_min_points=Decimal(2),
    raven_window_days=45,
    raven_measures=(
        RavenMeasure("roic", "Return on invested capital", "points", "higher_better", Decimal("0.02")),
        RavenMeasure("roe", "Return on equity", "points", "higher_better", Decimal("0.02")),
        RavenMeasure("operating_margin", "Operating margin", "points", "higher_better", Decimal("0.02")),
        RavenMeasure("net_margin", "Net margin", "points", "higher_better", Decimal("0.02")),
        RavenMeasure("net_debt_to_ebitda", "Net debt / EBITDA", "multiple", "lower_better", Decimal("0.5")),
        RavenMeasure("interest_coverage", "Interest cover", "multiple", "higher_better", Decimal("1.0")),
        RavenMeasure("owner_earnings", "Owner earnings", "relative", "higher_better", Decimal("0.15")),
        RavenMeasure("free_cash_flow", "Free cash flow", "relative", "higher_better", Decimal("0.15")),
    ),
    overnight_hours=36,
    watch_old_hours=36,
)

_VERSIONS: dict[str, TimeAndFilingsRules] = {"v1": TIME_AND_FILINGS_V1}


def get_time_and_filings(version: str) -> TimeAndFilingsRules:
    try:
        return _VERSIONS[version]
    except KeyError as exc:
        raise ValueError(f"Unknown time-and-filings version: {version!r}") from exc
