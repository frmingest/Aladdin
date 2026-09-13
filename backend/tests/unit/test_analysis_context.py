"""
Unit tests for app.services.analysis.context — the evidence-packet builder
(architecture §5.3, §26 Phase 3). Exercises it directly against a throwaway
SQLite session (no HTTP layer), independent of external infrastructure (§22).
"""

from datetime import datetime, timezone
from decimal import Decimal

import pytest

import app.models  # noqa: F401 — populates Base.metadata before create_all
from app.config.database import Base
from app.models.document import Document, DocumentChunk, DocumentStatus, DocumentType
from app.models.financial_fact import FinancialLineItem
from app.models.holding import Holding
from app.models.market_data import MarketObservation
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot, SnapshotStatus
from app.services.analysis.context import InsufficientContextError, build_analysis_context
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = session_factory()
    yield session
    session.close()
    engine.dispose()


def _make_snapshot(db, reporting_currency="NOK"):
    source_doc = Document(
        holding_id=None,
        type=DocumentType.PORTFOLIO_SNAPSHOT.value,
        original_filename="portfolio.csv",
        mime_type="text/csv",
        size_bytes=10,
        storage_path="x",
        sha256="a" * 64,
        status=DocumentStatus.PROCESSED.value,
    )
    db.add(source_doc)
    db.flush()
    snapshot = PortfolioSnapshot(
        source_file_id=source_doc.id, reporting_currency=reporting_currency, status=SnapshotStatus.VALIDATED.value
    )
    db.add(snapshot)
    db.flush()
    return snapshot


def _make_holding(db, ticker="VAR.OL", name="Vår Energi"):
    holding = Holding(
        ticker=ticker,
        name=name,
        asset_class="EQUITY",
        asset_class_raw="Aksje",
        sector="Energy",
        trading_currency="NOK",
    )
    db.add(holding)
    db.flush()
    return holding


def test_insufficient_context_raises_when_nothing_on_record(db):
    snapshot = _make_snapshot(db)
    holding = _make_holding(db)
    db.add(PortfolioPosition(snapshot_id=snapshot.id, holding_id=holding.id, weight_pct=Decimal("100")))
    db.commit()

    with pytest.raises(InsufficientContextError):
        build_analysis_context(db, holding.id, snapshot.id)


def test_context_includes_financial_metrics_and_evidence(db):
    snapshot = _make_snapshot(db)
    holding = _make_holding(db)
    db.add(
        PortfolioPosition(
            snapshot_id=snapshot.id,
            holding_id=holding.id,
            weight_pct=Decimal("100"),
            quantity=Decimal("1000"),
            notes="Long-term conviction holding — thesis: energy transition beneficiary.",
        )
    )

    report = Document(
        holding_id=holding.id,
        type=DocumentType.ANNUAL_REPORT.value,
        original_filename="annual-report-2025.pdf",
        mime_type="application/pdf",
        size_bytes=100,
        storage_path="x",
        sha256="b" * 64,
        status=DocumentStatus.PROCESSED.value,
    )
    db.add(report)
    db.flush()
    db.add(
        DocumentChunk(
            document_id=report.id,
            page_start=1,
            page_end=1,
            section=None,
            content="Revenue grew 12% year over year driven by higher production volumes.",
            content_hash="c" * 64,
        )
    )
    db.add(
        FinancialLineItem(
            document_id=report.id, holding_id=holding.id, metric="revenue", value=Decimal("1000000"),
            unit="unit", currency="NOK", period="FY2024", source_page=1, confidence=1.0,
        )
    )
    db.add(
        FinancialLineItem(
            document_id=report.id, holding_id=holding.id, metric="revenue", value=Decimal("900000"),
            unit="unit", currency="NOK", period="FY2023", source_page=1, confidence=1.0,
        )
    )
    db.add(
        MarketObservation(
            holding_id=holding.id, observed_at=datetime.now(timezone.utc), price=Decimal("30.00"),
            currency="NOK", provider="fake", data_status="delayed",
        )
    )
    db.commit()

    context = build_analysis_context(db, holding.id, snapshot.id)

    assert context.ticker == "VAR.OL"
    assert context.financial_metrics.latest_period == "FY2024"
    assert context.financial_metrics.previous_period == "FY2023"
    # (1,000,000 - 900,000) / 900,000 * 100 = 11.1111...%
    assert context.financial_metrics.revenue_growth_pct == Decimal("11.1111")
    assert context.market.price == Decimal("30.00")
    assert context.market.data_status == "delayed"

    # Blind-pass evidence must NOT surface user_notes as one of the citable
    # evidence items — it's returned separately and withheld by the caller
    # for Pass 1 (§11.3), but it's still present on the context object for
    # Pass 2 to use.
    assert context.user_notes is not None and "energy transition" in context.user_notes

    doc_chunk_items = [e for e in context.evidence_items if e.source_type == "document_chunk"]
    assert len(doc_chunk_items) == 1
    assert "Revenue grew 12%" in doc_chunk_items[0].content

    fact_items = [e for e in context.evidence_items if e.source_type == "financial_line_item"]
    assert len(fact_items) == 2

    market_items = [e for e in context.evidence_items if e.source_type == "market_observation"]
    assert len(market_items) == 1

    assert context.macro_snapshot.available is False
    assert context.sector_research.available is False


def test_excerpt_char_budget_truncates_and_flags(db, monkeypatch):
    from app.config import settings as settings_module

    snapshot = _make_snapshot(db)
    holding = _make_holding(db)
    db.add(PortfolioPosition(snapshot_id=snapshot.id, holding_id=holding.id))

    report = Document(
        holding_id=holding.id,
        type=DocumentType.ANNUAL_REPORT.value,
        original_filename="report.pdf",
        mime_type="application/pdf",
        size_bytes=100,
        storage_path="x",
        sha256="d" * 64,
        status=DocumentStatus.PROCESSED.value,
    )
    db.add(report)
    db.flush()
    db.add(
        DocumentChunk(
            document_id=report.id, page_start=1, page_end=1, section=None,
            content="A" * 500, content_hash="e" * 64,
        )
    )
    db.commit()

    settings_module.get_settings.cache_clear()
    monkeypatch.setenv("LLM_EXCERPT_CHAR_BUDGET", "100")
    settings_module.get_settings.cache_clear()

    context = build_analysis_context(db, holding.id, snapshot.id)
    settings_module.get_settings.cache_clear()  # don't leak into other tests

    assert context.excerpts_truncated is True
    doc_chunk_items = [e for e in context.evidence_items if e.source_type == "document_chunk"]
    assert len(doc_chunk_items[0].content) == 100
