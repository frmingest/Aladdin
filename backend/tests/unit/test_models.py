"""Smoke tests for the ORM models: build an in-memory SQLite schema from
Base.metadata and confirm the equity-relevant tables round-trip real rows
with their actual relationships, including the legacy columns
(asset_class, acquired_at) CLAUDE.md says stay in the schema but unused."""
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import (
    Account,
    Base,
    Document,
    FinancialLineItem,
    FxObservation,
    Holding,
    MarketObservation,
    PortfolioPosition,
    PortfolioSnapshot,
    RiskFreeRateObservation,
)
from app.models.holding import EQUITY_ASSET_CLASS


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def test_holding_round_trip_with_legacy_asset_class_column():
    with _session() as db:
        holding = Holding(
            ticker="EQNR.OL",
            name="Equinor ASA",
            trading_currency="NOK",
        )
        db.add(holding)
        db.commit()

        fetched = db.query(Holding).one()
        assert fetched.ticker == "EQNR.OL"
        # Legacy NOT NULL column is satisfied by the model's default, not
        # hand-set per CLAUDE.md's "never populated or queried" guidance.
        assert fetched.asset_class == EQUITY_ASSET_CLASS


def test_document_holding_and_line_item_relationships():
    with _session() as db:
        holding = Holding(ticker="VAR.OL", name="Vår Energi ASA", trading_currency="NOK")
        document = Document(
            holding=holding,
            type="annual_report",
            original_filename="var-energi-2025.pdf",
            mime_type="application/pdf",
            size_bytes=1234,
            storage_path="documents/var-energi-2025.pdf",
            sha256="a" * 64,
            status="processed",
            quality_flags={},
        )
        line_item = FinancialLineItem(
            document=document,
            holding=holding,
            metric="revenue",
            value=123456.789,
            unit="NOK_millions",
            period="FY2025",
            confidence=0.95,
        )
        db.add_all([holding, document, line_item])
        db.commit()

        fetched_holding = db.query(Holding).one()
        assert fetched_holding.documents[0].original_filename == "var-energi-2025.pdf"
        assert fetched_holding.financial_line_items[0].metric == "revenue"


def test_portfolio_snapshot_and_position_with_account_and_legacy_acquired_at():
    with _session() as db:
        account = Account(name="Aksje & fonds konto", account_number="70541644")
        holding = Holding(ticker="TEL.OL", name="Telenor ASA", trading_currency="NOK")
        document = Document(
            type="portfolio_export",
            original_filename="nordnet-export.csv",
            mime_type="text/csv",
            size_bytes=500,
            storage_path="documents/nordnet-export.csv",
            sha256="b" * 64,
            status="processed",
            quality_flags={},
        )
        snapshot = PortfolioSnapshot(
            source_file=document,
            reporting_currency="NOK",
            status="processed",
            account=account,
        )
        position = PortfolioPosition(
            snapshot=snapshot,
            holding=holding,
            account=account,
            weight_pct=12.3456,
            quantity=100,
            # acquired_at deliberately left None — legacy field, not used
            # for a brokerage-sourced equity position.
        )
        db.add_all([account, holding, document, snapshot, position])
        db.commit()

        fetched_account = db.query(Account).one()
        assert fetched_account.positions[0].weight_pct == Decimal("12.3456")
        assert fetched_account.positions[0].acquired_at is None
        assert fetched_account.snapshots[0].reporting_currency == "NOK"


def test_market_observation_round_trip_via_holding_relationship():
    with _session() as db:
        holding = Holding(ticker="AAPL", name="Apple Inc.", trading_currency="USD")
        observation = MarketObservation(
            holding=holding,
            observed_at=datetime.now(timezone.utc),
            price=Decimal("225.50"),
            currency="USD",
            provider="yfinance",
        )
        db.add_all([holding, observation])
        db.commit()

        fetched = db.query(Holding).one()
        assert fetched.market_observations[0].price == Decimal("225.50")
        assert fetched.market_observations[0].data_status == "ok"


def test_fx_observation_round_trip():
    with _session() as db:
        fx = FxObservation(
            from_currency="USD",
            to_currency="NOK",
            rate=Decimal("10.55000000"),
            observed_at=datetime.now(timezone.utc),
            provider="yfinance",
        )
        db.add(fx)
        db.commit()

        fetched = db.query(FxObservation).one()
        assert fetched.from_currency == "USD"
        assert fetched.to_currency == "NOK"
        assert fetched.rate == Decimal("10.55000000")


def test_risk_free_rate_observation_round_trip():
    with _session() as db:
        rate = RiskFreeRateObservation(
            currency="USD",
            rate=Decimal("4.250000"),
            observed_at=datetime.now(timezone.utc),
            provider="fred",
            source_series_id="DGS10",
        )
        db.add(rate)
        db.commit()

        fetched = db.query(RiskFreeRateObservation).one()
        assert fetched.currency == "USD"
        assert fetched.source_series_id == "DGS10"
