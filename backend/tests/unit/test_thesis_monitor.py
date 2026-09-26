"""Unit tests for app.services.thesis.monitor — status classification and
monitor ordering (most urgent first)."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, Document, Holding
from app.models.analysis import EquityAnalysisRun
from app.models.market import MarketObservation
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.services.thesis.monitor import (
    STATUS_FIRING,
    STATUS_INTACT,
    STATUS_NOT_ANALYZED,
    STATUS_REVIEW,
    build_monitor,
    classify,
    holdings_to_monitor,
)
from app.services.thesis.tripwires import create_tripwire

D = Decimal
NOW = datetime.now(timezone.utc)


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def _holding(db, ticker) -> Holding:
    holding = Holding(ticker=ticker, name=f"{ticker} Corp", trading_currency="USD")
    db.add(holding)
    db.flush()
    return holding


def _owned(db, holding):
    _own_all(db, holding)


def _own_all(db, *holdings):
    """One snapshot (no account) holding a position in each of `holdings`
    — `current_positions` treats "no account" as its own single group, so
    several *separate* no-account snapshots would only count the newest
    one; this is the one-snapshot-many-positions shape real portfolio
    imports produce."""
    document = Document(
        type="portfolio_export", original_filename="x.csv", mime_type="text/csv", size_bytes=1,
        storage_path="p/all.csv", sha256="allholdings".ljust(64, "0"),
        status="processed", quality_flags={},
    )
    db.add(document)
    db.flush()
    snapshot = PortfolioSnapshot(source_file=document, reporting_currency="USD", status="processed")
    db.add(snapshot)
    db.flush()
    for holding in holdings:
        db.add(PortfolioPosition(snapshot=snapshot, holding=holding, market_value_nok=D("1000")))


def _analyzed(db, holding, verdict="Hold"):
    db.add(EquityAnalysisRun(
        holding_id=holding.id, status="COMPLETED", schema_version="v1", blind_prompt_version="v1",
        evidence_packet_version="v1", evidence_packet_json={}, evidence_unavailable_reasons=[],
        started_at=NOW, blind_pass_json={"verdict": {"rating": verdict}},
    ))


def test_classify_priority_order():
    assert classify(firing_count=1, change_reason_count=5, has_usable_run=True) == STATUS_FIRING
    assert classify(firing_count=0, change_reason_count=1, has_usable_run=True) == STATUS_REVIEW
    assert classify(firing_count=0, change_reason_count=0, has_usable_run=False) == STATUS_NOT_ANALYZED
    assert classify(firing_count=0, change_reason_count=0, has_usable_run=True) == STATUS_INTACT


def test_holdings_to_monitor_includes_owned_and_watched_with_tripwires():
    db = _session()
    owned = _holding(db, "OWNED")
    watched = _holding(db, "WATCHED")
    _holding(db, "IGNORED")
    _owned(db, owned)
    db.commit()
    create_tripwire(db, watched, metric="share_price", operator="below", threshold=D("10"))

    tickers = {h.ticker for h in holdings_to_monitor(db)}
    assert tickers == {"OWNED", "WATCHED"}
    assert "IGNORED" not in tickers


def test_monitor_orders_most_urgent_first():
    db = _session()
    intact = _holding(db, "INTACT")
    not_analyzed = _holding(db, "UNANALYZED")
    firing = _holding(db, "FIRING")
    _own_all(db, intact, not_analyzed, firing)
    _analyzed(db, intact)
    _analyzed(db, firing)
    db.commit()

    create_tripwire(db, firing, metric="share_price", operator="below", threshold=D("1000"))
    db.add(MarketObservation(holding_id=firing.id, observed_at=NOW, price=D("10"), currency="USD", provider="fake"))
    db.commit()

    rows = build_monitor(db, now=NOW)
    assert [r.ticker for r in rows] == ["FIRING", "UNANALYZED", "INTACT"]
    assert rows[0].status == STATUS_FIRING
    assert rows[0].firing_count == 1
    assert rows[1].status == STATUS_NOT_ANALYZED
    assert rows[2].status == STATUS_INTACT
