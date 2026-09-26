"""Unit tests for app.services.thesis.history — the six deterministic
"what changed since the latest analysis" checks."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, Document, EquityHoldingNote, FinancialLineItem, Holding
from app.models.analysis import EquityAnalysisRun
from app.models.market import FxObservation, MarketObservation
from app.services.thesis.history import (
    BIG_PRICE_MOVE_PCT,
    STALE_ANALYSIS_AFTER_DAYS,
    changes_since_run,
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


def _run(db, holding, *, started_at=None, notes_snapshot=None, price_low=None, price_high=None, price_currency=None):
    run = EquityAnalysisRun(
        holding_id=holding.id, status="COMPLETED", schema_version="v1", blind_prompt_version="v1",
        evidence_packet_version="v1", evidence_packet_json={}, evidence_unavailable_reasons=[],
        started_at=started_at or NOW, blind_pass_json={"verdict": {"rating": "Buy"}},
        user_notes_snapshot=notes_snapshot,
        price_target_low=None if price_low is None else D(price_low),
        price_target_high=None if price_high is None else D(price_high),
        price_target_currency=price_currency,
    )
    db.add(run)
    db.flush()
    return run


def _price(db, holding, price, *, currency="USD", observed_at):
    db.add(MarketObservation(holding_id=holding.id, observed_at=observed_at, price=D(price), currency=currency, provider="fake"))


def test_no_reasons_when_nothing_has_changed():
    db = _session()
    holding = _holding(db)
    run = _run(db, holding, started_at=NOW - timedelta(days=5))
    db.commit()
    assert changes_since_run(db, holding, run, now=NOW) == []


def test_stale_analysis_reason_uses_the_named_constant():
    db = _session()
    holding = _holding(db)
    run = _run(db, holding, started_at=NOW - timedelta(days=STALE_ANALYSIS_AFTER_DAYS))
    db.commit()
    reasons = {r.key for r in changes_since_run(db, holding, run, now=NOW)}
    assert "stale_analysis" in reasons

    fresh_run = _run(db, holding, started_at=NOW - timedelta(days=STALE_ANALYSIS_AFTER_DAYS - 1))
    db.commit()
    fresh_reasons = {r.key for r in changes_since_run(db, holding, fresh_run, now=NOW)}
    assert "stale_analysis" not in fresh_reasons


def test_new_financial_figures_since_the_run():
    db = _session()
    holding = _holding(db)
    run = _run(db, holding, started_at=NOW - timedelta(days=1))
    document = Document(
        holding=holding, type="filing", original_filename="10k.pdf", mime_type="application/pdf",
        size_bytes=1, storage_path="d.pdf", sha256="a" * 64, status="processed", quality_flags={},
    )
    db.add(document)
    db.flush()
    db.add(FinancialLineItem(
        document=document, holding=holding, metric="revenue", value=D("100"), unit="USD",
        currency="USD", period="FY2025", confidence=0.9, created_at=NOW,
    ))
    db.commit()
    reasons = {r.key for r in changes_since_run(db, holding, run, now=NOW)}
    assert "new_figures" in reasons


def test_new_documents_since_the_run():
    db = _session()
    holding = _holding(db)
    run = _run(db, holding, started_at=NOW - timedelta(days=1))
    db.add(Document(
        holding=holding, type="filing", original_filename="10k.pdf", mime_type="application/pdf",
        size_bytes=1, storage_path="d.pdf", sha256="a" * 64, status="processed", quality_flags={},
        uploaded_at=NOW,
    ))
    db.commit()
    reasons = {r.key for r in changes_since_run(db, holding, run, now=NOW)}
    assert "new_documents" in reasons


def test_notes_changed_since_the_run():
    db = _session()
    holding = _holding(db)
    run = _run(db, holding, started_at=NOW - timedelta(days=5), notes_snapshot="old thesis")
    db.add(EquityHoldingNote(holding_id=holding.id, content="new thinking", updated_at=NOW))
    db.commit()
    reasons = {r.key for r in changes_since_run(db, holding, run, now=NOW)}
    assert "notes_changed" in reasons


def test_notes_unchanged_is_not_a_reason():
    db = _session()
    holding = _holding(db)
    run = _run(db, holding, started_at=NOW - timedelta(days=5), notes_snapshot="same thesis")
    db.add(EquityHoldingNote(holding_id=holding.id, content="same thesis", updated_at=NOW))
    db.commit()
    reasons = {r.key for r in changes_since_run(db, holding, run, now=NOW)}
    assert "notes_changed" not in reasons


def test_big_price_move_reason_uses_the_named_threshold():
    db = _session()
    holding = _holding(db)
    started_at = NOW - timedelta(days=10)
    run = _run(db, holding, started_at=started_at)
    _price(db, holding, "100", observed_at=started_at)
    _price(db, holding, str(100 * (1 + BIG_PRICE_MOVE_PCT)), observed_at=NOW)
    db.commit()
    reasons = {r.key for r in changes_since_run(db, holding, run, now=NOW)}
    assert "big_price_move" in reasons


def test_small_price_move_is_not_a_reason():
    db = _session()
    holding = _holding(db)
    started_at = NOW - timedelta(days=10)
    run = _run(db, holding, started_at=started_at)
    _price(db, holding, "100", observed_at=started_at)
    _price(db, holding, "105", observed_at=NOW)
    db.commit()
    reasons = {r.key for r in changes_since_run(db, holding, run, now=NOW)}
    assert "big_price_move" not in reasons


def test_price_outside_dcf_range_below_bear():
    db = _session()
    holding = _holding(db)
    started_at = NOW - timedelta(days=10)
    run = _run(db, holding, started_at=started_at, price_low="80", price_high="150", price_currency="USD")
    _price(db, holding, "100", observed_at=started_at)
    _price(db, holding, "50", observed_at=NOW)
    db.commit()
    reasons = {r.key for r in changes_since_run(db, holding, run, now=NOW)}
    assert "outside_dcf_range" in reasons


def test_price_outside_dcf_range_above_bull():
    db = _session()
    holding = _holding(db)
    started_at = NOW - timedelta(days=10)
    run = _run(db, holding, started_at=started_at, price_low="80", price_high="150", price_currency="USD")
    _price(db, holding, "100", observed_at=started_at)
    _price(db, holding, "200", observed_at=NOW)
    db.commit()
    reasons = {r.key for r in changes_since_run(db, holding, run, now=NOW)}
    assert "outside_dcf_range" in reasons


def test_price_inside_dcf_range_is_not_a_reason():
    db = _session()
    holding = _holding(db)
    started_at = NOW - timedelta(days=10)
    run = _run(db, holding, started_at=started_at, price_low="80", price_high="150", price_currency="USD")
    _price(db, holding, "100", observed_at=started_at)
    _price(db, holding, "110", observed_at=NOW)
    db.commit()
    reasons = {r.key for r in changes_since_run(db, holding, run, now=NOW)}
    assert "outside_dcf_range" not in reasons


def test_dcf_range_check_skips_gracefully_without_fx_rate():
    """Different currencies with no stored FX rate: skip the check, don't
    crash — per spec."""
    db = _session()
    holding = _holding(db)
    started_at = NOW - timedelta(days=10)
    run = _run(db, holding, started_at=started_at, price_low="80", price_high="150", price_currency="EUR")
    _price(db, holding, "100", observed_at=started_at, currency="USD")
    _price(db, holding, "200", observed_at=NOW, currency="USD")
    db.commit()
    # No FxObservation USD->EUR on file: should not raise.
    reasons = {r.key for r in changes_since_run(db, holding, run, now=NOW)}
    assert "outside_dcf_range" not in reasons
    assert "big_price_move" in reasons  # same-currency check still runs


def test_dcf_range_check_converts_with_stored_fx_rate():
    db = _session()
    holding = _holding(db)
    started_at = NOW - timedelta(days=10)
    run = _run(db, holding, started_at=started_at, price_low="80", price_high="150", price_currency="EUR")
    _price(db, holding, "100", observed_at=started_at, currency="EUR")
    _price(db, holding, "200", observed_at=NOW, currency="USD")
    db.add(FxObservation(from_currency="USD", to_currency="EUR", rate=D("2"), observed_at=NOW, provider="fake"))
    db.commit()
    # 200 USD * 2 = 400 EUR, well above the 150 bull value.
    reasons = {r.key for r in changes_since_run(db, holding, run, now=NOW)}
    assert "outside_dcf_range" in reasons
