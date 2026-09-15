"""Unit tests for app.services.portfolio.reset.

Regression coverage for a real production bug: `DELETE /portfolio/reset` 500'd
with `psycopg2.errors.ForeignKeyViolation` on `llm_usage_events_holding_analysis_id_fkey`
the moment any LLM usage ledger row (app.models.llm_usage.LLMUsageEvent, ADR 0013)
referenced a HoldingAnalysis/AnalysisRun/Holding — `reset_all_portfolio_data` deleted
those tables without first detaching llm_usage_events' optional FKs to them, because
reset.py predates the usage ledger and was never updated when it was added.

This fixture enables real SQLite foreign-key enforcement (off by default), unlike the
integration suite's `client` fixture (see test_portfolio_api.py's `test_upload_accepts_a
_ticker_longer_than_the_old_32_char_limit` comment for the same class of "SQLite doesn't
enforce what Postgres does" gap) — so this test actually catches an FK-ordering
regression the way the real Postgres deployment does, rather than silently passing.
"""

from datetime import datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401 — populates Base.metadata before create_all
from app.config.database import Base
from app.models.analysis import AnalysisRun, HoldingAnalysis
from app.models.document import Document
from app.models.holding import Holding
from app.models.llm_usage import LLMCallType, LLMUsageEvent
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.services.portfolio.reset import reset_all_portfolio_data


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")

    # Off by default in SQLite — turn it on so this test enforces FKs the same
    # way the real Postgres deployment does (see module docstring).
    @event.listens_for(engine, "connect")
    def _enable_fk(dbapi_connection, _record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = session_factory()
    yield session
    session.close()
    engine.dispose()


def _seed_holding_with_full_analysis_and_usage_event(db) -> tuple[Holding, HoldingAnalysis, LLMUsageEvent]:
    """Builds one holding all the way through: a snapshot/position, a
    completed AnalysisRun + HoldingAnalysis, and an LLMUsageEvent citing all
    three of its optional FKs (holding_id, analysis_run_id,
    holding_analysis_id) — reproducing exactly the row shape that broke
    production reset."""
    document = Document(
        holding_id=None,
        type="OTHER",
        original_filename="p.csv",
        mime_type="text/csv",
        size_bytes=1,
        storage_path="",
        sha256="reset-test-sentinel",
        status="VALIDATED",
        quality_flags=[],
    )
    db.add(document)
    db.flush()

    snapshot = PortfolioSnapshot(
        source_file_id=document.id,
        reporting_currency="NOK",
        status="VALIDATED",
        account_id=None,
    )
    db.add(snapshot)
    db.flush()

    holding = Holding(
        ticker="VAR.OL",
        name="Vår Energi",
        asset_class="EQUITY",
        asset_class_raw="EQUITY",
        sector=None,
        trading_currency="NOK",
    )
    db.add(holding)
    db.flush()

    db.add(
        PortfolioPosition(
            snapshot_id=snapshot.id,
            holding_id=holding.id,
            quantity=Decimal("100"),
        )
    )

    analysis_run = AnalysisRun(
        portfolio_snapshot_id=snapshot.id,
        status="COMPLETED",
        completed_at=datetime.now(timezone.utc),
        provider="google_ai_studio",
        model_name="gemini-3.6-flash",
        prompt_version="v2",
        scoring_version="v2",
        extraction_schema_version="v1",
        application_version="test",
        requested_holding_ids=[str(holding.id)],
    )
    db.add(analysis_run)
    db.flush()

    holding_analysis = HoldingAnalysis(
        analysis_run_id=analysis_run.id,
        holding_id=holding.id,
        structured_output_json={},
        overall_score=Decimal("7.00"),
        confidence="medium",
    )
    db.add(holding_analysis)
    db.flush()

    usage_event = LLMUsageEvent(
        provider="google_ai_studio",
        model_name="gemini-3.6-flash",
        call_type=LLMCallType.ANALYSIS_BLIND.value,
        prompt_version="v2",
        input_tokens=1000,
        output_tokens=500,
        holding_id=holding.id,
        analysis_run_id=analysis_run.id,
        holding_analysis_id=holding_analysis.id,
    )
    db.add(usage_event)
    db.commit()

    return holding, holding_analysis, usage_event


def test_reset_does_not_violate_llm_usage_event_foreign_keys(db):
    _holding, holding_analysis, usage_event = _seed_holding_with_full_analysis_and_usage_event(db)

    # Used to raise psycopg2.errors.ForeignKeyViolation on
    # llm_usage_events_holding_analysis_id_fkey in production — this call
    # must not raise at all.
    result = reset_all_portfolio_data(db)

    assert result.holdings_deleted == 1
    assert result.snapshots_deleted == 1
    assert result.documents_deleted == 1
    assert db.query(Holding).count() == 0
    assert db.query(HoldingAnalysis).count() == 0
    assert db.query(AnalysisRun).count() == 0


def test_reset_preserves_llm_usage_ledger_history_with_detached_fks(db):
    """llm_usage_events is deliberately kept (it's the free-tier quota
    ledger, not portfolio data — see module docstring), just detached from
    the holdings/analyses a reset wipes."""
    _holding, holding_analysis, usage_event = _seed_holding_with_full_analysis_and_usage_event(db)

    reset_all_portfolio_data(db)

    db.refresh(usage_event)
    assert db.query(LLMUsageEvent).count() == 1
    assert usage_event.holding_id is None
    assert usage_event.analysis_run_id is None
    assert usage_event.holding_analysis_id is None
    # Everything else about the historical usage row is untouched.
    assert usage_event.input_tokens == 1000
    assert usage_event.output_tokens == 500
