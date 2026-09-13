"""
Two-pass LLM analysis (architecture §11.3 confirmation-bias guardrail,
§26 Phase 3).

Pass 1 — blind: the evidence packet WITHOUT the user's own notes/thesis is
sent to the Buffett/Munger persona (prompts/persona/{version}.md) with
response_schema=BlindAnalysisOutput, so the model forms an independent view
before it can be anchored by what the user already believes.

Pass 2 — reconciliation: Pass 1's own output plus the user's notes go to the
synthesis persona (prompts/synthesis/{version}.md) with
response_schema=ReconciliationOutput. There is no thesis ledger yet (that's
Phase 5) so `app.models.portfolio.PortfolioPosition.notes` is the stand-in
"existing thesis" for this guardrail — see docs/decisions/0006.

Only the reconciliation fields are taken from Pass 2 — the persisted factor
scores are always Pass 1's. The whole point of the blind pass is that it
isn't influenced by what the user already believes, and folding Pass 2 back
into the scores would quietly undo that on every single run.
"""

from dataclasses import dataclass

from app.providers.base import LLMProvider, LLMUnavailableError
from app.schemas.analysis import (
    BlindAnalysisOutput,
    HoldingAnalysisOutput,
    ReconciliationOutput,
    ThesisDivergenceOutput,
)
from app.services.analysis.context import AnalysisContext
from app.services.analysis.prompts import (
    load_persona_prompt,
    load_synthesis_prompt,
    render_blind_user_content,
    render_reconciliation_user_content,
)


@dataclass
class LLMAnalysisResult:
    output: HoldingAnalysisOutput
    blind_output: BlindAnalysisOutput
    reconciliation_output: ReconciliationOutput
    prompt_version: str
    model_name: str
    total_input_tokens: int
    total_output_tokens: int


def run_two_pass_analysis(
    provider: LLMProvider, context: AnalysisContext, prompt_version: str
) -> LLMAnalysisResult:
    persona_prompt = load_persona_prompt(prompt_version)
    blind_response = provider.generate_structured(
        system_prompt=persona_prompt,
        user_content=render_blind_user_content(context),
        response_schema=BlindAnalysisOutput,
        prompt_version=f"persona/{prompt_version}",
    )
    try:
        blind_output = BlindAnalysisOutput.model_validate_json(blind_response.content)
    except Exception as exc:  # noqa: BLE001 — schema-invalid output must fail loudly (§28 rule 10)
        raise LLMUnavailableError(f"blind-pass output failed schema validation: {exc}") from exc

    if context.user_notes and context.user_notes.strip():
        synthesis_prompt = load_synthesis_prompt(prompt_version)
        reconciliation_response = provider.generate_structured(
            system_prompt=synthesis_prompt,
            user_content=render_reconciliation_user_content(context, blind_output),
            response_schema=ReconciliationOutput,
            prompt_version=f"synthesis/{prompt_version}",
        )
        try:
            reconciliation_output = ReconciliationOutput.model_validate_json(reconciliation_response.content)
        except Exception as exc:  # noqa: BLE001
            raise LLMUnavailableError(f"reconciliation-pass output failed schema validation: {exc}") from exc
        total_input = (blind_response.input_tokens or 0) + (reconciliation_response.input_tokens or 0)
        total_output = (blind_response.output_tokens or 0) + (reconciliation_response.output_tokens or 0)
    else:
        # Nothing recorded for this holding/snapshot to reconcile against —
        # say so explicitly rather than fabricating a comparison (§21).
        reconciliation_output = ReconciliationOutput(
            thesis_divergence=ThesisDivergenceOutput(
                blind_assessment_summary=blind_output.executive_summary,
                user_thesis_summary="No notes on record for this holding in this snapshot.",
                material_disagreement=False,
                disagreement_notes="Reconciliation skipped — no user notes/thesis available to compare against.",
            ),
        )
        total_input = blind_response.input_tokens or 0
        total_output = blind_response.output_tokens or 0

    merged = HoldingAnalysisOutput(
        executive_summary=blind_output.executive_summary,
        thesis_status=blind_output.thesis_status,
        business_quality=blind_output.business_quality,
        financial_strength=blind_output.financial_strength,
        valuation=blind_output.valuation,
        key_strengths=blind_output.key_strengths,
        key_risks=[*blind_output.key_risks, *reconciliation_output.additional_risks],
        new_information=blind_output.new_information,
        thesis_divergence=reconciliation_output.thesis_divergence,
        invalidation_triggers=blind_output.invalidation_triggers,
        decision_considerations=[
            *blind_output.decision_considerations,
            *reconciliation_output.additional_considerations,
        ],
        source_references=sorted(set(blind_output.source_references) | set(reconciliation_output.source_references)),
        insufficient_evidence_areas=blind_output.insufficient_evidence_areas,
    )

    return LLMAnalysisResult(
        output=merged,
        blind_output=blind_output,
        reconciliation_output=reconciliation_output,
        prompt_version=prompt_version,
        model_name=blind_response.model,
        total_input_tokens=total_input,
        total_output_tokens=total_output,
    )
