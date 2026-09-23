"""Watchlist rows (feature F7): price vs. your buy-below price and vs. the
DCF value, for companies you follow.

The valuation is Sprint 3's `compute_holding_valuation`, unchanged and with
the same staleness cache the margin-of-safety board uses. When it has no
DCF (no financials on file yet) the price comes from the same cached quote
service on its own. CLAUDE.md Rule 1:
the only arithmetic added here is the distance from the price to the
buy-below price.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.holding import Holding
from app.models.watchlist import WatchlistItem
from app.providers.base import MarketDataProvider, RiskFreeRateProvider
from app.services.analysis.latest import latest_runs_by_holding, run_ratings
from app.services.market_data.price import get_or_refresh_price
from app.services.valuation.board import current_positions
from app.services.valuation.holding_valuation import compute_holding_valuation

HUNDRED = Decimal(100)
NEAR_BUY_PCT = Decimal(10)
"""Within this many percent above the buy-below price counts as "near"."""

# Where the price is relative to your buy-below price.
BUY_ZONE = "buy_zone"  # price <= buy-below
NEAR = "near"  # within NEAR_BUY_PCT above
ABOVE = "above"
NO_TARGET = "no_target"  # no buy-below price set
NO_PRICE = "no_price"
CURRENCY_MISMATCH = "currency_mismatch"


@dataclass
class WatchlistRow:
    id: uuid.UUID
    holding_id: uuid.UUID
    ticker: str
    name: str
    sector: str | None
    instrument_type: str
    owned: bool
    buy_below_price: Decimal | None
    buy_below_currency: str | None
    notes: str | None
    added_at: datetime
    price: Decimal | None = None
    price_currency: str | None = None
    price_as_of: datetime | None = None
    distance_to_buy_pct: Decimal | None = None
    """(price / buy-below - 1) x 100. Negative = below your buy price."""
    status: str = NO_TARGET
    dcf_base: Decimal | None = None
    margin_of_safety_base: Decimal | None = None
    """Fraction, same convention as the margin-of-safety board."""
    verdict_rating: str | None = None
    moat_rating: str | None = None
    analyzed_at: datetime | None = None
    unavailable_reason: str | None = None


def price_status(
    price: Decimal | None, price_currency: str | None, target: Decimal | None, target_currency: str | None
) -> tuple[str, Decimal | None]:
    if target is None:
        return NO_TARGET, None
    if price is None:
        return NO_PRICE, None
    if target_currency and price_currency and target_currency != price_currency:
        return CURRENCY_MISMATCH, None
    if target <= 0:
        return NO_TARGET, None
    distance = (price / target - 1) * HUNDRED
    if price <= target:
        return BUY_ZONE, distance
    if distance <= NEAR_BUY_PCT:
        return NEAR, distance
    return ABOVE, distance


def build_row(item: WatchlistItem, holding: Holding, *, owned: bool) -> WatchlistRow:
    return WatchlistRow(
        id=item.id,
        holding_id=holding.id,
        ticker=holding.ticker,
        name=holding.name,
        sector=holding.sector,
        instrument_type=holding.asset_class_raw,
        owned=owned,
        buy_below_price=item.buy_below_price,
        buy_below_currency=item.buy_below_currency,
        notes=item.notes,
        added_at=item.added_at,
    )


def build_watchlist(
    db: Session,
    *,
    market_data_provider: MarketDataProvider,
    risk_free_rate_provider: RiskFreeRateProvider,
) -> list[WatchlistRow]:
    items = db.scalars(select(WatchlistItem)).all()
    if not items:
        return []
    holdings = {h.id: h for h in db.scalars(select(Holding).where(Holding.id.in_([i.holding_id for i in items])))}
    owned_ids = {p.holding_id for p in current_positions(db)}
    runs = latest_runs_by_holding(db, list(holdings))

    rows: list[WatchlistRow] = []
    for item in items:
        holding = holdings[item.holding_id]
        row = build_row(item, holding, owned=holding.id in owned_ids)
        valuation = compute_holding_valuation(db, holding, market_data_provider, risk_free_rate_provider)
        row.price = valuation.current_price_per_share
        row.price_currency = valuation.valuation_currency
        row.price_as_of = valuation.as_of
        if valuation.dcf is not None:
            row.dcf_base = next(
                (s.intrinsic_value_per_share for s in valuation.dcf.scenarios if s.label == "base"), None
            )
            row.margin_of_safety_base = valuation.dcf.margin_of_safety("base")
        if row.price is None:
            # No DCF yet (a newly watched company rarely has financials on
            # file), so the valuation stopped before fetching a price. The
            # buy-below check only needs the quote itself.
            quote = get_or_refresh_price(db, market_data_provider, holding=holding)
            if quote.available and quote.value is not None:
                row.price, row.price_currency, row.price_as_of = quote.value.price, quote.value.currency, quote.as_of
            else:
                row.unavailable_reason = quote.reason
        row.status, row.distance_to_buy_pct = price_status(
            row.price, row.price_currency, item.buy_below_price, item.buy_below_currency
        )
        if holding.id in runs:
            row.verdict_rating, row.moat_rating, row.analyzed_at = run_ratings(runs[holding.id])
        rows.append(row)

    order = {BUY_ZONE: 0, NEAR: 1, ABOVE: 2, CURRENCY_MISMATCH: 3, NO_PRICE: 4, NO_TARGET: 5}
    rows.sort(key=lambda r: (order[r.status], r.distance_to_buy_pct if r.distance_to_buy_pct is not None else 0, r.name))
    return rows
