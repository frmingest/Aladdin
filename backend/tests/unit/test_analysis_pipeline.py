"""Unit tests for app.services.analysis.pipeline — the two-pass
orchestration, against an in-memory SQLite DB and fake providers.

CLAUDE.md Rule 4 (the confirmation-bias guardrail) gets its own direct
test below: the blind pass's own prompt text must never contain the
holding's notes, while the reconciliation pass's must."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.domain.analysis_schema import BlindPassOutputV1, ReconciliationOutputV1
from app.models import Base, Document, FinancialLineItem, Holding
from app.models.analysis import EquityAnalysisRunStatus
from app.providers.base import (
    FxRate,
    LLMResponse,
    LLMUnavailableError,
    LLMUsageMetrics,
    PricePoint,
    RiskFreeRate,
)
from app.services.analysis.notes import set_holding_note
from app.services.analysis.pipeline import NotEquityAnalyzableError, run_full_analysis

D = Decimal


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


class _FakeMarket:
    name = "fake"

    def get_current_price(self, ticker, *, currency_hint=None):
        return PricePoint(price=D("100"), currency="USD", observed_at=datetime.now(timezone.utc), provider="fake")

    def get_price_history(self, ticker, *, years=5, currency_hint=None):  # pragma: no cover
        raise NotImplementedError

    def get_fx_rate(self, from_currency, to_currency):
        return FxRate(from_currency=from_currency, to_currency=to_currency, rate=D("1"), observed_at=datetime.now(timezone.utc), provider="fake")

    def get_beta(self, ticker):
        return D("1.0")


class _FakeRate:
    def get_risk_free_rate(self, currency):
        return RiskFreeRate(currency=currency, rate=D("4.0"), observed_at=datetime.now(timezone.utc), provider="fake", source_series_id="FAKE10Y")


class _FakeResearch:
    name = "fake"

    def get_macro_research(self):
        return []

    def get_sector_research(self, sector):
        return []

    def get_company_research(self, *, company_name, ticker, sector):
        return []


_VERDICT = {
    "rating": "Buy",
    "thesis_bullets": ["a", "b", "c"],
    "top_risks": ["r1", "r2"],
    "metrics_to_monitor": ["m1"],
    "invalidation_triggers": ["t1"],
    "evidence_ids": ["EV-001"],
}


def _blind_json() -> str:
    return BlindPassOutputV1(
        moat={
            "circle_of_competence_summary": "Simple business.",
            "overall_rating": "Narrow",
            "sources": [{"source": "brand", "rating": "Narrow", "reasoning": "ok", "evidence_ids": ["EV-001"]}],
            "evidence_ids": ["EV-001"],
        },
        capital_efficiency={"summary": "fine", "evidence_ids": ["EV-001"]},
        financial_fortress={"summary": "fine", "evidence_ids": ["EV-001"]},
        macro_stress_test={"summary": "fine", "evidence_ids": ["EV-001"]},
        valuation_synthesis={"summary": "fine", "evidence_ids": ["EV-001"]},
        verdict=_VERDICT,
    ).model_dump_json()


def _reconciliation_json() -> str:
    return ReconciliationOutputV1(
        verdict=_VERDICT,
        reconciliation_narrative="unchanged",
        changed_from_blind=False,
        evidence_ids=["EV-001"],
    ).model_dump_json()


class _RecordingLLM:
    """Succeeds every call, recording every (system_prompt, user_prompt,
    response_schema) it was given, for asserting what it did/didn't see."""

    name = "recording_llm"

    def __init__(self):
        self.calls: list[tuple[str, str, type]] = []

    def generate_structured(self, *, system_prompt, user_prompt, response_schema):
        self.calls.append((system_prompt, user_prompt, response_schema))
        content = _blind_json() if response_schema is BlindPassOutputV1 else _reconciliation_json()
        return LLMResponse(content=content, usage=LLMUsageMetrics(provider=self.name, model="fake-model", input_tokens=1, output_tokens=1, total_tokens=2))


class _FailingLLM:
    name = "failing_llm"

    def generate_structured(self, *, system_prompt, user_prompt, response_schema):
        raise LLMUnavailableError("simulated outage")


class _FailOnceThenFailLLM:
    """Fails the blind pass, never called again (used to prove a FAILED
    run is persisted rather than partially retried)."""

    name = "fail_once"

    def generate_structured(self, *, system_prompt, user_prompt, response_schema):
        raise LLMUnavailableError("blind pass outage")


def _stock_holding(**overrides) -> Holding:
    defaults = {"ticker": "AAPL", "name": "Apple Inc.", "trading_currency": "USD", "sector": "Technology", "asset_class_raw": "stock"}
    defaults.update(overrides)
    return Holding(**defaults)


def _with_two_periods(db: Session, holding: Holding) -> None:
    document = Document(
        holding=holding, type="filing", original_filename="10k.pdf", mime_type="application/pdf",
        size_bytes=1, storage_path="documents/10k.pdf", sha256="a" * 64, status="processed", quality_flags={},
    )
    db.add(document)
    db.flush()
    for period, net_income, equity in (("FY2024", "100", "500"), ("FY2025", "120", "550")):
        for metric, value in {
            "net_income": net_income, "total_equity": equity,
            "depreciation_and_amortization": "10", "capital_expenditures": "5", "shares_outstanding": "10",
        }.items():
            db.add(FinancialLineItem(document=document, holding=holding, metric=metric, value=D(value), unit="USD", currency="USD", period=period, confidence=0.9))
    db.commit()


