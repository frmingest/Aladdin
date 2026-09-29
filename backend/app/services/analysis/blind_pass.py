"""The blind pass: one structured LLM call over the evidence packet only
(CLAUDE.md Rule 4 — no user notes reach this function, directly or
indirectly; app/services/analysis/pipeline.py never passes them in)."""
from __future__ import annotations

from dataclasses import dataclass

from pydantic import BaseModel, ValidationError

from app.config.paths import PROMPTS_DIR
from app.config.settings import get_settings
from app.domain.analysis_schema import (
    cited_evidence_ids_any_blind,
    get_blind_pass_schema,
    is_fund_schema,
)
from app.providers.base import LLMProvider, LLMResponse, LLMUnavailableError
from app.services.analysis.evidence_packet import EvidencePacket


def load_blind_prompt(version: str) -> str:
    path = PROMPTS_DIR / "analysis" / f"blind_{version}.md"
    if not path.exists():
        raise LLMUnavailableError(
            f"no blind-pass prompt found for version {version!r} under prompts/analysis/"
        )
    return path.read_text(encoding="utf-8")


@dataclass
class BlindPassResult:
    output: BaseModel  # BlindPassOutputV1, or FundBlindPassOutputV1 for a fund (Sprint 8)
    response: LLMResponse
    citation_warnings: list[str]


def run_blind_pass(
    llm_provider: LLMProvider, packet: EvidencePacket, *, schema_version: str, prompt_version: str
) -> BlindPassResult:
    system_prompt = load_blind_prompt(prompt_version)
    user_prompt = (
        "Evidence list for this holding:\n\n"
        f"{packet.render_for_prompt()}\n\n"
        "Produce your blind-pass assessment now, citing only evidence IDs that appear above."
    )
    schema = get_blind_pass_schema(schema_version)
    # A fund/ETF answers fund_v1, which has one more full narrative section
    # than equity's v1 (see app/domain/analysis_schema/fund_v1.py) — give it
    # more output room than the shared default, or a real fund holding can
    # get its JSON cut off mid-answer (2026-09-27: happened on qwen3:14b for
    # XDEF.DE at the 8192-token default). Every provider honors this the
    # same way via generate_structured's optional override.
    settings = get_settings()
    max_output_tokens = (
        settings.llm_max_output_tokens_fund if is_fund_schema(schema_version) else None
    )
    response = llm_provider.generate_structured(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        response_schema=schema,
        max_output_tokens=max_output_tokens,
    )
    try:
        output = schema.model_validate_json(response.content)
    except ValidationError as exc:
        raise LLMUnavailableError(f"blind pass response failed schema validation: {exc}") from exc

    cited = cited_evidence_ids_any_blind(output)
    unknown = sorted(cited - packet.known_ids())
    citation_warnings = [f"cited unknown evidence id: {eid}" for eid in unknown]
    return BlindPassResult(output=output, response=response, citation_warnings=citation_warnings)
