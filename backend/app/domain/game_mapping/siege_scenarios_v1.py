"""v1 siege-simulator settings (game mode G13, 2026-10-03).

The Siege Simulator is a what-if, never a forecast. The only number the user
chooses is the size of a market fall; everything else is stored data (each
holding's stored beta and value) or an existing game threshold (the
gathering / besieged lines in `game_mapping/v1.py`). Nothing here is a
prediction and no scenario percentage is invented: the slider range is a
convenience for the reader, not a claim about likelihood.

CLAUDE.md Rule 3: once these numbers have been shown for real, a change is a
new `siege_scenarios_v2.py`, not an edit of this file.

Why these values:
- Slider 5% to 60% in 5-point steps, starting at 20%: wide enough to include
  an ordinary correction (about 10%) and a 2008- or 2020-sized fall, narrow
  enough that every step is a different picture.
- Beta coverage of at least 50% of the equity value: with less than half the
  book carrying a stored beta, a portfolio total would describe the covered
  half only, so the result is "cannot judge" instead of a number.
- Reverse search (the fall that reaches a line) is scanned in 0.1-point steps.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class SiegeScenarios:
    version: str
    drop_min: Decimal
    drop_max: Decimal
    drop_step: Decimal
    drop_default: Decimal
    min_beta_coverage: Decimal
    reverse_search_step: Decimal


SIEGE_SCENARIOS_V1 = SiegeScenarios(
    version="v1",
    drop_min=Decimal("0.05"),
    drop_max=Decimal("0.60"),
    drop_step=Decimal("0.05"),
    drop_default=Decimal("0.20"),
    min_beta_coverage=Decimal("0.50"),
    reverse_search_step=Decimal("0.001"),
)

_VERSIONS: dict[str, SiegeScenarios] = {"v1": SIEGE_SCENARIOS_V1}


def get_siege_scenarios(version: str) -> SiegeScenarios:
    try:
        return _VERSIONS[version]
    except KeyError as exc:
        raise ValueError(f"Unknown siege scenarios version: {version!r}") from exc
