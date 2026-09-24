"""Fetches the macro catalogue (app/domain/macro_series.py) and stores new
or revised observations in macro_observations.

Called from three places: the "Refresh" button (POST
/macro/indicators/refresh), the API server's background loop
(app/services/macro/scheduler.py), and — best effort, only for stale
series — just before an analysis builds its evidence packet.

One failing publisher never stops the others: each series records its own
success or error in macro_series_status.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.domain.macro_series import MacroSeriesSpec, get_macro_series
from app.models.macro import MacroObservation, MacroSeriesStatus
from app.providers.macro_data_providers import (
    CompositeMacroDataProvider,
    MacroDataProvider,
    MacroDataUnavailableError,
)

# On an incremental fetch, re-read this far back so revisions (CPI, FRED
# data corrections) are picked up.
_REVISION_WINDOW_DAYS = 70
_RETRY_FAILED_AFTER = timedelta(hours=1)


@dataclass(frozen=True)
class SeriesRefreshResult:
    key: str
    label: str
    status: str  # "updated" | "unchanged" | "failed" | "fresh"
    inserted: int = 0
    latest_observed: date | None = None
    error: str | None = None


def _utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _provider_name(provider: MacroDataProvider, spec: MacroSeriesSpec) -> str:
    if isinstance(provider, CompositeMacroDataProvider):
        return provider.provider_name_for(spec)
    return provider.name


def stored_points(db: Session, series_key: str, since: date | None = None) -> list[tuple[date, Decimal]]:
    """(date, value) oldest first; for a date stored more than once
    (a revision) the most recently retrieved value wins."""
    query = select(MacroObservation).where(MacroObservation.series_key == series_key)
    if since is not None:
        query = query.where(
            MacroObservation.observed_at >= datetime.combine(since, time.min, tzinfo=timezone.utc)
        )
    latest: dict[date, tuple[datetime, Decimal]] = {}
    for row in db.scalars(query):
        observed = _utc(row.observed_at).date()
        retrieved = _utc(row.retrieved_at)
        current = latest.get(observed)
        if current is None or retrieved >= current[0]:
            latest[observed] = (retrieved, Decimal(row.value))
    return sorted(((d, v) for d, (_r, v) in latest.items()), key=lambda item: item[0])


def refresh_series(
    db: Session, provider: MacroDataProvider, spec: MacroSeriesSpec, *, now: datetime | None = None
) -> SeriesRefreshResult:
    settings = get_settings()
    now = now or datetime.now(timezone.utc)
    existing = stored_points(db, spec.key)
    if existing:
        start = existing[-1][0] - timedelta(days=_REVISION_WINDOW_DAYS)
    else:
        start = date(now.year - settings.macro_history_years, now.month, 1)
    # y/y needs 12 months before the first shown month.
    if spec.transform == "yoy_pct" and not existing:
        start = date(start.year - 1, start.month, 1)

    provider_name = _provider_name(provider, spec)
    status = db.get(MacroSeriesStatus, spec.key)
    if status is None:
        status = MacroSeriesStatus(series_key=spec.key, provider=provider_name, last_attempt_at=now, last_inserted=0)
        db.add(status)
    status.provider = provider_name
    status.last_attempt_at = now

    try:
        points = provider.fetch(spec, start)
    except MacroDataUnavailableError as exc:
        status.last_error = str(exc)[:1000]
        db.commit()
        return SeriesRefreshResult(
            spec.key, spec.label, "failed", 0, existing[-1][0] if existing else None, str(exc)
        )
    if not points:
        status.last_error = "the publisher returned no observations"
        db.commit()
        return SeriesRefreshResult(
            spec.key, spec.label, "failed", 0, existing[-1][0] if existing else None, status.last_error
        )

    known = dict(existing)
    inserted = 0
    for point in points:
        previous = known.get(point.observed_on)
        if previous is not None and previous == point.value:
            continue
        db.add(
            MacroObservation(
                series_key=spec.key,
                provider=provider_name,
                region=spec.region,
                value=point.value,
                unit=spec.unit,
                observed_at=datetime.combine(point.observed_on, time.min, tzinfo=timezone.utc),
                retrieved_at=now,
                source_series_id=spec.source_series_id,
            )
        )
        known[point.observed_on] = point.value
        inserted += 1

    status.last_success_at = now
    status.last_error = None
    status.last_inserted = inserted
    db.commit()
    latest = max(known) if known else None
    return SeriesRefreshResult(spec.key, spec.label, "updated" if inserted else "unchanged", inserted, latest)


def refresh_macro_data(
    db: Session,
    provider: MacroDataProvider,
    *,
    only_stale: bool = False,
    now: datetime | None = None,
) -> list[SeriesRefreshResult]:
    """Refreshes every catalogue series (or, with only_stale, those whose
    last successful fetch is older than MACRO_STALE_AFTER_HOURS)."""
    settings = get_settings()
    now = now or datetime.now(timezone.utc)
    threshold = now - timedelta(hours=settings.macro_stale_after_hours)
    results: list[SeriesRefreshResult] = []
    for spec in get_macro_series(settings.active_macro_series_version):
        if only_stale:
            status = db.get(MacroSeriesStatus, spec.key)
            last_success = _utc(status.last_success_at) if status else None
            if last_success is not None and last_success >= threshold:
                results.append(SeriesRefreshResult(spec.key, spec.label, "fresh"))
                continue
            # A publisher that just failed isn't retried by every analysis
            # in a queue (each attempt can cost a network timeout).
            last_attempt = _utc(status.last_attempt_at) if status else None
            if last_attempt is not None and last_attempt >= now - _RETRY_FAILED_AFTER:
                results.append(
                    SeriesRefreshResult(spec.key, spec.label, "failed", error=status.last_error if status else None)
                )
                continue
        results.append(refresh_series(db, provider, spec, now=now))
    return results
