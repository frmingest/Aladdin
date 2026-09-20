"""
Unit tests for app.services.analysis.llm_analysis — the two-pass
confirmation-bias guardrail (architecture §11.3, §26 Phase 3). A fake
LLMProvider stands in for GoogleAIStudioProvider so these never touch a
network — consistent with how tests/unit/test_yfinance_provider.py avoids
Yahoo Finance and tests/integration/test_valuation_api.py's FakeMarketDataProvider
avoids yfinance (§22: tests independent of external infrastructure).
"""

import json
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest

from app.providers.base import LLMProvider, LLMResponse, LLMUnavailableError
from app.services.analysis.context import (
    AnalysisContext,
    FinancialMetricsSnapshot,
    MarketSnapshot,
    UnavailableSection,
)
from app.services.analysis.llm_analysis import run_two_pass_analysis
from app.services.analysis.prompts import render_blind_user_content

_BLIND_OUTPUT = {
    "executive_summary": "Solid energy producer with growing volumes.",
    "thesis_status": "new",
    "business_quality": {"score": 7, "confidence": "medium", "reasoning": "Reasonable moat."},
    "financial_strength": {"score": 6, "confidence": "medium", "reasoning": "Adequate balance sheet."},
    "valuation": {"score": 5, "confidence": "low", "reasoning": "Limited multiples data."},
    "key_strengths": ["Growing production volumes"],
    "key_risks": ["Commodity price exposure"],
    "new_information": [],
    "invalidation_triggers": ["Sustained oil price collapse"],
    "decision_considerations": ["Monitor next quarterly report"],
    "source_references": ["E1"],
    "insufficient_evidence_areas": ["Management track record"],
}

_RECONCILIATION_OUTPUT = {
    "thesis_divergence": {
        "blind_assessment_summary": "Cautiously positive on fundamentals.",
        "user_thesis_summary": "Investor is bullish on the energy transition angle.",
        "material_disagreement": False,
        "disagreement_notes": "Both views are broadly aligned.",
    },
    "additional_risks": ["Regulatory risk noted by investor"],
    "additional_considerations": [],
    "source_references": [],
}


class FakeLLMProvider(LLMProvider):
    def __init__(self, blind=None, reconciliation=None, fail_on: str | None = None):
        self.blind = blind if blind is not None else _BLIND_OUTPUT
        self.reconciliation = reconciliation if reconciliation is not None else _RECONCILIATION_OUTPUT
        self.calls: list[str] = []
        self.fail_on = fail_on

    def generate_structured(self, *, system_prompt, user_content, response_schema, prompt_version):
        self.calls.append(prompt_version)
        if self.fail_on and self.fail_on in prompt_version:
            raise LLMUnavailableError(f"simulated failure for {prompt_version}")
        payload = self.blind if "persona" in prompt_version else self.reconciliation
        return LLMResponse(
            content=json.dumps(payload), model="fake-model", input_tokens=100, output_tokens=50, latency_ms=1.0
        )


def _make_context(user_notes: str | None) -> AnalysisContext:
    return AnalysisContext(
        holding_id=uuid4(),
        portfolio_snapshot_id=uuid4(),
        ticker="VAR.OL",
        name="Vår Energi",
        asset_class="EQUITY",
        sector="Energy",
        trading_currency="NOK",
        weight_pct=Decimal("60"),
        quantity=Decimal("1200"),
        cost_basis=Decimal("28.40"),
        cost_basis_currency="NOK",
        financial_metrics=FinancialMetricsSnapshot(
            latest_period="FY2024", previous_period="FY2023", revenue_growth_pct=Decimal("11.11"),
            ebitda_margin_pct=Decimal("30.00"), net_income_margin_pct=Decimal("15.00"),
            return_on_equity_pct=Decimal("12.00"), facts_considered=4, insufficient_data=False,
        ),
        market=MarketSnapshot(
            price=Decimal("30.00"), price_currency="NOK", observed_at=datetime.now(timezone.utc),
            data_status="delayed", fx_rate_to_reporting=Decimal("1"), reporting_currency="NOK",
        ),
        evidence_items=[],
        excerpts_truncated=False,
        macro_snapshot=UnavailableSection(),
        sector_research=UnavailableSection(),
        recent_events=UnavailableSection(),
        previous_analysis=None,
        user_notes=user_notes,
    )


