"""
Valuation-case orchestration (architecture §17, §26 Phase 5): runs the
deterministic DCF (app.domain.valuation) and, best-effort, the LLM
assumption critique (§17's "the LLM critiques") over the same evidence
packet Phase 3's holding analysis already builds (app.services.analysis.
context) — reused as-is rather than duplicated.

The critique is a genuinely optional secondary step: any failure to build
context, load the prompt, or get valid structured output back is caught and
recorded on the case as `critique_error` rather than raised, so a valuation
case is never lost because the LLM step failed (§21 — fail visibly per-item,
mirroring the Phase 2 per-holding valuation and Phase 3 per-holding
analysis-run precedents).
"""

import json
from decimal import Decimal
from functools import lru_cache
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.config.paths import PROMPTS_DIR
from app.config.settings import Settings, get_settings
from app.domain.valuation import ValuationAssumptions, ValuationResult, compute_dcf_value
from app.models.financial_fact import FinancialLineItem
from app.models.holding import Holding
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.models.valuation import ValuationCase
from app.providers.base import LLMProvider, LLMUnavailableError
from app.schemas.valuation import ValuationCaseCreate, ValuationCritiqueOutput
from app.services.analysis.context import AnalysisContext, InsufficientContextError, build_analysis_context
from app.services.analysis.prompts import UnknownPromptVersionError


@lru_cache
def load_valuation_prompt(version: str) -> str:
    path = PROMPTS_DIR / "valuation" / f"{version}.md"
    if not path.exists():
        raise UnknownPromptVersionError("valuation", version)
    return path.read_text(encoding="utf-8")


