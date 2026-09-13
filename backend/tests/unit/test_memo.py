"""Unit tests for app.services.analysis.memo (architecture §26 Phase 3
"memo generation", §27 Definition of Done: "Memo rendered successfully")."""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from app.models.analysis import AnalysisRun, AnalysisRunStatus, FactorAssessment, HoldingAnalysis
from app.models.holding import Holding
from app.services.analysis.memo import render_holding_memo


def _holding() -> Holding:
    return Holding(
        id=uuid4(), ticker="VAR.OL", name="Vår Energi", asset_class="EQUITY",
        asset_class_raw="Aksje", trading_currency="NOK",
    )


def _run() -> AnalysisRun:
    return AnalysisRun(
        id=uuid4(), portfolio_snapshot_id=uuid4(), status=AnalysisRunStatus.COMPLETED.value,
        provider="google_ai_studio", model_name="gemini-2.5-flash", prompt_version="v1",
        scoring_version="v1", extraction_schema_version="v1", application_version="0.1.0",
        requested_holding_ids=[],
    )


def test_memo_includes_all_sections():
    run = _run()
    holding_analysis = HoldingAnalysis(
        id=uuid4(), analysis_run_id=run.id, holding_id=uuid4(),
        structured_output_json={
            "executive_summary": "Solid producer with growing volumes.",
            "thesis_status": "intact",
            "key_strengths": ["Growing volumes"],
            "key_risks": ["Commodity exposure"],
            "new_information": [],
            "invalidation_triggers": ["Oil price collapse"],
            "decision_considerations": ["Watch next report"],
            "thesis_divergence": {
                "blind_assessment_summary": "Cautiously positive.",
                "user_thesis_summary": "Bullish on energy transition.",
                "material_disagreement": False,
                "disagreement_notes": "Aligned views.",
            },
            "insufficient_evidence_areas": ["Management track record"],
        },
        overall_score=Decimal("6.50"), confidence="medium", created_at=datetime.now(timezone.utc),
    )
    holding_analysis.analysis_run = run

    factor_assessments = [
        FactorAssessment(
            holding_analysis_id=holding_analysis.id, factor="business_quality", score=7,
            confidence="medium", methodology="llm_qualitative", reasoning="Reasonable moat.",
        ),
        FactorAssessment(
            holding_analysis_id=holding_analysis.id, factor="financial_strength", score=6,
            confidence="medium", methodology="llm_qualitative", reasoning="Adequate balance sheet.",
        ),
        FactorAssessment(
            holding_analysis_id=holding_analysis.id, factor="valuation", score=5,
            confidence="low", methodology="llm_qualitative", reasoning="Limited multiples data.",
        ),
    ]

    memo = render_holding_memo(_holding(), holding_analysis, factor_assessments)

    assert "# Vår Energi (VAR.OL)" in memo
    assert "**Overall score:** 6.50/10" in memo
    assert "Solid producer with growing volumes." in memo
    assert "### Business Quality — 7/10 (medium confidence)" in memo
    assert "- Growing volumes" in memo
    assert "- Commodity exposure" in memo
    assert "Cautiously positive." in memo
    assert "Management track record" in memo
    assert "model gemini-2.5-flash" in memo


def test_memo_handles_empty_lists_gracefully():
    run = _run()
    holding_analysis = HoldingAnalysis(
        id=uuid4(), analysis_run_id=run.id, holding_id=uuid4(),
        structured_output_json={
            "executive_summary": "",
            "thesis_status": "new",
            "key_strengths": [],
            "key_risks": [],
            "new_information": [],
            "invalidation_triggers": [],
            "decision_considerations": [],
            "thesis_divergence": {
                "blind_assessment_summary": "n/a",
                "user_thesis_summary": "No notes on record.",
                "material_disagreement": False,
                "disagreement_notes": "",
            },
            "insufficient_evidence_areas": [],
        },
        overall_score=None, confidence="low", created_at=datetime.now(timezone.utc),
    )
    holding_analysis.analysis_run = run

    memo = render_holding_memo(_holding(), holding_analysis, [])

    assert "**Overall score:** n/a/10" in memo
    assert "_No summary produced._" in memo
    assert "_None noted._" in memo
