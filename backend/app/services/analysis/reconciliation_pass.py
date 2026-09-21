"""The reconciliation pass: the blind pass output + the same evidence
packet + the holding's own notes, if any (CLAUDE.md Rule 4 only withholds
notes from the *blind* pass — this one is exactly where they belong)."""
from __future__ import annotations

from dataclasses import dataclass

from pydantic import ValidationError

from app.config.paths import PROMPTS_DIR
from app.domain.analysis_schema import (
    BlindPassOutputV1,
    ReconciliationOutputV1,
    cited_evidence_ids_reconciliation,
    get_reconciliation_schema,
)
from app.providers.base import LLMProvider, LLMResponse, LLMUnavailableError
from app.services.analysis.evidence_packet import EvidencePacket

_NO_NOTES_PLACEHOLDER = "(the owner has not written any notes on this holding)"


def load_reconciliation_prompt(version: str) -> str:
    path = PROMPTS_DIR / "analysis" / f"reconciliation_{version}.md"
    if not path.exists():
        raise LLMUnavailableError(
            f"no reconciliation prompt found for version {version!r} under prompts/analysis/"
        )
    return path.read_text(encoding="utf-8")


@dataclass
class ReconciliationPassResult:
    output: ReconciliationOutputV1
    response: LLMResponse
    citation_warnings: list[str]


def run_reconciliation_pass(
    llm_provider: LLMProvider,
    packet: EvidencePacket,
    blind_output: BlindPassOutputV1,
    *,
    user_notes: str | None,
    schema_version: str,
    prompt_version: str,
) -> ReconciliationPassResult:
    system_prompt = load_reconciliation_prompt(prompt_version)
    notes_block = user_notes.strip() if user_notes and user_notes.strip() else _NO_NOTES_PLACEHOLDER
    user_prompt = (
        "Evidence list (same as the blind pass):\n\n"
        f"{packet.render_for_prompt()}\n\n"
        "Your prior blind-pass assessment (JSON):\n\n"
        f"{blind_output.model_dump_json()}\n\n"
        "The portfolio owner's notes on this holding:\n\n"
        f"{notes_block}\n\n"
        "Produce your reconciled assessment now, citing only evidence IDs from the list above."
    )
    schema = get_reconciliation_schema(schema_version)
    response = llm_provider.generate_structured(
        system_prompt=system_prompt, user_prompt=user_prompt, response_schema=schema
    )
    try:
        output = schema.model_validate_json(response.content)
    except ValidationError as exc:
        raise LLMUnavailableError(
            f"reconciliation response failed schema validation: {exc}"
        ) from exc

    cited = cited_evidence_ids_reconciliation(output)
    unknown = sorted(cited - packet.known_ids())
    citation_warnings = [f"cited unknown evidence id: {eid}" for eid in unknown]
    return ReconciliationPassResult(output=output, response=response, citation_warnings=citation_warnings)
