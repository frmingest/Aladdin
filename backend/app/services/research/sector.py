"""
Sector research refresh and read access (architecture §9.3/§9.4, §2.7,
§26 Phase 4) — the per-sector counterpart to app.services.research.macro.
Routed by `sector` (a plain string matching Holding.sector, §20) rather than
by holding, since §9.3 caches sector research "for a rolling period" shared
by every holding in that sector, not per-instrument.

Same caching/partial-failure shape as the macro service: a refresh is
skipped unless the most recent completed run for this sector has aged past
`sector_research_refresh_interval_days` (§9.3) or `force=True`; a provider
failure is recorded as a FAILED run rather than silently returning stale or
fabricated data (§21). Also records the grounded search call's Gemini usage
into llm_usage_events (§28 observability follow-up, docs/decisions/0013) via
research_provider.last_usage — see app.services.research.macro's docstring
for the same mechanism.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.config.settings import Settings, get_settings
from app.models.llm_usage import LLMCallType
from app.models.research import ResearchItem, ResearchRun, ResearchRunStatus, ResearchRunType
from app.providers.base import ResearchProvider, ResearchUnavailableError
from app.services.research.common import is_stale, latest_completed_run
from app.services.usage import record_llm_usage


@dataclass
class SectorResearchItemView:
    title: str
    summary: str
    source_name: str
    source_url: str
    published_at: datetime | None
    retrieved_at: datetime


@dataclass
class SectorResearchView:
    available: bool
    sector: str
    as_of: datetime | None
    items: list[SectorResearchItemView] = field(default_factory=list)
    reason: str | None = None  # set only when available=False


def refresh_sector_research(
    db: Session,
    research_provider: ResearchProvider,
    sector: str,
    *,
    force: bool = False,
    settings: Settings | None = None,
) -> ResearchRun:
    settings = settings or get_settings()
    max_age = timedelta(days=settings.sector_research_refresh_interval_days)

    if not force:
        existing = latest_completed_run(db, ResearchRunType.SECTOR, sector=sector)
        if not is_stale(existing, max_age):
            assert existing is not None  # is_stale(None, ...) is always True, so this branch implies a real run
            return existing

    run = ResearchRun(
        type=ResearchRunType.SECTOR.value,
        sector=sector,
        status=ResearchRunStatus.RUNNING.value,
        methodology_version=settings.active_research_prompt_version,
    )
    db.add(run)
    db.flush()

    try:
        items = research_provider.get_sector_research(sector)
    except ResearchUnavailableError as exc:
        _record_sector_usage(db, settings, research_provider, sector)
        run.completed_at = datetime.now(timezone.utc)
        run.status = ResearchRunStatus.FAILED.value
        run.error_message = str(exc)
        db.commit()
        db.refresh(run)
        return run

    _record_sector_usage(db, settings, research_provider, sector)

    for item in items[: settings.research_max_grounded_items]:
        db.add(
            ResearchItem(
                research_run_id=run.id,
                holding_id=None,
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


def _record_sector_usage(db: Session, settings: Settings, research_provider: ResearchProvider, sector: str) -> None:
    """Records the grounded search call's usage regardless of whether it
    ultimately succeeded or raised ResearchUnavailableError — the vendor
    call itself still cost tokens either way (§28 observability follow-up,
    ADR 0013; mirrors app.services.research.macro's same choice)."""
    usage = research_provider.last_usage
    if usage is None:
        return
    record_llm_usage(
        db,
        provider=settings.research_provider,
        model_name=settings.llm_model_name,
        call_type=LLMCallType.RESEARCH_SECTOR,
        input_tokens=usage.input_tokens,
        output_tokens=usage.output_tokens,
        latency_ms=usage.latency_ms,
        prompt_version=settings.active_research_prompt_version,
        sector=sector,
    )


def get_latest_sector_research(db: Session, sector: str) -> SectorResearchView:
    run = latest_completed_run(db, ResearchRunType.SECTOR, sector=sector)
    if run is None:
        return SectorResearchView(
            available=False,
            sector=sector,
            as_of=None,
            reason=f"no sector research run on record yet for '{sector}' — "
            f"POST /research/sectors/{sector}/refresh",
        )

    items = [
        SectorResearchItemView(
            title=item.title,
            summary=item.summary,
            source_name=item.source_name,
            source_url=item.source_url,
            published_at=item.published_at,
            retrieved_at=item.retrieved_at,
        )
        for item in run.items
    ]
    return SectorResearchView(available=True, sector=sector, as_of=run.completed_at, items=items)
