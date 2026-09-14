"""LLM usage-ledger endpoint (§28 observability follow-up, docs/decisions/
0013-llm-usage-ledger-and-rate-limit-estimation.md) — read-only: the ledger
itself is written by app.services.analysis.runner and
app.services.research.macro/sector as a side effect of each real Gemini
call, not through this router."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.schemas.usage import UsageSummaryOut, UsageWindowOut
from app.services.usage import UsageSummary, get_usage_summary

router = APIRouter(prefix="/usage", tags=["usage"])


def _to_out(summary: UsageSummary) -> UsageSummaryOut:
    return UsageSummaryOut(
        as_of=summary.as_of,
        today=UsageWindowOut(
            requests=summary.today.requests,
            input_tokens=summary.today.input_tokens,
            output_tokens=summary.today.output_tokens,
        ),
        last_minute=UsageWindowOut(
            requests=summary.last_minute.requests,
            input_tokens=summary.last_minute.input_tokens,
            output_tokens=summary.last_minute.output_tokens,
        ),
        rpm_limit=summary.rpm_limit,
        tpm_limit=summary.tpm_limit,
        rpd_limit=summary.rpd_limit,
        avg_calls_per_analysis=summary.avg_calls_per_analysis,
        avg_tokens_per_analysis=summary.avg_tokens_per_analysis,
        baseline_is_calibrated=summary.baseline_is_calibrated,
        estimated_analyses_remaining_today=summary.estimated_analyses_remaining_today,
    )


@router.get("/summary", response_model=UsageSummaryOut)
def get_summary(db: Session = Depends(get_db)) -> UsageSummaryOut:
    """Today's/this-minute's Gemini usage against the configured free-tier
    limits (settings.llm_rate_limit_*, kept in sync by hand — see ADR 0013),
    plus an estimate of how many more holding analyses can run today. Always
    free of provider cost — reads the ledger only (§2.7)."""
    return _to_out(get_usage_summary(db))
