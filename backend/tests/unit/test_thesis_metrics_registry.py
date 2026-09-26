"""Unit tests for app.services.thesis.metrics_registry — the tripwire
metric registry and computing today's value for one metric from stored
data only (no live provider call)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, Document, FinancialLineItem, Holding
from app.models.analysis import EquityAnalysisRun
from app.models.market import MarketObservation
from app.services.thesis.metrics_registry import (
    METRICS_BY_KEY,
    compute_metric_value,
    metric_registry,
)

D = Decimal
NOW = datetime.now(timezone.utc)


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def _holding(db) -> Holding:
    holding = Holding(ticker="AAPL", name="Apple Inc.", trading_currency="USD")
    db.add(holding)
    db.flush()
    return holding


def _document(db, holding) -> Document:
    document = Document(
        holding=holding, type="filing", original_filename="10k.pdf", mime_type="application/pdf",
        size_bytes=1, storage_path="d.pdf", sha256="a" * 64, status="processed", quality_flags={},
    )
    db.add(document)
    db.flush()
    return document


def _fact(db, document, holding, metric, value, period, currency="USD"):
    db.add(FinancialLineItem(
        document=document, holding=holding, metric=metric, value=D(value), unit="USD",
        currency=currency, period=period, confidence=0.9,
    ))


def _price(db, holding, price, *, currency="USD", observed_at=NOW):
    db.add(MarketObservation(holding_id=holding.id, observed_at=observed_at, price=D(price), currency=currency, provider="fake"))


def test_registry_lists_every_metric_from_the_three_groups():
    keys = {m.key for m in metric_registry()}
    assert {"roic", "roe", "gross_margin", "net_debt_to_ebitda"} <= keys
    assert {"price_to_earnings", "price_to_book", "ev_to_ebitda", "fcf_yield"} <= keys
    assert {"share_price", "price_change_since_analysis"} <= keys
    assert METRICS_BY_KEY["roic"].group == "fundamentals"
    assert METRICS_BY_KEY["price_to_earnings"].group == "market_multiples"
    assert METRICS_BY_KEY["share_price"].group == "price"


def test_unknown_metric_is_reported_not_raised():
    db = _session()
    holding = _holding(db)
    db.commit()
    result = compute_metric_value(db, holding, "not_a_metric")
    assert result.value is None
    assert "unknown metric" in result.unavailable_reason


def test_roic_reuses_metrics_service_exactly():
    """A tripwire on ROIC must read the exact same number as GET
    /holdings/{id}/metrics — both go through app/services/metrics.py."""
    db = _session()
    holding = _holding(db)
    document = _document(db, holding)
    for metric, value in (
        ("ebit", "100"), ("total_debt", "200"), ("total_equity", "300"),
        ("cash_and_equivalents", "50"), ("income_tax_expense", "20"), ("income_before_tax", "100"),
    ):
        _fact(db, document, holding, metric, value, "FY2025")
    db.commit()

    result = compute_metric_value(db, holding, "roic")
    assert result.value is not None
    assert result.value > 0


def test_revenue_growth_yoy_computed_from_two_periods():
    db = _session()
    holding = _holding(db)
    document = _document(db, holding)
    _fact(db, document, holding, "revenue", "100", "FY2024")
    _fact(db, document, holding, "revenue", "120", "FY2025")
    db.commit()

    result = compute_metric_value(db, holding, "revenue_growth_yoy")
    assert result.value == D("0.2")


def test_revenue_growth_yoy_missing_prior_year_is_unavailable():
    db = _session()
    holding = _holding(db)
    document = _document(db, holding)
    _fact(db, document, holding, "revenue", "120", "FY2025")
    db.commit()

    result = compute_metric_value(db, holding, "revenue_growth_yoy")
    assert result.value is None
    assert "missing" in result.unavailable_reason


def test_share_price_reads_the_latest_stored_observation_only():
    db = _session()
    holding = _holding(db)
    _price(db, holding, "150", observed_at=NOW - timedelta(days=10))
    _price(db, holding, "180", observed_at=NOW)
    db.commit()

    result = compute_metric_value(db, holding, "share_price")
    assert result.value == D("180")


def test_share_price_unavailable_when_never_fetched():
    db = _session()
    holding = _holding(db)
    db.commit()
    result = compute_metric_value(db, holding, "share_price")
    assert result.value is None
    assert "no stored share price" in result.unavailable_reason


def test_price_change_since_analysis_uses_price_on_or_before_run_start():
    db = _session()
    holding = _holding(db)
    started_at = NOW - timedelta(days=30)
    db.add(EquityAnalysisRun(
        holding_id=holding.id, status="COMPLETED", schema_version="v1", blind_prompt_version="v1",
        evidence_packet_version="v1", evidence_packet_json={}, evidence_unavailable_reasons=[],
        started_at=started_at, blind_pass_json={"verdict": {"rating": "Buy"}},
    ))
    _price(db, holding, "100", observed_at=started_at - timedelta(days=1))
    _price(db, holding, "125", observed_at=NOW)
    db.commit()

    result = compute_metric_value(db, holding, "price_change_since_analysis")
    assert result.value == D("0.25")


def test_price_change_since_analysis_unavailable_with_no_run():
    db = _session()
    holding = _holding(db)
    db.commit()
    result = compute_metric_value(db, holding, "price_change_since_analysis")
    assert result.value is None
    assert "no analyzed run" in result.unavailable_reason


def test_market_multiple_unavailable_without_a_stored_price():
    db = _session()
    holding = _holding(db)
    document = _document(db, holding)
    _fact(db, document, holding, "net_income", "100", "FY2025")
    db.commit()

    result = compute_metric_value(db, holding, "price_to_earnings")
    assert result.value is None
    assert "no stored share price" in result.unavailable_reason
