"""v1 Blindfold Years settings (game mode E1, 2026-10-15).

Blindfold Years rolls one holding back to a past fiscal year with its name
masked, shows only what was filed up to then, and asks you to stake a low and
a high figure for the NEXT year's owner earnings. The stored real figure is
revealed afterwards. It is practice, not measurement.

Rules this file fixes (docs/sprints/game-design-sprint-plan-2026-10-15.md, E1):

- A puzzle needs `min_prior_years` complete annual periods before the year
  shown, plus the year shown, plus the next year. "Complete" means owner
  earnings can be computed, one currency, and no data-quality flag. A missing
  or flagged year means that puzzle is never offered (unknown stays fog).
- Banks and insurers never appear (owner earnings do not describe them).
- The stake range is read off the years shown only, so the slider cannot give
  the answer away (`domain_padding`).
- A tally is only a ratio from `min_n` puzzles, always printed with its count
  ("5 of 8"); there is no grade, streak or trend arrow.
- Nothing here is typed text and nothing here reaches the blind pass.

CLAUDE.md Rule 3: once these puzzles have been shown for real, a change is a
new `blindfold_v2.py`, not an edit of this file.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class BlindfoldRules:
    version: str
    min_prior_years: int
    """Complete annual periods that must precede the last year shown."""
    min_n: int
    """Puzzles answered before a tally is shown as a ratio."""
    range_confidence_pct: int
    """What the staked range is meant to cover (an 80% range)."""
    domain_padding: Decimal
    """Fraction of the shown years' span added each side of the stake slider."""
    width_narrow_pct: Decimal
    width_wide_pct: Decimal
    """Range width as a percent of last year's |owner earnings|: below narrow is
    "narrow", above wide is "wide", else "medium"."""


BLINDFOLD_V1 = BlindfoldRules(
    version="blindfold-v1",
    min_prior_years=3,
    min_n=8,
    range_confidence_pct=80,
    domain_padding=Decimal("0.5"),
    width_narrow_pct=Decimal(25),
    width_wide_pct=Decimal(60),
)


def get_blindfold_rules(version: str = "v1") -> BlindfoldRules:
    if version in ("v1", "blindfold-v1"):
        return BLINDFOLD_V1
    raise ValueError(f"unknown blindfold rules version: {version}")
