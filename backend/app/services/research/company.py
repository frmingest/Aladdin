"""
Company-specific research refresh and read access (Phase 11/Buffett-Munger
redesign Sprint 2 — claude/buffett-munger-redesign-sprint-plan-2026-09-20.md
— the per-holding counterpart to app.services.research.sector.

The Brain's opening step asks for company-specific industry/geography/
competitive-environment research (the Iran/energy example) — something
neither portfolio-wide MACRO research nor generic-by-sector SECTOR research
covers, since both are shared across every holding in scope. Routed by
`holding_id` (ResearchRun.holding_id, added this sprint) rather than
`sector`, the same way sector.py is routed by `sector` rather than by
holding.

Same caching/partial-failure shape as macro.py/sector.py: a refresh is
skipped unless the most recent completed run for this holding has aged past
`company_research_refresh_interval_days` or `force=True`; a provider
failure is recorded as a FAILED run rather than silently returning stale or
fabricated data (§21). Also records the grounded search call's Gemini usage
into llm_usage_events via research_provider.last_usage — see
app.services.research.macro's docstring for the same mechanism.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.config.settings import Settings, get_settings
from app.models.holding import Holding
from app.models.llm_usage import LLMCallType
from app.models.research import ResearchItem, ResearchRun, ResearchRunStatus, ResearchRunType
from app.providers.base import ResearchProvider, ResearchUnavailableError
from app.services.research.common import is_stale, latest_completed_run
from app.services.usage import record_llm_usage


@dataclass
class CompanyResearchItemView:
    title: str
    summary: str
    source_name: str
    source_url: str
    published_at: datetime | None
    retrieved_at: datetime


@dataclass
class CompanyResearchView:
    available: bool
    holding_id: "UUID | None"
    ticker: str
    as_of: datetime | None
    items: list[CompanyResearchItemView] = field(default_factory=list)
    reason: str | None = None  # set only when available=False


def refresh_company_research(
    db: Session,
    research_provider: ResearchProvider,
    holding: Holding,
    *,
    force: bool = False,
    settings: Settings | None = None,
) -> ResearchRun:
    settings = settings or get_settings()
    max_age = timedelta(days=settings.company_research_refresh_interval_days)

    if not force:
        existing = latest_completed_run(db, ResearchRunType.COMPANY, holding_id=holding.id)
        if not is_stale(existing, max_age):
            assert existing is not None  # is_stale(None, ...) is always True, so this branch implies a real run
            return existing

    run = ResearchRun(
        type=ResearchRunType.COMPANY.value,
        holding_id=holding.id,
        status=ResearchRunStatus.RUNNING.value,
        methodology_version=settings.active_research_prompt_version,
    )
    db.add(run)
    db.flush()

    try:
        items = research_provider.get_company_research(holding.name, holding.ticker, holding.sector)
    except ResearchUnavailableError as exc:
        _record_company_usage(db, settings, research_provider, holding)
        run.completed_at = datetime.now(timezone.utc)
        run.status = ResearchRunStatus.FAILED.value
        run.error_message = str(exc)
        db.commit()
        db.refresh(run)
        return run

    _record_company_usage(db, settings, research_provider, holding)

    for item in items[: settings.research_max_grounded_items]:
        db.add(
            ResearchItem(
                research_run_id=run.id,
                holding_id=holding.id,
                source_url=item.source_url,
                source_name=item.source_name,
                published_at=item.published_at,
                retrieved_at=item.retrieved_at,
                title=item.title,
                summary=item.summary,
                source_type=item.source_type,
                relevance="grounded",
            )
        )

    run.completed_at = datetime.now(timezone.utc)
    run.status = ResearchRunStatus.COMPLETED.value
    db.commit()
    db.refresh(run)
    return run


def _record_company_usage(db: Session, settings: Settings, research_provider: ResearchProvider, holding: Holding) -> None:
    """Records the grounded search call's usage regardless of whether it
    ultimately succeeded or raised ResearchUnavailableError — the vendor
    call itself still cost tokens either way (§28 observability follow-up,
    ADR 0013; mirrors app.services.research.sector's same choice)."""
    usage = research_provider.last_usage
    if usage is None:
        return
    record_llm_usage(
        db,
        provider=settings.research_provider,
        model_name=settings.llm_model_name,
        call_type=LLMCallType.RESEARCH_COMPANY,
        input_tokens=usage.input_tokens,
        output_tokens=usage.output_tokens,
        latency_ms=usage.latency_ms,
        prompt_version=settings.active_research_prompt_version,
        holding_id=holding.id,
    )


def get_latest_company_research(db: Session, holding_id: UUID, ticker: str) -> CompanyResearchView:
    run = latest_completed_run(db, ResearchRunType.COMPANY, holding_id=holding_id)
    if run is None:
        return CompanyResearchView(
            available=False,
            holding_id=holding_id,
            ticker=ticker,
            as_of=None,
            reason=f"no company research run on record yet for '{ticker}' — "
            f"POST /research/holdings/{holding_id}/company/refresh",
        )

    items = [
        CompanyResearchItemView(
            title=item.title,
            summary=item.summary,
            source_name=item.source_name,
            source_url=item.source_url,
            published_at=item.published_at,
            retrieved_at=item.retrieved_at,
        )
        for item in run.items
    ]
    return CompanyResearchView(available=True, holding_id=holding_id, ticker=ticker, as_of=run.completed_at, items=items)
