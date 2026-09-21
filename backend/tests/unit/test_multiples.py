"""Unit tests for app.services.valuation.multiples — trailing multiples
computed from FinancialLineItem facts matched against the nearest
historical MarketObservation, against an in-memory SQLite DB."""
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, Document, FinancialLineItem, Holding, MarketObservation
from app.services.valuation.multiples import multiples_over_time

D = Decimal


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def _document(holding: Holding) -> Document:
    return Document(
        holding=holding,
        type="filing",
        original_filename="10k.pdf",
        mime_type="application/pdf",
        size_bytes=100,
        storage_path="documents/10k.pdf",
        sha256="a" * 64,
        status="processed",
        quality_flags={},
    )


def _fact(document: Document, holding: Holding, metric: str, value: str, period: str) -> FinancialLineItem:
    return FinancialLineItem(
        document=document, holding=holding, metric=metric, value=D(value),
        unit="USD", period=period, confidence=0.95,
    )


def test_full_period_computes_every_multiple():
    with _session() as db:
        holding = Holding(ticker="AAPL", name="Apple Inc.", trading_currency="USD")
        document = _document(holding)
        db.add_all([holding, document])
        db.flush()

        facts = {
            "net_income": "100", "shares_outstanding": "10", "total_equity": "400",
            "revenue": "1000", "total_debt": "200", "cash_and_equivalents": "50", "ebitda": "150",
        }
        for metric, value in facts.items():
            db.add(_fact(document, holding, metric, value, "FY2025"))
        db.add(
            MarketObservation(
                holding=holding, observed_at=datetime(2025, 12, 31, tzinfo=timezone.utc),
                price=D("50"), currency="USD", provider="yfinance",
            )
        )
        db.commit()

        results = multiples_over_time(db, holding)

    assert len(results) == 1
    result = results[0]
    assert result.period == "FY2025"
    # eps = 100/10 = 10, P/E = 50/10 = 5
    assert result.computed["price_to_earnings"] == D("5")
    # book value/share = 400/10 = 40, P/B = 50/40 = 1.25
    assert result.computed["price_to_book"] == D("1.25")
    # market cap = 50*10 = 500, P/S = 500/1000 = 0.5
    assert result.computed["price_to_sales"] == D("0.5")
    # EV = 500 + 200 - 50 = 650, EV/EBITDA = 650/150
    assert result.computed["enterprise_value"] == D("650")
    assert result.computed["ev_to_ebitda"] == D("650") / D("150")
    assert result.skipped == {}
    # SQLite in tests loses tz-awareness on round-trip; normalize before comparing.
    matched = result.matched_price_observed_at
    if matched.tzinfo is None:
        matched = matched.replace(tzinfo=timezone.utc)
    assert matched == datetime(2025, 12, 31, tzinfo=timezone.utc)


def test_missing_facts_are_skipped_with_reasons_not_dropped_silently():
    with _session() as db:
        holding = Holding(ticker="TEL.OL", name="Telenor ASA", trading_currency="NOK")
        document = _document(holding)
        db.add_all([holding, document])
        db.flush()

        db.add(_fact(document, holding, "net_income", "100", "FY2025"))
        db.add(_fact(document, holding, "shares_outstanding", "10", "FY2025"))
        db.add(
            MarketObservation(
                holding=holding, observed_at=datetime(2025, 12, 31, tzinfo=timezone.utc),
                price=D("50"), currency="NOK", provider="yfinance",
            )
        )
        db.commit()

        results = multiples_over_time(db, holding)

    result = results[0]
    assert "price_to_earnings" in result.computed
    assert "total_equity" in result.skipped["price_to_book"]
    assert "revenue" in result.skipped["price_to_sales"]
    assert "total_debt" in result.skipped["ev_to_ebitda"]


def test_period_with_no_parseable_year_is_skipped():
    with _session() as db:
        holding = Holding(ticker="AAPL", name="Apple Inc.", trading_currency="USD")
        document = _document(holding)
        db.add_all([holding, document])
        db.flush()
        db.add(_fact(document, holding, "net_income", "100", "most recent quarter"))
        db.commit()

        results = multiples_over_time(db, holding)

    assert results[0].skipped["_period"].startswith("could not parse a year")
    assert results[0].computed == {}


def test_holding_with_no_price_observations_is_skipped():
    with _session() as db:
        holding = Holding(ticker="AAPL", name="Apple Inc.", trading_currency="USD")
        document = _document(holding)
        db.add_all([holding, document])
        db.flush()
        db.add(_fact(document, holding, "net_income", "100", "FY2025"))
        db.commit()

        results = multiples_over_time(db, holding)

    assert "no market price observation" in results[0].skipped["_period"]


def test_nearest_observation_is_matched_across_multiple_price_points():
    with _session() as db:
        holding = Holding(ticker="AAPL", name="Apple Inc.", trading_currency="USD")
        document = _document(holding)
        db.add_all([holding, document])
        db.flush()

        db.add(_fact(document, holding, "net_income", "100", "FY2024"))
        db.add(_fact(document, holding, "shares_outstanding", "10", "FY2024"))
        db.add(
            MarketObservation(
                holding=holding, observed_at=datetime(2024, 12, 31, tzinfo=timezone.utc),
                price=D("40"), currency="USD", provider="yfinance",
            )
        )
        db.add(
            MarketObservation(
                holding=holding, observed_at=datetime(2020, 1, 1, tzinfo=timezone.utc),
                price=D("999"), currency="USD", provider="yfinance",
            )
        )
        db.commit()

        results = multiples_over_time(db, holding)

    # eps = 10, matched price should be the 2024-12-31 one (40), not the
    # far-away 2020 one, so P/E = 40/10 = 4.
    assert results[0].computed["price_to_earnings"] == D("4")


def test_multiple_periods_are_each_computed_independently_and_sorted():
    with _session() as db:
        holding = Holding(ticker="AAPL", name="Apple Inc.", trading_currency="USD")
        document = _document(holding)
        db.add_all([holding, document])
        db.flush()

        for year, net_income, price in ((2023, "80", "30"), (2024, "90", "35"), (2025, "100", "50")):
            db.add(_fact(document, holding, "net_income", net_income, f"FY{year}"))
            db.add(_fact(document, holding, "shares_outstanding", "10", f"FY{year}"))
            db.add(
                MarketObservation(
                    holding=holding, observed_at=datetime(year, 12, 31, tzinfo=timezone.utc),
                    price=D(price), currency="USD", provider="yfinance",
                )
            )
        db.commit()

        results = multiples_over_time(db, holding)

    assert [r.period for r in results] == ["FY2023", "FY2024", "FY2025"]
    assert results[0].computed["price_to_earnings"] == D("30") / D("8")
    assert results[2].computed["price_to_earnings"] == D("5")
