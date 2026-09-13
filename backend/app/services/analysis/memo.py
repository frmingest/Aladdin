"""
Deterministic memo rendering (architecture §26 Phase 3 "memo generation",
§27 Definition of Done: "Memo rendered successfully").

Pure string templating over already-persisted, already-validated data — no
LLM call happens here. The memo presents what's already in
HoldingAnalysis/FactorAssessment, it doesn't produce new analysis.
"""

from app.models.analysis import FactorAssessment, HoldingAnalysis
from app.models.holding import Holding

_FACTOR_LABELS = {
    "business_quality": "Business Quality",
    "financial_strength": "Financial Strength",
    "valuation": "Valuation",
}


def render_holding_memo(
    holding: Holding, holding_analysis: HoldingAnalysis, factor_assessments: list[FactorAssessment]
) -> str:
    output = holding_analysis.structured_output_json
    lines: list[str] = []

    lines.append(f"# {holding.name} ({holding.ticker})")
    lines.append("")
    score_display = holding_analysis.overall_score if holding_analysis.overall_score is not None else "n/a"
    lines.append(f"**Overall score:** {score_display}/10  **Confidence:** {holding_analysis.confidence}")
    lines.append(f"**Thesis status:** {output.get('thesis_status', 'unknown')}")
    lines.append("")
    lines.append("## Executive Summary")
    lines.append("")
    lines.append(output.get("executive_summary", "").strip() or "_No summary produced._")
    lines.append("")

    lines.append("## Factor Assessments")
    lines.append("")
    by_factor = {fa.factor: fa for fa in factor_assessments}
    for factor_key, label in _FACTOR_LABELS.items():
        fa = by_factor.get(factor_key)
        if fa is None:
            continue
        lines.append(f"### {label} — {fa.score}/10 ({fa.confidence} confidence)")
        lines.append("")
        lines.append(fa.reasoning.strip())
        lines.append("")

    def bullet_section(title: str, items: list[str]) -> None:
        lines.append(f"## {title}")
        lines.append("")
        if items:
            lines.extend(f"- {item}" for item in items)
        else:
            lines.append("_None noted._")
        lines.append("")

    bullet_section("Key Strengths", output.get("key_strengths", []))
    bullet_section("Key Risks", output.get("key_risks", []))
    bullet_section("New Information Since Last Analysis", output.get("new_information", []))
    bullet_section("Invalidation Triggers", output.get("invalidation_triggers", []))
    bullet_section("Decision Considerations", output.get("decision_considerations", []))

    divergence = output.get("thesis_divergence") or {}
    lines.append("## Thesis Divergence (blind assessment vs. your notes)")
    lines.append("")
    lines.append(f"- **Blind assessment:** {divergence.get('blind_assessment_summary', 'n/a')}")
    lines.append(f"- **Your notes:** {divergence.get('user_thesis_summary', 'n/a')}")
    lines.append(f"- **Material disagreement:** {'Yes' if divergence.get('material_disagreement') else 'No'}")
    if divergence.get("disagreement_notes"):
        lines.append(f"- **Notes:** {divergence['disagreement_notes']}")
    lines.append("")

    insufficient = output.get("insufficient_evidence_areas", [])
    if insufficient:
        lines.append("## Insufficient Evidence")
        lines.append("")
        lines.extend(f"- {item}" for item in insufficient)
        lines.append("")

    lines.append("---")
    run = holding_analysis.analysis_run
    lines.append(
        f"_Generated {holding_analysis.created_at.isoformat()} — "
        f"model {run.model_name}, prompt {run.prompt_version}, scoring {run.scoring_version}._"
    )

    return "\n".join(lines)