def test_rejects_non_equity_holding():
    db = _session()
    holding = Holding(ticker="BND", name="Bond Fund", trading_currency="USD", asset_class_raw="bond_fund")
    db.add(holding)
    db.commit()

    try:
        run_full_analysis(
            db, holding, llm_provider=_RecordingLLM(), llm_fallback_provider=None,
            market_data_provider=_FakeMarket(), risk_free_rate_provider=_FakeRate(), research_provider=_FakeResearch(),
        )
        raise AssertionError("expected NotEquityAnalyzableError")
    except NotEquityAnalyzableError:
        pass


def test_full_pipeline_completes_and_sets_deterministic_price_target():
    db = _session()
    holding = _stock_holding()
    db.add(holding)
    db.commit()
    _with_two_periods(db, holding)

    run = run_full_analysis(
        db, holding, llm_provider=_RecordingLLM(), llm_fallback_provider=None,
        market_data_provider=_FakeMarket(), risk_free_rate_provider=_FakeRate(), research_provider=_FakeResearch(),
    )
    assert run.status == EquityAnalysisRunStatus.COMPLETED.value
    assert run.provider == "recording_llm"
    assert run.model_name == "fake-model"
    assert run.blind_pass_json is not None
    assert run.reconciliation_json is not None
    # DCF was computable (2 periods) -> a price target range should be set
    assert run.price_target_low is not None
    assert run.price_target_high is not None
    assert run.price_target_low <= run.price_target_high


def test_blind_pass_never_sees_user_notes_but_reconciliation_does():
    db = _session()
    holding = _stock_holding()
    db.add(holding)
    db.commit()
    _with_two_periods(db, holding)
    set_holding_note(db, holding.id, "I think this is overvalued and management is untrustworthy.")

    llm = _RecordingLLM()
    run_full_analysis(
        db, holding, llm_provider=llm, llm_fallback_provider=None,
        market_data_provider=_FakeMarket(), risk_free_rate_provider=_FakeRate(), research_provider=_FakeResearch(),
    )

    blind_calls = [c for c in llm.calls if c[2] is BlindPassOutputV1]
    reconciliation_calls = [c for c in llm.calls if c[2] is ReconciliationOutputV1]
    assert len(blind_calls) == 1
    assert len(reconciliation_calls) == 1

    blind_system, blind_user, _ = blind_calls[0]
    _reconciliation_system, reconciliation_user, _ = reconciliation_calls[0]

    assert "overvalued" not in blind_system
    assert "overvalued" not in blind_user
    assert "untrustworthy" not in blind_system
    assert "untrustworthy" not in blind_user
    assert "overvalued" in reconciliation_user


def test_falls_back_to_secondary_provider_when_primary_unavailable():
    db = _session()
    holding = _stock_holding()
    db.add(holding)
    db.commit()
    _with_two_periods(db, holding)

    fallback = _RecordingLLM()
    run = run_full_analysis(
        db, holding, llm_provider=_FailingLLM(), llm_fallback_provider=fallback,
        market_data_provider=_FakeMarket(), risk_free_rate_provider=_FakeRate(), research_provider=_FakeResearch(),
    )
    assert run.status == EquityAnalysisRunStatus.COMPLETED.value
    assert run.provider == "recording_llm"
    assert len(fallback.calls) == 2  # blind + reconciliation


def test_blind_pass_failure_with_no_fallback_persists_failed_run():
    db = _session()
    holding = _stock_holding()
    db.add(holding)
    db.commit()
    _with_two_periods(db, holding)

    run = run_full_analysis(
        db, holding, llm_provider=_FailOnceThenFailLLM(), llm_fallback_provider=None,
        market_data_provider=_FakeMarket(), risk_free_rate_provider=_FakeRate(), research_provider=_FakeResearch(),
    )
    assert run.status == EquityAnalysisRunStatus.FAILED.value
    assert run.error_message and "blind pass failed" in run.error_message
    assert run.blind_pass_json is None


class _BlindOnlyThenFailLLM:
    """Succeeds the blind pass, fails the reconciliation pass — used to
    prove the blind pass's own output survives a reconciliation failure."""

    name = "blind_only_then_fail"

    def generate_structured(self, *, system_prompt, user_prompt, response_schema):
        if response_schema is BlindPassOutputV1:
            return LLMResponse(content=_blind_json(), usage=LLMUsageMetrics(provider=self.name, model="m", input_tokens=1, output_tokens=1, total_tokens=2))
        raise LLMUnavailableError("reconciliation outage")


def test_reconciliation_failure_keeps_blind_pass_result():
    db = _session()
    holding = _stock_holding()
    db.add(holding)
    db.commit()
    _with_two_periods(db, holding)

    run = run_full_analysis(
        db, holding, llm_provider=_BlindOnlyThenFailLLM(), llm_fallback_provider=None,
        market_data_provider=_FakeMarket(), risk_free_rate_provider=_FakeRate(), research_provider=_FakeResearch(),
    )
    assert run.status == EquityAnalysisRunStatus.BLIND_ONLY.value
    assert run.blind_pass_json is not None
    assert run.reconciliation_json is None
    assert run.error_message and "reconciliation pass failed" in run.error_message
