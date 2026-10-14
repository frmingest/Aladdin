"""Plausibility flags for stored market data (2026-10-14,
claude/price-split-data-fixes-2026-10-14.md): a figure that is likely to
mislead is flagged next to the number, never silently corrected."""
from __future__ import annotations

from collections.abc import Sequence
from decimal import Decimal

from app.models.market import StockSplit
from app.services.market_data.splits import describe_ratio

# A move this large between two consecutive stored prices is unusual enough
# to be worth a look (a data error, a currency change, or a split).
PRICE_JUMP_THRESHOLD = Decimal("0.25")
# How close a price ratio must be to a whole split ratio to read as a split.
SPLIT_MATCH_TOLERANCE = Decimal("0.05")
MAX_SPLIT_GUESS = 20


def _guess_split(ratio: Decimal) -> Decimal | None:
    """`ratio` = new price / old price. A split of N-for-1 divides the price
    by N (ratio 1/N); a 1-for-N reverse split multiplies it by N."""
    for n in range(2, MAX_SPLIT_GUESS + 1):
        divided = Decimal(1) / Decimal(n)
        if abs(ratio / divided - 1) <= SPLIT_MATCH_TOLERANCE:
            return Decimal(n)
        if abs(ratio / Decimal(n) - 1) <= SPLIT_MATCH_TOLERANCE:
            return Decimal(1) / Decimal(n)
    return None


def price_jump_note(
    previous: Decimal, new: Decimal, *, known_splits: Sequence[StockSplit] = ()
) -> str | None:
    """A plain sentence when `new` is far from `previous`, else None. A
    jump that a split on file explains is not flagged."""
    if previous <= 0 or new <= 0:
        return None
    change = new / previous - 1
    if abs(change) < PRICE_JUMP_THRESHOLD:
        return None
    factor = Decimal(1)
    for split in known_splits:
        factor *= split.ratio
    if factor != 1 and abs((new * factor) / previous - 1) <= SPLIT_MATCH_TOLERANCE:
        return None
    text = f"price moved {change:+.0%} since the previous stored price ({previous:.2f} to {new:.2f})"
    guess = _guess_split(new / previous)
    if guess is not None:
        return (
            f"{text}; that is what a {describe_ratio(guess)} split looks like and none is on file, "
            "so per-share figures from before it may not match this price"
        )
    return f"{text}; check it is not a data error before trusting margin of safety"
