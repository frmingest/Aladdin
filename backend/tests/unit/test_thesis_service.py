"""Unit tests for app.services.thesis.service (architecture §16, §26 Phase 5)."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401 — populates Base.metadata before create_all
from app.config.database import Base
from app.models.analysis import AnalysisRun, AnalysisRunStatus, HoldingAnalysis
from app.models.holding import Holding
from app.models.thesis import InvestmentThesis, InvestmentThesisStatus
from app.models.types import new_uuid
from app.schemas.analysis import ConfidenceLevel
from app.schemas.thesis import ThesisCreate, ThesisUpdate
from app.services.thesis.service import (
    UnknownThesisStatusError,
    check_invalidation_signal,
    create_thesis,
    format_thesis_for_context,
    get_active_thesis,
    list_theses_for_holding,
    update_thesis,
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


@pytest.fixture()
def holding(db):
    h = Holding(
        ticker="VAR.OL", name="Vår Energi", asset_class="EQUITY", asset_class_raw="Aksje",
        trading_currency="NOK",
    )
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


def test_create_thesis_defaults_to_active(db, holding):
    thesis = create_thesis(
        db, holding.id,
        ThesisCreate(thesis="Durable moat, cheap on FCF.", confidence=ConfidenceLevel.HIGH),
    )
    assert thesis.status == InvestmentThesisStatus.ACTIVE.value
    assert thesis.confidence == "high"
    assert thesis.key_assumptions_json == []


def test_update_thesis_only_changes_supplied_fields(db, holding):
    thesis = create_thesis(db, holding.id, ThesisCreate(thesis="Original thesis text."))
    original_bull_case = thesis.bull_case

    updated = update_thesis(db, thesis, ThesisUpdate(thesis="Revised thesis text."))
    assert updated.thesis == "Revised thesis text."
    assert updated.bull_case == original_bull_case


def test_update_thesis_status_rejects_unknown_value(db, holding):
    thesis = create_thesis(db, holding.id, ThesisCreate(thesis="X"))
    with pytest.raises(UnknownThesisStatusError):
        update_thesis(db, thesis, ThesisUpdate(status="NOT_A_REAL_STATUS"))


def test_get_active_thesis_excludes_invalidated_and_closed(db, holding):
    create_thesis(db, holding.id, ThesisCreate(thesis="Old thesis"))
    active = create_thesis(db, holding.id, ThesisCreate(thesis="Current thesis"))

    old = list_theses_for_holding(db, holding.id)[-1]  # oldest = "Old thesis"
    update_thesis(db, old, ThesisUpdate(status=InvestmentThesisStatus.CLOSED.value))

    result = get_active_thesis(db, holding.id)
    assert result.id == active.id


def test_get_active_thesis_none_when_no_thesis_exists(db, holding):
    assert get_active_thesis(db, holding.id) is None


def test_list_theses_for_holding_orders_newest_first(db, holding):
    first = create_thesis(db, holding.id, ThesisCreate(thesis="First"))
    second = create_thesis(db, holding.id, ThesisCreate(thesis="Second"))
    result = list_theses_for_holding(db, holding.id)
    assert [t.id for t in result] == [second.id, first.id]


def test_format_thesis_for_context_includes_all_populated_sections():
    thesis = InvestmentThesis(
        holding_id="ignored", thesis="Great business.", bull_case="Growth accelerates.",
        bear_case="Margins compress.", key_assumptions_json=["10% growth"],
        invalidation_conditions_json=["Margin drops below 15%"], confidence="high",
        status=InvestmentThesisStatus.ACTIVE.value,
    )
    text = format_thesis_for_context(thesis)
    assert "Great business." in text
    assert "Growth accelerates." in text
    assert "Margins compress." in text
    assert "10% growth" in text
    assert "Margin drops below 15%" in text


def test_format_thesis_for_context_omits_empty_optional_sections():
    thesis = InvestmentThesis(
        holding_id="ignored", thesis="Just the thesis.", bull_case=None, bear_case=None,
        key_assumptions_json=[], invalidation_conditions_json=[], confidence="medium",
        status=InvestmentThesisStatus.ACTIVE.value,
    )
    text = format_thesis_for_context(thesis)
    assert text == "Thesis: Just the thesis."


def _completed_run_with_analysis(db, holding_id, thesis_status, triggers, overall_score, completed_at):
    run = AnalysisRun(
        portfolio_snapshot_id=new_uuid(), status=AnalysisRunStatus.COMPLETED.value,
        provider="stub", model_name="stub", prompt_version="v1", scoring_version="v1",
        extraction_schema_version="v1", application_version="0.1.0", completed_at=completed_at,
    )
    db.add(run)
    db.flush()
    ha = HoldingAnalysis(
        analysis_run_id=run.id, holding_id=holding_id,
        structured_output_json={"thesis_status": thesis_status, "invalidation_triggers": triggers},
        overall_score=overall_score, confidence="medium",
    )
    db.add(ha)
    db.commit()
    return run, ha


def test_check_invalidation_signal_no_analysis_yet(db, holding):
    thesis = create_thesis(db, holding.id, ThesisCreate(thesis="X"))
    signal = check_invalidation_signal(db, thesis)
    assert signal.has_signal is False
    assert "no completed analysis run" in signal.reasons[0]


def test_check_invalidation_signal_flags_weakening_status(db, holding):
    thesis = create_thesis(db, holding.id, ThesisCreate(thesis="X"))
    _completed_run_with_analysis(
        db, holding.id, "weakening", [], Decimal("4.50"), datetime.now(timezone.utc)
    )
    signal = check_invalidation_signal(db, thesis)
    assert signal.has_signal is True
    assert any("weakening" in r for r in signal.reasons)


def test_check_invalidation_signal_flags_new_triggers(db, holding):
    thesis = create_thesis(db, holding.id, ThesisCreate(thesis="X"))
    _completed_run_with_analysis(
        db, holding.id, "intact", ["Regulatory change"], Decimal("7.0"), datetime.now(timezone.utc)
    )
    signal = check_invalidation_signal(db, thesis)
    assert signal.has_signal is True
    assert signal.new_invalidation_triggers == ["Regulatory change"]


def test_check_invalidation_signal_intact_with_no_triggers_has_no_signal(db, holding):
    thesis = create_thesis(db, holding.id, ThesisCreate(thesis="X"))
    _completed_run_with_analysis(
        db, holding.id, "intact", [], Decimal("8.0"), datetime.now(timezone.utc) - timedelta(days=1)
    )
    signal = check_invalidation_signal(db, thesis)
    assert signal.has_signal is False
