"""Optional "where they'd argue" synthesis (Epic F22, story 22.8).

A separate, labelled LLM pass over the latest Buffett/Munger run and the
latest Dalio run of one holding. Rules (plan §6, ECON-F22-06):

- off by default (app setting `analyst_synthesis_enabled`), and only ever
  run on an explicit request — never automatically;
- it never writes to either run: a new `analyst_syntheses` row only;
- citations are prefixed B:/D: by source run and checked like any other
  pass — an unknown ID is a warning, never silently accepted;
- both runs' outputs and evidence are framed as data (CLAUDE.md Rule 5).

The synthesis is not a blind pass, so Rule 4 doesn't apply to it; it
still never reads the owner's notes directly (only what each
reconciliation already wrote).
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.paths import PROMPTS_DIR
from app.config.settings import Settings
from app.domain.analysis_schema.synthesis_v1 import (
    SynthesisOutputV1,
    cited_evidence_ids_synthesis,
)
from app.models.analysis import EquityAnalysisRun
from app.models.analyst_synthesis import AnalystSynthesis
from app.providers.base import LLMProvider, LLMUnavailableError

_SCHEMAS = {"synthesis_v1": SynthesisOutputV1}


class SynthesisNotPossibleError(Exception):
    pass


def _render_evidence(run: EquityAnalysisRun, prefix: str) -> tuple[str, set[str]]:
    items = (run.evidence_packet_json or {}).get("items") or []
    blocks, ids = [], set()
    for item in items:
        pid = f"{prefix}:{item.get('id')}"
        ids.add(pid)
        blocks.append(f"[{pid}] ({item.get('category')}) {item.get('label')}\n{item.get('content')}")
    return "\n\n".join(blocks), ids


def _final_output(run: EquityAnalysisRun) -> str:
    return json.dumps(
        {"blind_pass": run.blind_pass_json, "reconciliation": run.reconciliation_json}, ensure_ascii=False
    )


def latest_synthesis(db: Session, holding_id) -> AnalystSynthesis | None:
    return db.scalar(
        select(AnalystSynthesis)
        .where(AnalystSynthesis.holding_id == holding_id)
        .order_by(AnalystSynthesis.created_at.desc())
        .limit(1)
    )


def run_synthesis(
    db: Session,
    *,
    holding_id,
    buffett: EquityAnalysisRun | None,
    dalio: EquityAnalysisRun | None,
    llm_provider: LLMProvider,
    settings: Settings,
) -> AnalystSynthesis:
    if buffett is None or dalio is None:
        raise SynthesisNotPossibleError("a synthesis needs both a Buffett/Munger and a Dalio analysis of this holding")
    version = settings.active_synthesis_schema_version
    prompt_version = settings.active_synthesis_prompt_version
    prompt_path = PROMPTS_DIR / "analysis" / f"synthesis_{prompt_version.removeprefix('synthesis_')}.md"
    if not prompt_path.exists():
        raise SynthesisNotPossibleError(f"no synthesis prompt for version {prompt_version!r}")
    schema = _SCHEMAS[version]
    b_evidence, b_ids = _render_evidence(buffett, "B")
    d_evidence, d_ids = _render_evidence(dalio, "D")
    user_prompt = (
        "Buffett/Munger analyst — final output (JSON):\n\n"
        f"{_final_output(buffett)}\n\n"
        "Buffett/Munger evidence list:\n\n"
        f"{b_evidence}\n\n"
        "Dalio analyst — final output (JSON):\n\n"
        f"{_final_output(dalio)}\n\n"
        "Dalio evidence list:\n\n"
        f"{d_evidence}\n\n"
        "Write the synthesis now, citing only the prefixed evidence IDs above."
    )
    row = AnalystSynthesis(
        holding_id=holding_id,
        buffett_run_id=buffett.id,
        dalio_run_id=dalio.id,
        schema_version=version,
        prompt_version=prompt_version,
        status="FAILED",
        created_at=datetime.now(timezone.utc),
    )
    try:
        response = llm_provider.generate_structured(
            system_prompt=prompt_path.read_text(encoding="utf-8"),
            user_prompt=user_prompt,
            response_schema=schema,
        )
        output = schema.model_validate_json(response.content)
    except (LLMUnavailableError, ValidationError) as exc:
        row.error_message = f"synthesis failed: {exc}"[:4000]
        db.add(row)
        db.commit()
        db.refresh(row)
        return row
    unknown = sorted(cited_evidence_ids_synthesis(output) - (b_ids | d_ids))
    row.status = "COMPLETED"
    row.provider = llm_provider.name
    row.model_name = response.usage.model
    row.output_json = output.model_dump(mode="json")
    row.citation_warnings = [f"cited unknown evidence id: {eid}" for eid in unknown]
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
