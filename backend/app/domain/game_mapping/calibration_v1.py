"""v1 Calibration ledger settings (game mode C2 "hit rate", 2026-10-14).

Faiz decided on 2026-10-14 that a hit rate may be shown, with limits. This
amends the Sprint 25 "no hit rate" rule for this one view only:

- Nothing is shown as a ratio until there are `min_n` decisions (or analyst
  runs) with a 6- or 12-month outcome. Before that the view says "too few so
  far" and gives the count.
- A ratio is always printed with its count ("5 of 8"), never alone.
- A confidence band (1 to 5) is only split out with `min_band_n` decisions.
- No score, streak, badge or reward, and the result never changes a verdict,
  a tower or any other page.

CLAUDE.md Rule 3: once these numbers have been shown for real, a change is a
new `calibration_v2.py`, not an edit of this file.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CalibrationRules:
    version: str
    min_n: int
    min_band_n: int
    horizons_days: tuple[tuple[int, int], ...]
    """(months, days) pairs, longest last. Same day counts as the journal reviews."""


CALIBRATION_V1 = CalibrationRules(
    version="calibration-v1",
    min_n=8,
    min_band_n=3,
    horizons_days=((6, 182), (12, 365)),
)


def get_calibration_rules(version: str = "v1") -> CalibrationRules:
    if version in ("v1", "calibration-v1"):
        return CALIBRATION_V1
    raise ValueError(f"unknown calibration rules version: {version}")
