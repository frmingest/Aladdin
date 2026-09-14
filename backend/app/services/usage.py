"""Usage-ledger read access & free-tier quota estimation (§28 observability
follow-up — see docs/decisions/0013-llm-usage-ledger-and-rate-limit-
estimation.md).

Two questions this module answers, both from llm_usage_events
(app.models.llm_usage) plus the three llm_rate_limit_* settings — kept in
sync by hand with whatever aistudio.google.com/usage shows for the
configured model/tier, since no public API exposes a free-tier AI Studio
key's quota/usage (that page is a Cloud Console UI backed by Cloud
Monitoring, which would need a GCP project + service-account credentials
wired up just to read numbers this ledger already has, per real Gemini
call, for free — see the ADR's Context):

- "How much of today's/this-minute's quota have we already used?" — a
  straight count/sum of today's and the trailing-minute's rows.
- "How many more holding analyses can we run today?" — the day's remaining
  request headroom (rpd_limit - today's requests) divided by how many
  Gemini calls one holding analysis actually costs (1 when a holding has no
  thesis/notes yet — only the blind pass fires, see
  app.services.analysis.llm_analysis — 2 once it does). Uses the real
  historical average from ANALYSIS_BLIND/ANALYSIS_RECONCILIATION events once
  there are any; before that (this ledger has no history predating this
  feature) it falls back to settings.llm_baseline_input_tokens/
  llm_baseline_output_tokens — Faiz's first real analysis run (Vår Energi:
  3 documents / 280 pages, single blind-pass call, ~5.87K in / ~1.48K out
  per Google AI Studio's own usage dashboard) — as a one-call, one-analysis
  calibration point.

TPM is reported alongside RPD (see UsageSummary) but is not folded into the
remaining-analyses estimate: a single holding analysis costs a few thousand
tokens against a 250K/minute budget, so at this app's usage pattern (one
analysis run at a time, not a burst) RPD is what actually runs out first —
see the ADR's Consequences for the full reasoning.

The "today" window uses UTC calendar-day boundaries as an approximation of
Google's own free-tier reset window (not itself published) — this can be up
to a day off right at the boundary; low-stakes for a single-user app, and
self-evident the moment it disagrees with what aistudio.google.com/usage
shows.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config.settings import Settings, get_settings
from app.models.llm_usage import LLMCallType, LLMUsageEvent


@dataclass
class UsageWindow:
    requests: int
    input_tokens: int
    output_tokens: int


@dataclass
class UsageSummary:
    as_of: datetime
    today: UsageWindow
    last_minute: UsageWindow
    rpm_limit: int
    tpm_limit: int
    rpd_limit: int
    avg_calls_per_analysis: float
    avg_tokens_per_analysis: int
    baseline_is_calibrated: bool  # False while still using the Vår Energi fallback, True once real history backs it
    estimated_analyses_remaining_today: int


def record_llm_usage(
    db: Session,
    *,
    provider: str,
    model_name: str,
    call_type: LLMCallType,
    input_tokens: int | None,
    output_tokens: int | None,
    latency_ms: float | None,
    prompt_version: str | None = None,
    holding_id: UUID | None = None,
    analysis_run_id: UUID | None = None,
    holding_analysis_id: UUID | None = None,
    sector: str | None = None,
) -> LLMUsageEvent:
    """Adds (does not commit) one usage-ledger row. Callers persist it as
    part of whatever transaction the triggering call already belongs to —
    mirrors every other append-only table in this codebase (§28: a usage
    event isn't a separate unit of work from the analysis/research run that
    produced it)."""
    event = LLMUsageEvent(
        provider=provider,
        model_name=model_name,
        call_type=call_type.value,
        prompt_version=prompt_version,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        latency_ms=latency_ms,
        holding_id=holding_id,
        analysis_run_id=analysis_run_id,
        holding_analysis_id=holding_analysis_id,
        sector=sector,
    )
    db.add(event)
    return event


def get_usage_summary(db: Session, settings: Settings | None = None) -> UsageSummary:
    settings = settings or get_settings()
    now = datetime.now(timezone.utc)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    minute_start = now - timedelta(minutes=1)

    today = _window(db, day_start, now)
    last_minute = _window(db, minute_start, now)
    avg_calls, avg_tokens, calibrated = _analysis_baseline(db, settings)

    requests_left_today = max(settings.llm_rate_limit_rpd - today.requests, 0)
    estimated_remaining = int(requests_left_today // avg_calls) if avg_calls > 0 else 0

    return UsageSummary(
        as_of=now,
        today=today,
        last_minute=last_minute,
        rpm_limit=settings.llm_rate_limit_rpm,
        tpm_limit=settings.llm_rate_limit_tpm,
        rpd_limit=settings.llm_rate_limit_rpd,
        avg_calls_per_analysis=avg_calls,
        avg_tokens_per_analysis=avg_tokens,
        baseline_is_calibrated=calibrated,
        estimated_analyses_remaining_today=estimated_remaining,
    )


def _window(db: Session, start: datetime, end: datetime) -> UsageWindow:
    count, input_tokens, output_tokens = (
        db.query(
            func.count(LLMUsageEvent.id),
            func.coalesce(func.sum(LLMUsageEvent.input_tokens), 0),
            func.coalesce(func.sum(LLMUsageEvent.output_tokens), 0),
        )
        .filter(LLMUsageEvent.occurred_at >= start, LLMUsageEvent.occurred_at <= end)
        .one()
    )
    return UsageWindow(requests=int(count), input_tokens=int(input_tokens), output_tokens=int(output_tokens))


def _analysis_baseline(db: Session, settings: Settings) -> tuple[float, int, bool]:
    """Real per-holding-analysis cost once there's ledger history to compute
    it from, else the Vår Energi calibration fallback — see module
    docstring."""
    analysis_run_ids = [
        row[0]
        for row in db.query(LLMUsageEvent.analysis_run_id)
        .filter(
            LLMUsageEvent.call_type.in_(
                [LLMCallType.ANALYSIS_BLIND.value, LLMCallType.ANALYSIS_RECONCILIATION.value]
            ),
            LLMUsageEvent.analysis_run_id.isnot(None),
        )
        .distinct()
        .all()
    ]
    if not analysis_run_ids:
        baseline_total = settings.llm_baseline_input_tokens + settings.llm_baseline_output_tokens
        return 1.0, baseline_total, False

    calls, total_tokens = (
        db.query(
            func.count(LLMUsageEvent.id),
            func.coalesce(func.sum(LLMUsageEvent.input_tokens), 0)
            + func.coalesce(func.sum(LLMUsageEvent.output_tokens), 0),
        )
        .filter(LLMUsageEvent.analysis_run_id.in_(analysis_run_ids))
        .one()
    )
    holding_analysis_count = (
        db.query(func.count(func.distinct(LLMUsageEvent.holding_analysis_id)))
        .filter(
            LLMUsageEvent.analysis_run_id.in_(analysis_run_ids),
            LLMUsageEvent.holding_analysis_id.isnot(None),
        )
        .scalar()
        or 1
    )
    avg_calls = calls / holding_analysis_count
    avg_tokens = int(total_tokens / holding_analysis_count)
    return avg_calls, avg_tokens, True
