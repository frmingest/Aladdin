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
from app.models.research import MacroObservation, ResearchItem, ResearchRun, ResearchRunStatus, ResearchRunType
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
    assert context.company_research.available is False


def test_context_surfaces_macro_and_sector_research_when_available(db):
    """§26 Phase 4: once a macro/sector research refresh has persisted data,
    build_analysis_context must surface it (not the UnavailableSection
    fallback) and add it as citable evidence, reusing the same generic
    evidence-citation mechanism as document/financial/market evidence."""
    snapshot = _make_snapshot(db)
    holding = _make_holding(db)  # sector="Energy" per the fixture default
    db.add(PortfolioPosition(snapshot_id=snapshot.id, holding_id=holding.id, weight_pct=Decimal("100")))

    db.add(
        MacroObservation(
            series_key="us_policy_rate",
            provider="fred",
            region="US",
            value=Decimal("5.33"),
            unit="percent",
            observed_at=datetime.now(timezone.utc),
        )
    )
    macro_run = ResearchRun(
        type=ResearchRunType.MACRO.value,
        sector=None,
        status=ResearchRunStatus.COMPLETED.value,
        methodology_version="v1",
        completed_at=datetime.now(timezone.utc),
    )
    db.add(macro_run)
    db.flush()
    db.add(
        ResearchItem(
            research_run_id=macro_run.id,
            holding_id=None,
            source_url="https://example.com/macro",
            source_name="example.com",
            published_at=None,
            retrieved_at=datetime.now(timezone.utc),
            title="Fed holds rates steady",
            summary="The Fed left rates unchanged this month.",
            source_type="macro_news",
        )
    )

    sector_run = ResearchRun(
        type=ResearchRunType.SECTOR.value,
        sector="Energy",
        status=ResearchRunStatus.COMPLETED.value,
        methodology_version="v1",
        completed_at=datetime.now(timezone.utc),
    )
    db.add(sector_run)
    db.flush()
    db.add(
        ResearchItem(
            research_run_id=sector_run.id,
            holding_id=None,
            source_url="https://example.com/sector",
            source_name="example.com",
            published_at=None,
            retrieved_at=datetime.now(timezone.utc),
            title="Oil prices tick up",
            summary="Energy sector benefits from higher crude prices.",
            source_type="sector_research",
        )
    )

    company_run = ResearchRun(
        type=ResearchRunType.COMPANY.value,
        holding_id=holding.id,
        status=ResearchRunStatus.COMPLETED.value,
        methodology_version="v1",
        completed_at=datetime.now(timezone.utc),
    )
    db.add(company_run)
    db.flush()
    db.add(
        ResearchItem(
            research_run_id=company_run.id,
            holding_id=holding.id,
            source_url="https://example.com/company",
            source_name="example.com",
            published_at=None,
            retrieved_at=datetime.now(timezone.utc),
            title="Vår Energi announces new Gulf licence",
            summary="Vår Energi specific development.",
            source_type="company_research",
        )
    )
    db.commit()

    context = build_analysis_context(db, holding.id, snapshot.id)

    assert context.macro_snapshot.available is True
    assert context.macro_snapshot.observations[0].series_key == "us_policy_rate"
    assert context.sector_research.available is True
    assert context.sector_research.items[0].title == "Oil prices tick up"
    assert context.company_research.available is True
    assert context.company_research.items[0].title == "Vår Energi announces new Gulf licence"

    macro_evidence = [e for e in context.evidence_items if e.source_type == "macro_observation"]
    assert len(macro_evidence) == 1
    research_evidence = [e for e in context.evidence_items if e.source_type == "research_item"]
    assert len(research_evidence) == 3
    assert any("macro news" in e.label for e in research_evidence)
    assert any("Energy sector research" in e.label for e in research_evidence)
    assert any("VAR.OL company research" in e.label for e in research_evidence)


def test_holding_in_two_accounts_within_one_snapshot_does_not_crash(db):
    """Reproduces a production crash: a holding split across two accounts
    (see app.models.account.Account — the upload merge key is
    (account_id, ticker), not ticker alone) gets one PortfolioPosition row
    per account within the same snapshot. build_analysis_context used to
    assume exactly one position per (snapshot, holding) and crashed with
    sqlalchemy.exc.MultipleResultsFound the moment an analysis targeted a
    holding held in more than one account — the same class of bug already
    fixed once for portfolio composition (_build_concentration summing by
    ticker instead of combining multi-account rows)."""
    from app.models.account import Account

    snapshot = _make_snapshot(db)
    holding = _make_holding(db)

    account_a = Account(name="Account A", account_number="AAA")
    account_b = Account(name="Account B", account_number="BBB")
    db.add_all([account_a, account_b])
    db.flush()

    db.add(
        PortfolioPosition(
            snapshot_id=snapshot.id,
            holding_id=holding.id,
            account_id=account_a.id,
            weight_pct=Decimal("12.5"),
            quantity=Decimal("100"),
            cost_basis=Decimal("1000"),
            cost_basis_currency="NOK",
        )
    )
    db.add(
        PortfolioPosition(
            snapshot_id=snapshot.id,
            holding_id=holding.id,
            account_id=account_b.id,
            weight_pct=Decimal("7.5"),
            quantity=Decimal("50"),
            cost_basis=Decimal("400"),
            cost_basis_currency="NOK",
        )
    )
    db.add(
        MarketObservation(
            holding_id=holding.id, observed_at=datetime.now(timezone.utc), price=Decimal("10.00"),
            currency="NOK", provider="fake", data_status="delayed",
        )
    )
    db.commit()

    context = build_analysis_context(db, holding.id, snapshot.id)

    assert context.weight_pct == Decimal("20.0")
    assert context.quantity == Decimal("150")
    assert context.cost_basis == Decimal("1400")
    assert context.cost_basis_currency == "NOK"


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


