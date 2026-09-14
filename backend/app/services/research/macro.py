"""
Central-bank/macro refresh and read access (architecture §9.1/§9.4, §2.7,
§26 Phase 4).

`refresh_macro_snapshot` is the write path: pulls every registered numeric
series (app.domain.macro_series) via MacroDataProvider plus a qualitative
macro-news pass via ResearchProvider, persists both, and records one
research_runs row — but only if the most recent completed run has aged past
`macro_refresh_interval_hours` (§9.1: "refresh approximately daily"), unless
`force=True`. This is the "is a refresh due" cache check itself (§2.7); there
is no separate cache store. It also records the narrative pass's Gemini
usage into llm_usage_events (§28 observability follow-up, docs/decisions/
0013) via research_provider.last_usage, set by GeminiResearchProvider right
after its call returns — a research call that never triggers (research
disabled/stubbed) simply leaves last_usage at None and nothing is recorded.

`get_latest_macro_snapshot` is the read path used by both the API
(app.api.research) and the analysis evidence packet
(app.services.analysis.context): the latest persisted MacroObservation per
series plus the items from the most recent completed MACRO research_runs
row, with no provider call at all — reading is always free of network cost,
by design (§2.7).

One series or the narrative pass failing does not fail the whole refresh
(§21, mirroring the Phase 2 valuation and Phase 3 analysis-run precedents):
each failure becomes a warning, the run is still persisted as COMPLETED
(nothing failed) or PARTIAL (something did, but at least one item/
observation was persisted), and only a refresh where *everything* failed is
recorded as FAILED.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.config.settings import Settings, get_settings
from app.domain.macro_series import load_macro_series_registry
from app.models.llm_usage import LLMCallType
from app.models.research import MacroObservation, ResearchItem, ResearchRun, ResearchRunStatus, ResearchRunType
from app.providers.base import MacroDataProvider, MacroDataUnavailableError, ResearchProvider, ResearchUnavailableError
from app.services.research.common import is_stale, latest_completed_run
from app.services.usage import record_llm_usage


@dataclass
class MacroObservationView:
    series_key: str
    value: Decimal
    unit: str
    region: str
    provider: str
    observed_at: datetime


@dataclass
class MacroNewsItemView:
    title: str
    summary: str
    source_name: str
    source_url: str
    published_at: datetime | None
    retrieved_at: datetime


@dataclass
class MacroSnapshotView:
    available: bool
    as_of: datetime | None
    observations: list[MacroObservationView] = field(default_factory=list)
    narrative_items: list[MacroNewsItemView] = field(default_factory=list)
    reason: str | None = None  # set only when available=False


def refresh_macro_snapshot(
    db: Session,
    macro_provider: MacroDataProvider,
    research_provider: ResearchProvider,
    *,
    force: bool = False,
    settings: Settings | None = None,
) -> ResearchRun:
    settings = settings or get_settings()
    max_age = timedelta(hours=settings.macro_refresh_interval_hours)

    if not force:
        existing = latest_completed_run(db, ResearchRunType.MACRO)
        if not is_stale(existing, max_age):
            assert existing is not None  # is_stale(None, ...) is always True, so this branch implies a real run
            return existing

    registry = load_macro_series_registry(settings.active_macro_series_version)
    run = ResearchRun(
        type=ResearchRunType.MACRO.value,
        sector=None,
        status=ResearchRunStatus.RUNNING.value,
        methodology_version=registry.version,
    )
    db.add(run)
    db.flush()

    warnings: list[str] = []
    attempted = len(registry.series) + 1  # +1 for the narrative pass
    succeeded = 0

    for series_key in registry.series:
        try:
            point = macro_provider.get_latest(series_key)
        except MacroDataUnavailableError as exc:
            warnings.append(str(exc))
            continue
        db.add(
            MacroObservation(
                series_key=point.series_key,
                provider=point.provider,
                region=point.region,
                value=point.value,
                unit=point.unit,
                observed_at=point.observed_at,
            )
        )
        succeeded += 1

    try:
        narrative_items = research_provider.get_macro_snapshot()
        succeeded += 1
    except ResearchUnavailableError as exc:
        warnings.append(str(exc))
        narrative_items = []

    usage = research_provider.last_usage
    if usage is not None:
        record_llm_usage(
            db,
            provider=settings.research_provider,
            model_name=settings.llm_model_name,
            call_type=LLMCallType.RESEARCH_MACRO,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            latency_ms=usage.latency_ms,
            prompt_version=settings.active_research_prompt_version,
        )

    for item in narrative_items[: settings.research_max_grounded_items]:
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
    if succeeded == attempted:
        run.status = ResearchRunStatus.COMPLETED.value
    elif succeeded > 0:
        run.status = ResearchRunStatus.PARTIAL.value
        run.error_message = "; ".join(warnings)
    else:
        run.status = ResearchRunStatus.FAILED.value
        run.error_message = "; ".join(warnings) or "no series or narrative research could be retrieved"

    db.commit()
    db.refresh(run)
    return run


def get_latest_macro_snapshot(db: Session) -> MacroSnapshotView:
    registry_series_keys = _known_series_keys()
    observations: list[MacroObservationView] = []
    for series_key in registry_series_keys:
        latest = (
            db.query(MacroObservation)
            .filter(MacroObservation.series_key == series_key)
            .order_by(MacroObservation.observed_at.desc())
            .first()
        )
        if latest is not None:
            observations.append(
                MacroObservationView(
                    series_key=latest.series_key,
                    value=latest.value,
                    unit=latest.unit,
                    region=latest.region,
                    provider=latest.provider,
                    observed_at=latest.observed_at,
                )
            )

    run = latest_completed_run(db, ResearchRunType.MACRO)
    narrative_items = (
        [
            MacroNewsItemView(
                title=item.title,
                summary=item.summary,
                source_name=item.source_name,
                source_url=item.source_url,
                published_at=item.published_at,
                retrieved_at=item.retrieved_at,
            )
            for item in run.items
        ]
        if run is not None
        else []
    )

    if not observations and not narrative_items:
        return MacroSnapshotView(
            available=False,
            as_of=None,
            reason="no macro research run on record yet — POST /research/macro/refresh",
        )

    as_of = run.completed_at if run is not None else max((o.observed_at for o in observations), default=None)
    return MacroSnapshotView(available=True, as_of=as_of, observations=observations, narrative_items=narrative_items)


def _known_series_keys() -> list[str]:
    settings = get_settings()
    registry = load_macro_series_registry(settings.active_macro_series_version)
    return list(registry.series.keys())
