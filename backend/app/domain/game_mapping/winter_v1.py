"""v1 Winter Rehearsal settings (game mode E2, 2026-10-15).

Winter Rehearsal replays the worst stored fall of the book (today's weights,
held constant through the stored prices) so that you can meet your own written
winter order at the bottom of it. It is a mirror of what is on file, not a
forecast and not advice.

The numbers below only decide when the page says "no real winter":
- 10%: a book fall smaller than this is not shown as a winter. A quiet
  stretch teaches the wrong lesson, so the page says so plainly instead of
  dressing a small dip up as a storm. (Same line as the Siege back-test.)
- 2 holdings: a replay of one holding is just that holding.

CLAUDE.md Rule 3: once these numbers have been shown for real, a change is a
new `winter_v2.py`, not an edit of this file.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class WinterRules:
    version: str
    real_winter_fall: Decimal
    min_holdings: int


WINTER_V1 = WinterRules(
    version="v1",
    real_winter_fall=Decimal("0.10"),
    min_holdings=2,
)


def get_winter_rules(version: str) -> WinterRules:
    versions = {"v1": WINTER_V1}
    try:
        return versions[version]
    except KeyError as exc:
        raise ValueError(f"Unknown winter rehearsal version: {version!r}") from exc
