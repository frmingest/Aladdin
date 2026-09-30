"""Margin-of-safety board (feature F3, Sprint 5).

One row per equity holding you currently own, ranked by how far the
current price sits below (or above) its DCF intrinsic value. Answers the
Buffett question "what's cheap and what's priced for perfection?" across
the whole portfolio at once.

Everything here reuses Sprint 3's valuation exactly as it is
(`compute_holding_valuation`); this module only selects holdings, attaches
position and latest-verdict context, and orders the rows. CLAUDE.md Rule 1:
the only arithmetic done here is summing position values and comparing
the price to already-computed scenario values — no new valuation math.

"Currently owned" = present in the most recent snapshot of each account
(snapshots with no account count as their own group). Only instrument
types the analysis engine accepts (stock, equity ETF) are included; bond,
money-market and commodity positions have no DCF to rank.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.instrument_types import EQUITY_ANALYZABLE_TYPES
from app.models.analysis import EquityAnalysisRun
from app.models.holding import Holding
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.models.watchlist import WatchlistItem
from app.providers.base import MarketDataProvider, RiskFreeRateProvider
from app.services.analysis.latest import latest_runs_by_holding, run_ratings
from app.services.valuation.holding_valuation import compute_holding_valuation

# Where the current price sits relative to the bear/base/bull values.
BELOW_BEAR = "below_bear"
BEAR_TO_BASE = "bear_to_base"
BASE_TO_BULL = "base_to_bull"
ABOVE_BULL = "above_bull"
UNAVAILABLE = "unavailable"


@dataclass
class BoardRow:
    holding_id: uuid.UUID
    ticker: str
    name: str
    sector: str | None
    market_value_nok: Decimal | None
    weight_pct: Decimal | None
    valuation_currency: str | None = None
    price: Decimal | None = None
    price_as_of: datetime | None = None
    bear: Decimal | None = None
    base: Decimal | None = None
    bull: Decimal | None = None
    margin_of_safety_base: Decimal | None = None
    margin_of_safety_bear: Decimal | None = None
    zone: str = UNAVAILABLE
    unavailable_reason: str | None = None
    verdict_rating: str | None = None
    moat_rating: str | None = None
    analyzed_at: datetime | None = None
    # Sprint 14 (2026-09-26): set only when settings.regime_adjusted_dcf_enabled
    # is True (app/services/valuation/holding_valuation.py).
    regime: str | None = None
    regime_discount_rate_addon: Decimal | None = None
    # v2 (2026-09-29): which model produced bear/base/bull, and its status.
    valuation_method: str = "owner_earnings_dcf"
    valuation_status: str = "unavailable"
    # 2026-09-30: only set on watchlist rows (your own buy-below target).
    buy_below_price: Decimal | None = None
    buy_below_currency: str | None = None


@dataclass
class Board:
    rows: list[BoardRow] = field(default_factory=list)
    total_equity_value_nok: Decimal = Decimal(0)
    # 2026-09-30: watchlist companies you do NOT own, ranked the same way but
    # kept apart so they never mix into the portfolio totals or weights.
    watchlist_rows: list[BoardRow] = field(default_factory=list)

    def zone_counts(self) -> dict[str, int]:
        counts = {z: 0 for z in (BELOW_BEAR, BEAR_TO_BASE, BASE_TO_BULL, ABOVE_BULL, UNAVAILABLE)}
        for row in self.rows:
            counts[row.zone] += 1
        return counts


def current_positions(db: Session) -> list[PortfolioPosition]:
    """Positions in the latest snapshot of each account."""
    snapshots = db.scalars(select(PortfolioSnapshot).order_by(PortfolioSnapshot.uploaded_at.desc())).all()
    latest_ids: list[uuid.UUID] = []
    seen_accounts: set[uuid.UUID | None] = set()
    for snapshot in snapshots:
        if snapshot.account_id in seen_accounts:
            continue
        seen_accounts.add(snapshot.account_id)
        latest_ids.append(snapshot.id)
    if not latest_ids:
        return []
    return list(
        db.scalars(select(PortfolioPosition).where(PortfolioPosition.snapshot_id.in_(latest_ids))).all()
    )


def _zone(price: Decimal, bear: Decimal, base: Decimal, bull: Decimal) -> str:
    low, high = min(bear, bull), max(bear, bull)
    if price < low:
        return BELOW_BEAR
    if price <= base:
        return BEAR_TO_BASE
    if price <= high:
        return BASE_TO_BULL
    return ABOVE_BULL


def _attach_verdict(row: BoardRow, run: EquityAnalysisRun | None) -> None:
    if run is None:
        return
    row.verdict_rating, row.moat_rating, row.analyzed_at = run_ratings(run)


def _sort_key(row: BoardRow) -> tuple:
    # Ranked rows first (highest base-case margin of safety on top), then
    # rows with a DCF but no price, then everything unavailable by value.
    if row.margin_of_safety_base is not None:
        return (0, -row.margin_of_safety_base, row.ticker)
    if row.base is not None:
        return (1, Decimal(0), row.ticker)
    return (2, -(row.market_value_nok or Decimal(0)), row.ticker)


def _value_row(
    db: Session,
    holding: Holding,
    row: BoardRow,
    market_data_provider: MarketDataProvider,
    risk_free_rate_provider: RiskFreeRateProvider,
    *,
    force_refresh: bool,
) -> None:
    """Fill one row's price, bear/base/bull, zone and reason from Sprint 3's
    valuation. Shared by the portfolio rows and the watchlist rows."""
    valuation = compute_holding_valuation(
        db, holding, market_data_provider, risk_free_rate_provider, force_refresh=force_refresh
    )
    row.valuation_currency = valuation.valuation_currency
    row.price = valuation.current_price_per_share
    row.price_as_of = valuation.as_of
    row.regime = valuation.regime
    row.regime_discount_rate_addon = valuation.regime_discount_rate_addon
    row.valuation_method = valuation.valuation_method
    row.valuation_status = valuation.valuation_status
    # headline_values() is None for a withheld (implausible) model, so a
    # value the plausibility guard rejected can never be ranked here.
    values = valuation.headline_values()
    if values is not None:
        row.bear, row.base, row.bull = values.get("bear"), values.get("base"), values.get("bull")
        row.margin_of_safety_base = valuation.headline_margin_of_safety("base")
        row.margin_of_safety_bear = valuation.headline_margin_of_safety("bear")
        if None not in (row.price, row.bear, row.base, row.bull):
            row.zone = _zone(row.price, row.bear, row.base, row.bull)  # type: ignore[arg-type]
    if row.zone == UNAVAILABLE:
        if valuation.valuation_status == "implausible":
            row.unavailable_reason = valuation.valuation_status_reason
        else:
            row.unavailable_reason = next(
                (r for r in valuation.unavailable_reasons if "unavailable" in r),
                valuation.unavailable_reasons[0] if valuation.unavailable_reasons else "no DCF",
            )


def build_board(
    db: Session,
    *,
    market_data_provider: MarketDataProvider,
    risk_free_rate_provider: RiskFreeRateProvider,
    force_refresh: bool = False,
) -> Board:
    positions = current_positions(db)
    value_by_holding: dict[uuid.UUID, Decimal | None] = {}
    for position in positions:
        current = value_by_holding.get(position.holding_id)
        if position.market_value_nok is None:
            value_by_holding.setdefault(position.holding_id, current)
            continue
        value_by_holding[position.holding_id] = (current or Decimal(0)) + position.market_value_nok

    holdings = (
        db.scalars(select(Holding).where(Holding.id.in_(list(value_by_holding)))).all() if value_by_holding else []
    )
    equities = [h for h in holdings if h.asset_class_raw in EQUITY_ANALYZABLE_TYPES]

    board = Board()
    board.total_equity_value_nok = sum(
        (value_by_holding[h.id] or Decimal(0) for h in equities), Decimal(0)
    )
    runs = latest_runs_by_holding(db, [h.id for h in equities])

    for holding in equities:
        value = value_by_holding[holding.id]
        weight = (
            value / board.total_equity_value_nok
            if value is not None and board.total_equity_value_nok > 0
            else None
        )
        row = BoardRow(
            holding_id=holding.id,
            ticker=holding.ticker,
            name=holding.name,
            sector=holding.sector,
            market_value_nok=value,
            weight_pct=weight,
        )

        _value_row(
            db, holding, row, market_data_provider, risk_free_rate_provider, force_refresh=force_refresh
        )
        _attach_verdict(row, runs.get(holding.id))
        board.rows.append(row)

    board.rows.sort(key=_sort_key)
    board.watchlist_rows = _build_watchlist_rows(
        db,
        owned_ids=set(value_by_holding),
        market_data_provider=market_data_provider,
        risk_free_rate_provider=risk_free_rate_provider,
        force_refresh=force_refresh,
    )
    return board


def _build_watchlist_rows(
    db: Session,
    *,
    owned_ids: set[uuid.UUID],
    market_data_provider: MarketDataProvider,
    risk_free_rate_provider: RiskFreeRateProvider,
    force_refresh: bool,
) -> list[BoardRow]:
    """Watchlist companies you don't own, valued exactly like portfolio rows."""
    items = db.scalars(select(WatchlistItem)).all()
    items = [i for i in items if i.holding_id not in owned_ids]
    if not items:
        return []
    holdings = {
        h.id: h
        for h in db.scalars(select(Holding).where(Holding.id.in_([i.holding_id for i in items])))
        if h.asset_class_raw in EQUITY_ANALYZABLE_TYPES
    }
    runs = latest_runs_by_holding(db, list(holdings))
    rows: list[BoardRow] = []
    for item in items:
        holding = holdings.get(item.holding_id)
        if holding is None:
            continue
        row = BoardRow(
            holding_id=holding.id,
            ticker=holding.ticker,
            name=holding.name,
            sector=holding.sector,
            market_value_nok=None,
            weight_pct=None,
            buy_below_price=item.buy_below_price,
            buy_below_currency=item.buy_below_currency,
        )
        _value_row(
            db, holding, row, market_data_provider, risk_free_rate_provider, force_refresh=force_refresh
        )
        _attach_verdict(row, runs.get(holding.id))
        rows.append(row)
    rows.sort(key=_sort_key)
    return rows
