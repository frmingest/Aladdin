"""Unit tests for app.services.then_and_now (B2): blind pass only, the run in
force at the decision date, changed lines only, honest statuses."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, Holding
from app.models.analysis import EquityAnalysisRun
from app.models.journal import DecisionJournalEntry
from app.services.then_and_now import build_then_and_now

T0 = datetime(2026, 1, 10, tzinfo=timezone.utc)


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def _holding(db) -> Holding:
    holding = Holding(ticker="EQNR.OL", name="Equinor ASA", trading_currency="NOK")
    db.add(holding)
    db.flush()
    return holding


def _run(db, holding, *, at, rating="Buy", moat="Wide", risks=None, triggers=None, bullets=None,
         low=None, high=None, reconciled_rating=None):
    run = EquityAnalysisRun(
        holding_id=holding.id, status="COMPLETED", schema_version="v1", blind_prompt_version="v1",
        evidence_packet_version="v1", evidence_packet_json=[], evidence_unavailable_reasons=[],
        started_at=at, completed_at=at,
        blind_pass_json={
            "verdict": {
                "rating": rating, "thesis_bullets": bullets or [], "top_risks": risks or [],
                "invalidation_triggers": triggers or [],
            },
            "moat": {"overall_rating": moat},
        },
        reconciliation_json={"verdict": {"rating": reconciled_rating}} if reconciled_rating else None,
        price_target_low=low, price_target_high=high,
        price_target_currency="NOK" if low is not None else None,
    )
    db.add(run)
    db.flush()
    return run


def _entry(db, holding, decided_on=date(2026, 1, 15)) -> DecisionJournalEntry:
    entry = DecisionJournalEntry(
        holding_id=holding.id, ticker=holding.ticker, company_name=holding.name, action="buy",
        decided_on=decided_on, currency="NOK", thesis="Low-cost producer",
    )
    db.add(entry)
    db.flush()
    return entry


def test_changed_lines_only_and_unchanged_are_counted():
    db = _session()
    h = _holding(db)
    _run(db, h, at=T0, rating="Buy", moat="Wide", risks=["Oil price"], low=Decimal(250), high=Decimal(400))
    _run(db, h, at=T0 + timedelta(days=30), rating="Hold", moat="Wide", risks=["Oil price"],
         low=Decimal(250), high=Decimal(400))
    result = build_then_and_now(db, _entry(db, h))

    assert result.status == "compared"
    assert [c.key for c in result.changes] == ["verdict"]
    assert (result.changes[0].then_value, result.changes[0].now_value) == ("Buy", "Hold")
    # moat, price range, thesis, risks, triggers did not change
    assert result.unchanged_count == 5


def test_reads_the_blind_pass_not_the_reconciliation():
    db = _session()
    h = _holding(db)
    _run(db, h, at=T0, rating="Hold", reconciled_rating="Strong Buy")
    _run(db, h, at=T0 + timedelta(days=30), rating="Hold", reconciled_rating="Avoid")
    result = build_then_and_now(db, _entry(db, h))

    assert result.status == "compared"
    assert result.changes == []  # blind verdicts match; notes-coloured ones are ignored
    assert result.note == "Nothing the analysis says has changed since you decided."


def test_then_is_the_run_in_force_on_the_decision_date_not_today():
    db = _session()
    h = _holding(db)
    early = _run(db, h, at=T0, rating="Buy")
    _run(db, h, at=T0 + timedelta(days=60), rating="Sell")  # after the decision: no hindsight
    latest = _run(db, h, at=T0 + timedelta(days=90), rating="Avoid")
    result = build_then_and_now(db, _entry(db, h, decided_on=date(2026, 1, 20)))

    assert result.then.run_id == early.id
    assert result.now.run_id == latest.id
    assert (result.changes[0].then_value, result.changes[0].now_value) == ("Buy", "Avoid")


def test_list_differences_compare_normalised_sets_and_show_both_sides():
    db = _session()
    h = _holding(db)
    _run(db, h, at=T0, risks=["Oil price falls", "Capex overrun"], triggers=["Net debt above 2x"])
    _run(db, h, at=T0 + timedelta(days=30), risks=["  OIL price   falls", "capex overrun"],
         triggers=["Net debt above 3x"])
    result = build_then_and_now(db, _entry(db, h))

    keys = [c.key for c in result.changes]
    assert keys == ["invalidation_triggers"]  # same risks after case/space normalising
    change = result.changes[0]
    assert change.kind == "list"
    assert change.then_items == ["Net debt above 2x"]
    assert change.now_items == ["Net debt above 3x"]


def test_price_range_change_is_reported_as_text():
    db = _session()
    h = _holding(db)
    _run(db, h, at=T0, low=Decimal(250), high=Decimal(400))
    _run(db, h, at=T0 + timedelta(days=30), low=Decimal(300), high=Decimal(450))
    change = build_then_and_now(db, _entry(db, h)).changes[0]

    assert change.key == "target_range"
    assert change.then_value == "250.00 to 400.00 NOK"
    assert change.now_value == "300.00 to 450.00 NOK"


def test_no_analysis_then_has_its_own_status_but_still_stamps_now():
    db = _session()
    h = _holding(db)
    latest = _run(db, h, at=T0 + timedelta(days=60))
    result = build_then_and_now(db, _entry(db, h))

    assert result.status == "no_analysis_then"
    assert result.then is None and result.now.run_id == latest.id
    assert result.changes == []


def test_no_analysis_at_all():
    db = _session()
    h = _holding(db)
    assert build_then_and_now(db, _entry(db, h)).status == "no_analysis_now"


def test_same_run_on_both_sides():
    db = _session()
    h = _holding(db)
    _run(db, h, at=T0)
    result = build_then_and_now(db, _entry(db, h))

    assert result.status == "same_run"
    assert result.changes == []


def test_entry_whose_holding_was_removed():
    db = _session()
    h = _holding(db)
    entry = _entry(db, h)
    entry.holding_id = None
    assert build_then_and_now(db, entry).status == "no_holding"
