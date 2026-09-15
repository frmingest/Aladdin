"""Unit tests for app.services.portfolio.manual_entry (§26 Phase 8, ADR 0011)."""

from datetime import datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401 — populates Base.metadata before create_all
from app.config.database import Base
from app.models.account import Account
from app.models.document import Document
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.services.portfolio.manual_entry import (
    ManualEntryValidationError,
    add_manual_position,
)


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = session_factory()
    yield session
    session.close()
    engine.dispose()


def _add_gold_coin(db, **overrides):
    params = dict(
        ticker="XAU-COIN-2026-09",
        name="1oz Gold Coin",
        asset_class="COMMODITY",
        trading_currency="USD",
        quantity=Decimal("1"),
        cost_basis=Decimal("2450.00"),
        cost_basis_currency="USD",
        market_ticker="xau",
        custody_type="allocated_physical",
        acquired_at=datetime(2026, 9, 10, tzinfo=timezone.utc),
        notes="bought at the local dealer",
        account_id=None,
    )
    params.update(overrides)
    return add_manual_position(db, **params)


def test_add_manual_position_creates_holding_and_position(db):
    result = _add_gold_coin(db)

    assert result.was_new_holding is True
    assert result.holding.ticker == "XAU-COIN-2026-09"
    assert result.holding.asset_class == "COMMODITY"
    # market_ticker is upper-cased for consistency with how every other
    # provider/routing table keys tickers.
    assert result.holding.market_ticker == "XAU"
    assert result.holding.custody_type == "allocated_physical"
    assert result.position.quantity == Decimal("1")
    assert result.position.cost_basis == Decimal("2450.00")
    # SQLite (this fixture's DB) doesn't round-trip tzinfo on a
    # DateTime(timezone=True) column — compare naive values, same as the
    # rest of this codebase's SQLite-backed unit tests do.
    assert result.position.acquired_at.replace(tzinfo=timezone.utc) == datetime(
        2026, 9, 10, tzinfo=timezone.utc
    )


def test_rejects_asset_classes_outside_commodity_and_collectible(db):
    with pytest.raises(ManualEntryValidationError):
        _add_gold_coin(db, asset_class="EQUITY", ticker="VAR.OL", name="Vår Energi")


def test_accepts_collectible_asset_class(db):
    result = _add_gold_coin(
        db,
        ticker="WHISKY-001",
        name="Macallan 18",
        asset_class="COLLECTIBLE",
        market_ticker=None,
    )

    assert result.holding.asset_class == "COLLECTIBLE"
    assert result.holding.market_ticker is None


def test_second_lot_of_same_ticker_creates_a_second_position_not_a_merge(db):
    first = _add_gold_coin(db, quantity=Decimal("1"), cost_basis=Decimal("2450.00"))
    second = _add_gold_coin(
        db,
        quantity=Decimal("2"),
        cost_basis=Decimal("2500.00"),
        acquired_at=datetime(2026, 9, 12, tzinfo=timezone.utc),
    )

    assert second.was_new_holding is False
    assert first.holding.id == second.holding.id
    assert first.position.id != second.position.id

    positions = db.query(PortfolioPosition).filter(PortfolioPosition.holding_id == first.holding.id).all()
    assert len(positions) == 2
    assert {p.cost_basis for p in positions} == {Decimal("2450.00"), Decimal("2500.00")}


def test_reuses_the_same_manual_entries_snapshot_and_sentinel_document(db):
    _add_gold_coin(db, ticker="XAU-1", name="Coin 1")
    _add_gold_coin(db, ticker="XAU-2", name="Coin 2")

    assert db.query(PortfolioSnapshot).count() == 1
    assert db.query(Document).count() == 1

    snapshot = db.query(PortfolioSnapshot).one()
    assert len(snapshot.positions) == 2


def test_existing_holding_market_ticker_is_not_overwritten(db):
    first = _add_gold_coin(db, market_ticker="xau")
    second = _add_gold_coin(db, market_ticker="xag")  # a mistaken different symbol on a later call

    assert first.holding.id == second.holding.id
    assert second.holding.market_ticker == "XAU"  # unchanged, matches ingestion.py's convention


def test_unknown_account_id_is_rejected(db):
    import uuid

    with pytest.raises(ManualEntryValidationError):
        _add_gold_coin(db, account_id=uuid.uuid4())


def test_known_account_id_is_accepted(db):
    account = Account(name="ASK", account_number="12345")
    db.add(account)
    db.commit()

    result = _add_gold_coin(db, account_id=account.id)

    assert result.position.account_id == account.id


def test_invalid_trading_currency_is_rejected(db):
    with pytest.raises(ManualEntryValidationError):
        _add_gold_coin(db, trading_currency="US")


def test_acquired_at_defaults_to_now_when_not_supplied(db):
    result = _add_gold_coin(db, acquired_at=None)

    assert result.position.acquired_at is not None