def _json_default(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    raise TypeError(f"not JSON serializable: {value!r}")


def _assumptions_to_json(assumptions: ValuationAssumptions) -> dict:
    return {
        "revenue_growth_pct": str(assumptions.revenue_growth_pct),
        "margin_pct": str(assumptions.margin_pct),
        "capex_pct_of_revenue": str(assumptions.capex_pct_of_revenue),
        "tax_rate_pct": str(assumptions.tax_rate_pct),
        "discount_rate_pct": str(assumptions.discount_rate_pct),
        "terminal_growth_pct": str(assumptions.terminal_growth_pct),
        "shares_outstanding": str(assumptions.shares_outstanding),
        "projection_years": assumptions.projection_years,
        "commodity_price_multiplier": (
            str(assumptions.commodity_price_multiplier)
            if assumptions.commodity_price_multiplier is not None
            else None
        ),
        "fx_rate_to_reporting": (
            str(assumptions.fx_rate_to_reporting) if assumptions.fx_rate_to_reporting is not None else None
        ),
        "net_debt": str(assumptions.net_debt) if assumptions.net_debt is not None else None,
    }


def _latest_revenue_fact(db: Session, holding_id: UUID) -> tuple[Decimal | None, str | None]:
    """Same lexical-period-sort limitation as app.services.analysis.context
    (see decision 0006) — acceptable for the same reason: Phase 1's
    canonical metric/period label set is small and controlled."""
    facts = (
        db.query(FinancialLineItem)
        .filter(FinancialLineItem.holding_id == holding_id, FinancialLineItem.metric == "revenue")
        .all()
    )
    if not facts:
        return None, None
    latest = max(facts, key=lambda f: f.period)
    return latest.value, latest.currency


def _find_latest_snapshot_id_for_holding(db: Session, holding_id: UUID) -> UUID | None:
    """A valuation case can be created standalone (no analysis_run_id), so
    the evidence context for the critique step falls back to whichever
    portfolio snapshot most recently included this holding."""
    row = (
        db.query(PortfolioPosition.snapshot_id)
        .join(PortfolioSnapshot, PortfolioPosition.snapshot_id == PortfolioSnapshot.id)
        .filter(PortfolioPosition.holding_id == holding_id)
        .order_by(PortfolioSnapshot.uploaded_at.desc())
        .first()
    )
    return row[0] if row else None


def _render_valuation_user_content(
    context: AnalysisContext, assumptions: ValuationAssumptions, result: ValuationResult
) -> str:
    payload = {
        "holding": {"ticker": context.ticker, "name": context.name, "sector": context.sector},
        "assumptions": _assumptions_to_json(assumptions),
        "calculated_result": {
            "value_per_share": result.value_per_share,
            "enterprise_value": result.enterprise_value,
            "equity_value": result.equity_value,
            "terminal_value": result.terminal_value,
            "note": result.note,
        },
        "financial_metrics": {
            "latest_period": context.financial_metrics.latest_period,
            "revenue_growth_pct": context.financial_metrics.revenue_growth_pct,
            "ebitda_margin_pct": context.financial_metrics.ebitda_margin_pct,
            "return_on_equity_pct": context.financial_metrics.return_on_equity_pct,
        },
        "market": {
            "price": context.market.price,
            "price_currency": context.market.price_currency,
            "data_status": context.market.data_status,
        },
        "evidence": [
            {
                "evidence_id": item.evidence_id,
                "source_type": item.source_type,
                "label": item.label,
                "content": item.content,
            }
            for item in context.evidence_items
        ],
    }
    return json.dumps(payload, default=_json_default, indent=2)


def _run_critique(
    db: Session,
    llm_provider: LLMProvider,
    holding: Holding,
    assumptions: ValuationAssumptions,
    result: ValuationResult,
    settings: Settings,
) -> tuple[ValuationCritiqueOutput | None, str | None]:
    snapshot_id = _find_latest_snapshot_id_for_holding(db, holding.id)
    if snapshot_id is None:
        return None, "holding is not part of any portfolio snapshot — no evidence context to critique against"

    try:
        context = build_analysis_context(db, holding.id, snapshot_id)
    except InsufficientContextError as exc:
        return None, str(exc)

    prompt_version = settings.active_valuation_prompt_version
    try:
        system_prompt = load_valuation_prompt(prompt_version)
        user_content = _render_valuation_user_content(context, assumptions, result)
        response = llm_provider.generate_structured(
            system_prompt=system_prompt,
            user_content=user_content,
            response_schema=ValuationCritiqueOutput,
            prompt_version=f"valuation/{prompt_version}",
        )
        critique = ValuationCritiqueOutput.model_validate_json(response.content)
    except (LLMUnavailableError, UnknownPromptVersionError) as exc:
        return None, str(exc)
    except Exception as exc:  # noqa: BLE001 — best-effort critique, must never block the deterministic value
        return None, f"valuation critique failed schema validation: {exc}"

    return critique, None


def create_valuation_case(
    db: Session,
    llm_provider: LLMProvider,
    holding: Holding,
    request: ValuationCaseCreate,
    settings: Settings | None = None,
) -> ValuationCase:
    settings = settings or get_settings()

    base_revenue, revenue_currency = _latest_revenue_fact(db, holding.id)
    if request.base_revenue_override is not None:
        base_revenue = request.base_revenue_override

    assumptions = ValuationAssumptions(
        revenue_growth_pct=request.revenue_growth_pct,
        margin_pct=request.margin_pct,
        capex_pct_of_revenue=request.capex_pct_of_revenue,
        tax_rate_pct=request.tax_rate_pct,
        discount_rate_pct=request.discount_rate_pct,
        terminal_growth_pct=request.terminal_growth_pct,
        shares_outstanding=request.shares_outstanding,
        projection_years=request.projection_years,
        commodity_price_multiplier=request.commodity_price_multiplier,
        fx_rate_to_reporting=request.fx_rate_to_reporting,
        net_debt=request.net_debt,
    )
    result = compute_dcf_value(base_revenue, assumptions)
    currency = request.currency or revenue_currency or holding.trading_currency

    case = ValuationCase(
        holding_id=holding.id,
        analysis_run_id=request.analysis_run_id,
        case_type=request.case_type,
        assumptions_json=_assumptions_to_json(assumptions),
        calculated_value=result.value_per_share,
        currency=currency,
        confidence=result.confidence if result.value_per_share is not None else "low",
        calculation_note=result.note,
    )
    db.add(case)
    db.flush()

    if request.run_critique:
        critique, critique_error = _run_critique(db, llm_provider, holding, assumptions, result, settings)
        case.critique_json = critique.model_dump(mode="json") if critique else None
        case.critique_error = critique_error

    db.commit()
    db.refresh(case)
    return case
