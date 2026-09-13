"""
Loads versioned prompt templates from the repository (architecture §11.1:
"the persona is a versioned prompt template stored in the repository, not
hardcoded application logic") and serializes the dynamic evidence packet
that goes alongside each one as `user_content`.

The persona itself — how to think, what guardrails apply — lives in the
prompt files under prompts/persona/ and prompts/synthesis/, versioned
independently of application code (§2.4). The evidence-packet serialization
below is ordinary application code: it doesn't change what the model is
asked to be, only what facts it's given to reason over on a given run, so it
isn't itself prompt-versioned.
"""

import json
from functools import lru_cache
from typing import Any

from app.config.paths import PROMPTS_DIR
from app.schemas.analysis import BlindAnalysisOutput
from app.services.analysis.context import AnalysisContext, UnavailableSection
from app.services.research.macro import MacroSnapshotView
from app.services.research.sector import SectorResearchView


class UnknownPromptVersionError(Exception):
    def __init__(self, kind: str, version: str):
        self.kind = kind
        self.version = version
        super().__init__(f"no {kind} prompt found for version '{version}' under prompts/{kind}/")


@lru_cache
def load_persona_prompt(version: str) -> str:
    path = PROMPTS_DIR / "persona" / f"{version}.md"
    if not path.exists():
        raise UnknownPromptVersionError("persona", version)
    return path.read_text(encoding="utf-8")


@lru_cache
def load_synthesis_prompt(version: str) -> str:
    path = PROMPTS_DIR / "synthesis" / f"{version}.md"
    if not path.exists():
        raise UnknownPromptVersionError("synthesis", version)
    return path.read_text(encoding="utf-8")


def _json_default(value: Any) -> Any:
    # Decimal is the only non-JSON-native type that appears in an
    # AnalysisContext; stringify rather than float() to avoid silently
    # introducing binary-float imprecision into what the model sees.
    from decimal import Decimal

    if isinstance(value, Decimal):
        return str(value)
    raise TypeError(f"not JSON serializable: {value!r}")


def _macro_snapshot_payload(section: MacroSnapshotView | UnavailableSection) -> dict:
    if isinstance(section, UnavailableSection):
        return {"available": False, "reason": section.reason}
    return {
        "available": section.available,
        "as_of": section.as_of.isoformat() if section.as_of else None,
        # Full detail lives in the numbered evidence list (each observation/
        # narrative item is its own citable EvidenceItem, app.services.
        # analysis.context._add_research_evidence) — this block is a
        # compact summary so the model doesn't have to reconstruct it from
        # scattered evidence entries.
        "observation_count": len(section.observations),
        "narrative_item_count": len(section.narrative_items),
    }


def _sector_research_payload(section: SectorResearchView | UnavailableSection) -> dict:
    if isinstance(section, UnavailableSection):
        return {"available": False, "reason": section.reason}
    return {
        "available": section.available,
        "sector": section.sector,
        "as_of": section.as_of.isoformat() if section.as_of else None,
        "item_count": len(section.items),
    }


def render_blind_user_content(context: AnalysisContext) -> str:
    """Pass 1 payload — everything in AnalysisContext except `user_notes`
    (§11.3: the blind pass must not see the user's own conviction)."""
    payload = {
        "holding": {
            "ticker": context.ticker,
            "name": context.name,
            "asset_class": context.asset_class,
            "sector": context.sector,
            "trading_currency": context.trading_currency,
        },
        "position": {
            "weight_pct": context.weight_pct,
            "quantity": context.quantity,
            "cost_basis": context.cost_basis,
            "cost_basis_currency": context.cost_basis_currency,
        },
        "financial_metrics": {
            "latest_period": context.financial_metrics.latest_period,
            "previous_period": context.financial_metrics.previous_period,
            "revenue_growth_pct": context.financial_metrics.revenue_growth_pct,
            "ebitda_margin_pct": context.financial_metrics.ebitda_margin_pct,
            "net_income_margin_pct": context.financial_metrics.net_income_margin_pct,
            "return_on_equity_pct": context.financial_metrics.return_on_equity_pct,
            "facts_considered": context.financial_metrics.facts_considered,
            "insufficient_data": context.financial_metrics.insufficient_data,
        },
        "market": {
            "price": context.market.price,
            "price_currency": context.market.price_currency,
            "observed_at": context.market.observed_at.isoformat() if context.market.observed_at else None,
            "data_status": context.market.data_status,
            "fx_rate_to_reporting": context.market.fx_rate_to_reporting,
            "reporting_currency": context.market.reporting_currency,
        },
        "macro_snapshot": _macro_snapshot_payload(context.macro_snapshot),
        "sector_research": _sector_research_payload(context.sector_research),
        "recent_events": {
            "available": context.recent_events.available,
            "reason": context.recent_events.reason,
        },
        "previous_analysis": (
            {
                "completed_at": (
                    context.previous_analysis.completed_at.isoformat()
                    if context.previous_analysis.completed_at
                    else None
                ),
                "executive_summary": context.previous_analysis.executive_summary,
                "thesis_status": context.previous_analysis.thesis_status,
                "overall_score": context.previous_analysis.overall_score,
            }
            if context.previous_analysis
            else None
        ),
        "evidence": [
            {
                "evidence_id": item.evidence_id,
                "source_type": item.source_type,
                "label": item.label,
                "page_start": item.page_start,
                "page_end": item.page_end,
                "content": item.content,
            }
            for item in context.evidence_items
        ],
        "evidence_truncated": context.excerpts_truncated,
    }
    return json.dumps(payload, default=_json_default, indent=2)


def render_reconciliation_user_content(context: AnalysisContext, blind_output: BlindAnalysisOutput) -> str:
    """Pass 2 payload — the independent blind assessment plus the user's own
    notes (§11.3). Deliberately excludes the raw document excerpts again to
    keep this call small; Pass 2's job is comparing two summaries, not
    re-reading source material (see docs/decisions/0006)."""
    payload = {
        "holding": {"ticker": context.ticker, "name": context.name},
        "blind_assessment": json.loads(blind_output.model_dump_json()),
        "user_notes": context.user_notes,
    }
    return json.dumps(payload, default=_json_default, indent=2)