def test_context_computes_balance_sheet_health_and_capital_efficiency(db):
    """Buffett/Munger redesign, Sprint 1 (claude/buffett-munger-redesign-
    sprint-plan-2026-09-20.md): interest coverage, Net Debt/EBITDA, Net
    Debt/FCF, D/E, and the 3-5yr average ROE all derive from the four new
    canonical metrics (total_debt, cash_and_equivalents,
    capital_expenditures, interest_expense) plus existing ones -- purely
    deterministic, computed in _build_financial_metrics, never by the LLM."""
    snapshot = _make_snapshot(db)
    holding = _make_holding(db, ticker="EQNR.OL", name="Equinor")
    db.add(PortfolioPosition(snapshot_id=snapshot.id, holding_id=holding.id, weight_pct=Decimal("100")))

    report = Document(
        holding_id=holding.id,
        type=DocumentType.ANNUAL_REPORT.value,
        original_filename="annual-report-2025.pdf",
        mime_type="application/pdf",
        size_bytes=100,
        storage_path="x",
        sha256="f" * 64,
        status=DocumentStatus.PROCESSED.value,
    )
    db.add(report)
    db.flush()

    def _fact(period, metric, value):
        db.add(
            FinancialLineItem(
                document_id=report.id, holding_id=holding.id, metric=metric, value=Decimal(value),
                unit="unit", currency="NOK", period=period, source_page=1, confidence=1.0,
            )
        )

    # FY2024 (latest): the balance-sheet-health / interest-coverage inputs
    # are only ever taken from the latest period.
    _fact("FY2024", "total_debt", "1000000")
    _fact("FY2024", "cash_and_equivalents", "200000")
    _fact("FY2024", "ebitda", "300000")
    _fact("FY2024", "ebit", "250000")
    _fact("FY2024", "interest_expense", "50000")
    _fact("FY2024", "operating_cash_flow", "400000")
    _fact("FY2024", "capital_expenditures", "100000")
    _fact("FY2024", "total_equity", "500000")
    _fact("FY2024", "net_income", "150000")

    # FY2023 and FY2022: only what the 3-5yr average ROE needs -- these
    # predate when total_debt/cash_and_equivalents/capital_expenditures/
    # interest_expense became extractable at all, exactly the "historical
    # periods may lack the new labels" gap the implementation comment notes.
    _fact("FY2023", "total_equity", "400000")
    _fact("FY2023", "net_income", "120000")
    _fact("FY2022", "total_equity", "500000")
    _fact("FY2022", "net_income", "100000")

    db.commit()

    context = build_analysis_context(db, holding.id, snapshot.id)
    m = context.financial_metrics

    # net_debt = 1,000,000 - 200,000 = 800,000
    # net_debt_to_ebitda = 800,000 / 300,000 = 2.6666... -> 2.67
    assert m.net_debt_to_ebitda == Decimal("2.67")
    # fcf = 400,000 - 100,000 = 300,000; net_debt_to_fcf = 800,000 / 300,000 -> 2.67
    assert m.net_debt_to_fcf == Decimal("2.67")
    # interest_coverage = ebit / interest_expense = 250,000 / 50,000 = 5.00
    assert m.interest_coverage_ratio == Decimal("5.00")
    # debt_to_equity = 1,000,000 / 500,000 = 2.00
    assert m.debt_to_equity_ratio == Decimal("2.00")
    # ROE per period: FY2024 30%, FY2023 30%, FY2022 20% -> average 26.6667%
    assert m.return_on_equity_pct == Decimal("30.0000")
    assert m.average_return_on_equity_pct == Decimal("26.6667")


def test_context_balance_sheet_health_none_when_inputs_not_extracted(db):
    """A holding with only the original canonical metrics (pre-dating this
    session's four new labels) must render the new fields as None --
    insufficient data, never a fabricated ratio (§13.3/§21) -- exactly like
    every other calc.* function in this codebase."""
    snapshot = _make_snapshot(db)
    holding = _make_holding(db, ticker="TEL.OL", name="Telenor")
    db.add(PortfolioPosition(snapshot_id=snapshot.id, holding_id=holding.id, weight_pct=Decimal("100")))

    report = Document(
        holding_id=holding.id,
        type=DocumentType.ANNUAL_REPORT.value,
        original_filename="annual-report-2025.pdf",
        mime_type="application/pdf",
        size_bytes=100,
        storage_path="x",
        sha256="g" * 64,
        status=DocumentStatus.PROCESSED.value,
    )
    db.add(report)
    db.flush()
    db.add(
        FinancialLineItem(
            document_id=report.id, holding_id=holding.id, metric="revenue", value=Decimal("1000000"),
            unit="unit", currency="NOK", period="FY2024", source_page=1, confidence=1.0,
        )
    )
    db.commit()

    context = build_analysis_context(db, holding.id, snapshot.id)
    m = context.financial_metrics

    assert m.interest_coverage_ratio is None
    assert m.net_debt_to_ebitda is None
    assert m.net_debt_to_fcf is None
    assert m.debt_to_equity_ratio is None
    assert m.average_return_on_equity_pct is None
