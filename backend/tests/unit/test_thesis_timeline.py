"""Unit tests for app.services.thesis.timeline — verdict/moat direction
arrows against the previous run, newest first."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, Holding
from app.models.analysis import EquityAnalysisRun
from app.services.thesis.timeline import build_timeline

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


def _run(db, holding, *, started_at, verdict, moat="Wide", reconciled=True, bullets=None):
    db.add(EquityAnalysisRun(
        holding_id=holding.id, status="COMPLETED", schema_version="v1", blind_prompt_version="v1",
        evidence_packet_version="v1", evidence_packet_json={}, evidence_unavailable_reasons=[],
        started_at=started_at,
        blind_pass_json={"verdict": {"rating": verdict}, "moat": {"overall_rating": moat}, "thesis_bullets": bullets or []},
        reconciliation_json={"verdict": {"rating": verdict}} if reconciled else None,
    ))


def test_newest_first_and_verdict_up_direction():
    db = _session()
    holding = _holding(db)
    _run(db, holding, started_at=NOW - timedelta(days=10), verdict="Hold")
    _run(db, holding, started_at=NOW, verdict="Buy")
    db.commit()

    entries = build_timeline(db, holding.id)
    assert [e.verdict for e in entries] == ["Buy", "Hold"]
    assert entries[0].verdict_direction == "up"
    assert entries[1].verdict_direction is None  # no run before it


def test_verdict_down_and_flat_directions():
    db = _session()
    holding = _holding(db)
    _run(db, holding, started_at=NOW - timedelta(days=20), verdict="Buy")
    _run(db, holding, started_at=NOW - timedelta(days=10), verdict="Sell")
    _run(db, holding, started_at=NOW, verdict="Sell")
    db.commit()

    entries = build_timeline(db, holding.id)
    assert entries[0].verdict_direction == "flat"  # Sell -> Sell
    assert entries[1].verdict_direction == "down"  # Buy -> Sell


def test_moat_direction_tracks_separately_from_verdict():
    db = _session()
    holding = _holding(db)
    _run(db, holding, started_at=NOW - timedelta(days=10), verdict="Hold", moat="Narrow")
    _run(db, holding, started_at=NOW, verdict="Hold", moat="Wide")
    db.commit()

    entries = build_timeline(db, holding.id)
    assert entries[0].moat_direction == "up"
    assert entries[0].verdict_direction == "flat"


def test_pass_type_reflects_whether_reconciliation_ran():
    db = _session()
    holding = _holding(db)
    _run(db, holding, started_at=NOW, verdict="Hold", reconciled=False)
    db.commit()
    entries = build_timeline(db, holding.id)
    assert entries[0].pass_type == "blind_only"


def test_thesis_bullets_prefer_reconciliation_over_blind():
    db = _session()
    holding = _holding(db)
    _run(db, holding, started_at=NOW, verdict="Hold", bullets=["blind bullet"])
    db.commit()
    entries = build_timeline(db, holding.id)
    # reconciliation_json has a verdict but no thesis_bullets key -> falls
    # back to the blind pass's.
    assert entries[0].thesis_bullets == ["blind bullet"]


def test_runs_without_a_blind_pass_are_excluded():
    db = _session()
    holding = _holding(db)
    db.add(EquityAnalysisRun(
        holding_id=holding.id, status="RUNNING", schema_version="v1", blind_prompt_version="v1",
        evidence_packet_version="v1", evidence_packet_json={}, evidence_unavailable_reasons=[],
        started_at=NOW, blind_pass_json=None,
    ))
    db.commit()
    assert build_timeline(db, holding.id) == []
