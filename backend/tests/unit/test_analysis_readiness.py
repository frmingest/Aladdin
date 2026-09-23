"""Unit tests for app.services.analysis.readiness (feature F2) and the
placeholder-ticker detector it relies on."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.models import Base, Document, FinancialLineItem, Holding
from app.models.market import MarketObservation
from app.models.research import ResearchRun, ResearchRunStatus, ResearchRunType
from app.providers.budget import DailyBudgetGuard
from app.services.analysis.readiness import check_analysis_readiness
from app.services.portfolio_import.ingestion import looks_like_placeholder_ticker

D = Decimal
NOW = datetime.now(timezone.utc)


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def _settings(**overrides):
    base = {
        "market_data_provider": "yfinance",
        "research_provider": "gemini_search",
        "google_ai_studio_api_key": "test-key",
        "fred_api_key": "test-fred",
        "llm_provider": "google_ai_studio",
        "llm_fallback_provider": "none",
        "llm_rate_limit_rpd": 20,
    }
    base.update(overrides)
    return get_settings().model_copy(update=base)


def _holding(db: Session, **kwargs) -> Holding:
    defaults = {
        "ticker": "AAPL",
        "name": "Apple Inc.",
        "trading_currency": "USD",
        "sector": "Information Technology",
        "asset_class_raw": "stock",
    }
    defaults.update(kwargs)
    holding = Holding(**defaults)
    db.add(holding)
    db.commit()
    return holding


def _add_years(db: Session, holding: Holding, years: list[int], *, with_equity: bool = True) -> None:
    document = Document(
        holding=holding, type="filing", original_filename="10k.pdf", mime_type="application/pdf",
        size_bytes=1, storage_path=f"documents/{holding.ticker}.pdf", sha256="c" * 64,
        status="processed", quality_flags={},
    )
    db.add(document)
    db.flush()
    for year in years:
        metrics = {"net_income": "100", "revenue": "1000"}
        if with_equity:
            metrics["total_equity"] = "500"
        for metric, value in metrics.items():
            db.add(FinancialLineItem(
                document=document, holding=holding, metric=metric, value=D(value), unit="USD",
                currency="USD", period=f"FY{year}", confidence=0.9,
            ))
    db.commit()


def _add_price(db: Session, holding: Holding, *, age_hours: float) -> None:
    db.add(MarketObservation(
        holding_id=holding.id, observed_at=NOW - timedelta(hours=age_hours), price=D("150"),
        currency="USD", provider="fake",
    ))
    db.commit()


def _add_research(db: Session, type_: str, *, sector=None, holding_id=None, age_hours: float = 1) -> None:
    db.add(ResearchRun(
        type=type_, sector=sector, holding_id=holding_id, status=ResearchRunStatus.COMPLETED.value,
        completed_at=NOW - timedelta(hours=age_hours), methodology_version="v1",
    ))
    db.commit()


def _all_fresh_research(db: Session, holding: Holding) -> None:
    _add_research(db, ResearchRunType.MACRO.value)
    _add_research(db, ResearchRunType.SECTOR.value, sector=holding.sector)
    _add_research(db, ResearchRunType.COMPANY.value, holding_id=holding.id)


def _check(report, key):
    return next(c for c in report.checks if c.key == key)


def test_fully_prepared_holding_is_ready_and_only_costs_the_two_passes():
    db = _session()
    holding = _holding(db)
    _add_years(db, holding, [2021, 2022, 2023, 2024, 2025])
    _add_price(db, holding, age_hours=2)
    _all_fresh_research(db, holding)

    report = check_analysis_readiness(db, holding, settings=_settings(), budget_guard=DailyBudgetGuard(daily_limit=20))

    assert report.ready
    assert report.blockers == 0 and report.warnings == 0
    assert report.estimated_gemini_calls == 2
    assert report.gemini_calls_remaining_today == 20


def test_non_equity_instrument_blocks():
    db = _session()
    holding = _holding(db, ticker="BND", name="Some Bond Fund", asset_class_raw="bond_fund")
    report = check_analysis_readiness(db, holding, settings=_settings(), budget_guard=None)
    assert not report.ready
    assert _check(report, "instrument_type").status == "block"


def test_legacy_equity_default_blocks_with_fix_instruction():
    db = _session()
    holding = _holding(db, asset_class_raw="equity")
    report = check_analysis_readiness(db, holding, settings=_settings(), budget_guard=None)
    check = _check(report, "instrument_type")
    assert check.status == "block"
    assert "Holdings page" in check.detail


def test_stub_providers_and_missing_key_block():
    db = _session()
    holding = _holding(db)
    settings = _settings(market_data_provider="stub", research_provider="stub", google_ai_studio_api_key=None)
    check = _check(check_analysis_readiness(db, holding, settings=settings, budget_guard=None), "providers")
    assert check.status == "block"
    assert "MARKET_DATA_PROVIDER" in check.detail
    assert "RESEARCH_PROVIDER" in check.detail
    assert "GOOGLE_AI_STUDIO_API_KEY" in check.detail


def test_missing_fred_key_only_warns():
    db = _session()
    holding = _holding(db)
    check = _check(check_analysis_readiness(db, holding, settings=_settings(fred_api_key=None), budget_guard=None), "providers")
    assert check.status == "warn"


def test_no_financials_blocks():
    db = _session()
    holding = _holding(db)
    check = _check(check_analysis_readiness(db, holding, settings=_settings(), budget_guard=None), "financials")
    assert check.status == "block"


def test_two_years_of_financials_warns():
    db = _session()
    holding = _holding(db)
    _add_years(db, holding, [2024, 2025])
    check = _check(check_analysis_readiness(db, holding, settings=_settings(), budget_guard=None), "financials")
    assert check.status == "warn"
    assert "2 year(s)" in check.detail


def test_years_without_equity_warn_about_roe():
    db = _session()
    holding = _holding(db)
    _add_years(db, holding, [2023, 2024, 2025], with_equity=False)
    check = _check(check_analysis_readiness(db, holding, settings=_settings(), budget_guard=None), "financials")
    assert check.status == "warn"
    assert "ROE computable for 0" in check.detail


def test_placeholder_ticker_without_price_blocks():
    db = _session()
    holding = _holding(db, ticker="VAR-ENERGI", name="Vår Energi")
    check = _check(check_analysis_readiness(db, holding, settings=_settings(), budget_guard=None), "ticker")
    assert check.status == "block"


def test_real_ticker_never_priced_warns():
    db = _session()
    holding = _holding(db)
    report = check_analysis_readiness(db, holding, settings=_settings(), budget_guard=None)
    assert _check(report, "ticker").status == "warn"
    assert _check(report, "price").status == "warn"


def test_stale_price_warns_fresh_price_ok():
    db = _session()
    holding = _holding(db)
    _add_price(db, holding, age_hours=72)
    assert _check(check_analysis_readiness(db, holding, settings=_settings(), budget_guard=None), "price").status == "warn"
    _add_price(db, holding, age_hours=1)
    report = check_analysis_readiness(db, holding, settings=_settings(), budget_guard=None)
    assert _check(report, "price").status == "ok"
    assert _check(report, "ticker").status == "ok"


def test_stale_research_adds_to_estimated_calls():
    db = _session()
    holding = _holding(db)
    _add_research(db, ResearchRunType.MACRO.value, age_hours=1)
    _add_research(db, ResearchRunType.SECTOR.value, sector=holding.sector, age_hours=100)
    # company research never ran
    report = check_analysis_readiness(db, holding, settings=_settings(), budget_guard=None)
    check = _check(report, "research")
    assert check.status == "warn"
    assert "sector" in check.detail and "company" in check.detail
    assert report.estimated_gemini_calls == 2 + 2


def test_no_sector_warns_and_skips_sector_research():
    db = _session()
    holding = _holding(db, sector=None)
    _add_research(db, ResearchRunType.MACRO.value)
    _add_research(db, ResearchRunType.COMPANY.value, holding_id=holding.id)
    report = check_analysis_readiness(db, holding, settings=_settings(), budget_guard=None)
    assert _check(report, "sector").status == "warn"
    assert _check(report, "research").status == "ok"
    assert report.estimated_gemini_calls == 2


def test_insufficient_quota_blocks_without_fallback():
    db = _session()
    holding = _holding(db)
    guard = DailyBudgetGuard(daily_limit=20)
    guard.record_usage(19)
    report = check_analysis_readiness(db, holding, settings=_settings(), budget_guard=guard)
    check = _check(report, "quota")
    assert check.status == "block"
    assert report.gemini_calls_remaining_today == 1


def test_insufficient_quota_only_warns_with_mistral_fallback():
    db = _session()
    holding = _holding(db)
    guard = DailyBudgetGuard(daily_limit=20)
    guard.record_usage(19)
    report = check_analysis_readiness(db, holding, settings=_settings(llm_fallback_provider="mistral"), budget_guard=guard)
    assert _check(report, "quota").status == "warn"


def test_mistral_primary_does_not_count_passes_against_gemini():
    db = _session()
    holding = _holding(db)
    _all_fresh_research(db, holding)
    report = check_analysis_readiness(
        db, holding, settings=_settings(llm_provider="mistral", mistral_api_key="k"), budget_guard=None
    )
    assert report.estimated_gemini_calls == 0


def test_gemini_primary_has_no_local_llm_check():
    db = _session()
    holding = _holding(db)
    report = check_analysis_readiness(db, holding, settings=_settings(), budget_guard=None)
    assert all(c.key != "local_llm" for c in report.checks)


def test_ollama_primary_reachable_is_ok_and_costs_no_gemini_passes(monkeypatch):
    from app.providers.ollama_provider import OllamaHealth
    from app.services.analysis import readiness

    monkeypatch.setattr(readiness, "check_ollama_health", lambda **_: OllamaHealth(True, "up"))
    db = _session()
    holding = _holding(db)
    _all_fresh_research(db, holding)
    report = check_analysis_readiness(db, holding, settings=_settings(llm_provider="ollama"), budget_guard=None)
    assert _check(report, "local_llm").status == "ok"
    assert report.estimated_gemini_calls == 0


def test_ollama_down_blocks_without_fallback_and_warns_with_one(monkeypatch):
    from app.providers.ollama_provider import OllamaHealth
    from app.services.analysis import readiness

    monkeypatch.setattr(readiness, "check_ollama_health", lambda **_: OllamaHealth(False, "down"))
    db = _session()
    holding = _holding(db)
    blocked = check_analysis_readiness(db, holding, settings=_settings(llm_provider="ollama"), budget_guard=None)
    assert _check(blocked, "local_llm").status == "block"
    warned = check_analysis_readiness(
        db, holding,
        settings=_settings(llm_provider="ollama", llm_fallback_provider="google_ai_studio"),
        budget_guard=None,
    )
    assert _check(warned, "local_llm").status == "warn"


@pytest.mark.parametrize(
    ("ticker", "name", "expected"),
    [
        ("VAR-ENERGI", "Vår Energi", True),
        ("EQUINOR", "Equinor", True),
        ("SALMON-EVOLUTION-2", "Salmon Evolution", True),
        ("META", "Meta", False),  # short single-word slug can be a real symbol
        ("EQNR.OL", "Equinor", False),
        ("AAPL", "Apple Inc.", False),
        ("", "", False),
    ],
)
def test_looks_like_placeholder_ticker(ticker, name, expected):
    assert looks_like_placeholder_ticker(ticker, name) is expected