def test_blind_pass_payload_surfaces_balance_sheet_health_fields():
    """Buffett/Munger redesign, Sprint 1: render_blind_user_content must
    forward the new interest-coverage/Net-Debt/D-E/average-ROE fields to
    Pass 1 -- otherwise the deterministic work in
    app.services.analysis.context._build_financial_metrics never actually
    reaches the model."""
    context = _make_context(user_notes=None)
    context.financial_metrics.interest_coverage_ratio = Decimal("5.00")
    context.financial_metrics.net_debt_to_ebitda = Decimal("2.67")
    context.financial_metrics.net_debt_to_fcf = Decimal("2.67")
    context.financial_metrics.debt_to_equity_ratio = Decimal("2.00")
    context.financial_metrics.average_return_on_equity_pct = Decimal("26.6667")

    payload = json.loads(render_blind_user_content(context))
    fm = payload["financial_metrics"]

    assert fm["interest_coverage_ratio"] == "5.00"
    assert fm["net_debt_to_ebitda"] == "2.67"
    assert fm["net_debt_to_fcf"] == "2.67"
    assert fm["debt_to_equity_ratio"] == "2.00"
    assert fm["average_return_on_equity_pct"] == "26.6667"


def test_blind_pass_is_called_without_user_notes(monkeypatch):
    captured_payloads = []

    class SpyProvider(FakeLLMProvider):
        def generate_structured(self, *, system_prompt, user_content, response_schema, prompt_version):
            if "persona" in prompt_version:
                captured_payloads.append(json.loads(user_content))
            return super().generate_structured(
                system_prompt=system_prompt, user_content=user_content,
                response_schema=response_schema, prompt_version=prompt_version,
            )

    context = _make_context(user_notes="I believe this is a strong buy due to the energy transition.")
    result = run_two_pass_analysis(SpyProvider(), context, "v1")

    assert "user_notes" not in captured_payloads[0]
    assert result.output.business_quality.score == 7  # Pass 1's score, untouched by reconciliation


def test_reconciliation_skipped_when_no_notes():
    context = _make_context(user_notes=None)
    provider = FakeLLMProvider()

    result = run_two_pass_analysis(provider, context, "v1")

    assert provider.calls == ["persona/v1"]  # reconciliation never called
    assert result.output.thesis_divergence.material_disagreement is False
    assert "no user notes" in result.output.thesis_divergence.disagreement_notes.lower() or \
        "no user thesis" in result.output.thesis_divergence.disagreement_notes.lower()


def test_reconciliation_runs_when_notes_present_and_merges_additional_risks():
    context = _make_context(user_notes="Long-term conviction holding.")
    provider = FakeLLMProvider()

    result = run_two_pass_analysis(provider, context, "v1")

    assert provider.calls == ["persona/v1", "synthesis/v1"]
    assert "Regulatory risk noted by investor" in result.output.key_risks
    assert "Commodity price exposure" in result.output.key_risks
    # Factor scores are still exactly Pass 1's — reconciliation cannot alter them.
    assert result.output.valuation.score == 5


def test_blind_pass_schema_violation_raises_llm_unavailable():
    context = _make_context(user_notes=None)
    provider = FakeLLMProvider(blind={"not": "a valid schema"})

    with pytest.raises(LLMUnavailableError):
        run_two_pass_analysis(provider, context, "v1")


def test_provider_failure_propagates_as_llm_unavailable():
    context = _make_context(user_notes=None)
    provider = FakeLLMProvider(fail_on="persona")

    with pytest.raises(LLMUnavailableError):
        run_two_pass_analysis(provider, context, "v1")
