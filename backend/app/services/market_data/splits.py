"""Share splits: keep per-share figures on one basis (2026-10-14,
claude/price-split-data-fixes-2026-10-14.md).

A filing reports shares and EPS as they stood at its date. After a 5-for-1
split today's price is a fifth of what it was, but an older year's share
count is still the old, smaller one, so "old shares x today's price" is a
market cap five times too small (Kongsberg 2024: the EPS-implied share
count jumped 5.0x between FY2023 and FY2024). The split history is stored
(`stock_splits`, filled from the market data provider when a price is
refreshed) and the older figure is restated to the price's basis where the
two are compared. All arithmetic here is deterministic (CLAUDE.md rule 1).
"""
from __future__ import annotations

import math
import uuid
from collections.abc import Sequence
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.holding import Holding
from app.models.market import StockSplit
from app.providers.base import MarketDataProvider, MarketDataUnavailableError

ONE = Decimal(1)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def describe_ratio(ratio: Decimal) -> str:
    """5 -> "5-for-1", 0.1 -> "1-for-10 reverse split"."""
    if ratio >= 1:
        return f"{ratio.normalize():f}-for-1"
    return f"1-for-{(ONE / ratio).normalize():f} reverse split"


def splits_for(db: Session, holding_id: uuid.UUID) -> list[StockSplit]:
    rows = db.scalars(
        select(StockSplit).where(StockSplit.holding_id == holding_id).order_by(StockSplit.ex_date)
    )
    return list(rows)


def split_factor(
    splits: Sequence[StockSplit], *, after: datetime, up_to: datetime | None = None
) -> Decimal:
    """The product of the ratios of splits with ex-date after `after` and
    (when given) on or before `up_to`: the number to multiply a share count
    from `after` by to get it on the basis of `up_to`. 1 when none."""
    factor = ONE
    after_utc = _aware(after)
    up_to_utc = _aware(up_to) if up_to is not None else None
    for split in splits:
        ex = _aware(split.ex_date)
        if ex > after_utc and (up_to_utc is None or ex <= up_to_utc):
            factor *= split.ratio
    return factor


def restate_shares(
    shares: Decimal, factor: Decimal, *, reference: Decimal | None = None
) -> tuple[Decimal, bool]:
    """(shares on the new basis, whether it was changed). With a
    `reference` count already on the new basis (a later year's), the figure
    is only restated when that moves it closer to the reference; a filing
    that already restated its own comparatives is left alone, so a split is
    never counted twice."""
    if factor == ONE or shares <= 0:
        return shares, False
    restated = shares * factor
    if reference is not None and reference > 0:
        raw_gap = abs(math.log(float(shares) / float(reference)))
        new_gap = abs(math.log(float(restated) / float(reference)))
        if new_gap >= raw_gap:
            return shares, False
    return restated, True


def refresh_splits(db: Session, provider: MarketDataProvider, holding: Holding) -> int:
    """Insert any splits the provider lists that are not on file yet.
    Best effort: a vendor failure or a provider without split data adds
    nothing and never raises (it must not block a price refresh). Returns
    how many were added; the caller commits."""
    fetch = getattr(provider, "get_split_history", None)
    if fetch is None:
        return 0
    try:
        events = fetch(holding.ticker)
    except MarketDataUnavailableError:
        return 0
    known = {_aware(s.ex_date).date() for s in splits_for(db, holding.id)}
    added = 0
    for event in events:
        if _aware(event.ex_date).date() in known:
            continue
        db.add(
            StockSplit(
                holding_id=holding.id,
                ex_date=_aware(event.ex_date),
                ratio=event.ratio,
                provider=provider.name,
            )
        )
        known.add(_aware(event.ex_date).date())
        added += 1
    if added:
        db.flush()
    return added
