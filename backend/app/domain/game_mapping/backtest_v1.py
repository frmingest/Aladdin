"""v1 Siege back-test settings (game mode C1, 2026-10-13).

The back-test asks of the Siege Simulator's own method: "in the worst fall of
the benchmark inside the stored price history, would the number the page gives
have been close to what each holding really did?" It is a check on the page,
not a forecast and not advice.

What it does, in plain terms:
- finds the benchmark's worst peak-to-trough fall inside the stored window
  (the same window and benchmark as the active siege scenarios);
- for each holding, measures the Siege beta *without* the days of that fall
  (so the page is not marking its own homework), predicts the holding's fall
  as beta x the benchmark's fall, and sets it beside what the holding's
  stored NOK closes actually did between the same two dates;
- replays today's weights through the stored history at constant weights
  (a backcast, not a record of what Faiz held) for a worst fall and the
  number of days spent below an earlier high.

The numbers below are tolerances for reading the result, not predictions:
- 10%: a benchmark fall smaller than this is shown but marked small, because
  the gap between predicted and actual is mostly noise on a quiet stretch.
- 5 percentage points: a holding whose actual fall is within this of the
  predicted one is "close"; further out it is "fell more" or "fell less".
- 2 holdings: a book backcast on one holding is just that holding.

CLAUDE.md Rule 3: once these numbers have been shown for real, a change is a
new `backtest_v2.py`, not an edit of this file.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class BacktestRules:
    version: str
    significant_fall: Decimal
    close_points: Decimal
    min_book_holdings: int


BACKTEST_V1 = BacktestRules(
    version="v1",
    significant_fall=Decimal("0.10"),
    close_points=Decimal("0.05"),
    min_book_holdings=2,
)


def get_backtest_rules(version: str) -> BacktestRules:
    versions = {"v1": BACKTEST_V1}
    try:
        return versions[version]
    except KeyError as exc:
        raise ValueError(f"Unknown siege back-test version: {version!r}") from exc
