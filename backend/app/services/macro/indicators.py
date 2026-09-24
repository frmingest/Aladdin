"""Turns stored macro observations into indicator snapshots: latest value,
3- and 12-month changes, staleness, a monthly history for charts, and the
derived spreads (real policy rates, NO-US 10-year spread).

CLAUDE.md Rule 1: every figure here is plain Decimal arithmetic. The
evidence packet and the UI only ever show numbers computed in this module.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.domain.macro_series import (
    DerivedIndicatorSpec,
    MacroSeriesSpec,
    get_derived_indicators,
    get_macro_series,
)
from app.models.macro import MacroSeriesStatus
from app.services.macro.refresh import stored_points

_HUNDRED = Decimal(100)
_HISTORY_MONTHS = 24


@dataclass(frozen=True)
class HistoryPoint:
    observed_on: date
    value: Decimal


@dataclass
class IndicatorSnapshot:
    key: str
    label: str
    region: str
    group: str
    display_unit: str
    frequency: str
    change_kind: str  # "pp" | "pct"
    description: str
    source_name: str
    source_series_id: str
    source_url: str
    derived: bool = False
    value: Decimal | None = None
    observed_on: date | None = None
    value_3m_ago: Decimal | None = None
    change_3m: Decimal | None = None
    value_12m_ago: Decimal | None = None
    change_12m: Decimal | None = None
    stale: bool = False
    age_days: int | None = None
    formula: str | None = None  # derived indicators: how it was computed, with inputs
    last_success_at: datetime | None = None
    last_error: str | None = None
    history: list[HistoryPoint] = field(default_factory=list)

    @property
    def available(self) -> bool:
        return self.value is not None


def _months_back(day: date, months: int) -> date:
    month_index = day.year * 12 + (day.month - 1) - months
    year, month = divmod(month_index, 12)
    month += 1
    # Clamp the day for short months (e.g. 31 March - 1 month -> 28/29 Feb).
    for candidate in (day.day, 30, 29, 28):
        try:
            return date(year, month, candidate)
        except ValueError:
            continue
    return date(year, month, 1)


def _value_on_or_before(points: list[tuple[date, Decimal]], target: date) -> tuple[date, Decimal] | None:
    chosen = None
    for observed, value in points:
        if observed > target:
            break
        chosen = (observed, value)
    return chosen


def yoy_series(points: list[tuple[date, Decimal]]) -> list[tuple[date, Decimal]]:
    """Monthly index -> 12-month % change, for months whose same month a
    year earlier is present. (index / index_12m_ago - 1) * 100."""
    by_month = {(d.year, d.month): v for d, v in points}
    result: list[tuple[date, Decimal]] = []
    for observed, value in points:
        base = by_month.get((observed.year - 1, observed.month))
        if base is None or base == 0:
            continue
        result.append((observed, (value / base - 1) * _HUNDRED))
    return result


def _change(kind: str, current: Decimal, earlier: Decimal) -> Decimal | None:
    if kind == "pp":
        return current - earlier
    if earlier == 0:
        return None
    return (current / earlier - 1) * _HUNDRED


def _q(value: Decimal | None, places: str) -> Decimal | None:
    if value is None:
        return None
    return value.quantize(Decimal(places), rounding=ROUND_HALF_UP)


def _places(spec_unit: str, transform: str) -> str:
    if spec_unit == "NOK":
        return "0.0001"
    if transform == "yoy_pct":
        return "0.1"
    return "0.01"


def _monthly_history(points: list[tuple[date, Decimal]], latest: date, places: str) -> list[HistoryPoint]:
    """Last observation of each month over the last 24 months (a daily
    series would otherwise send ~500 points per chart)."""
    cutoff = _months_back(latest, _HISTORY_MONTHS)
    by_month: dict[tuple[int, int], tuple[date, Decimal]] = {}
    for observed, value in points:
        if observed < cutoff:
            continue
        by_month[(observed.year, observed.month)] = (observed, value)
    return [HistoryPoint(d, _q(v, places)) for d, v in sorted(by_month.values(), key=lambda item: item[0])]


def _series_values(db: Session, spec: MacroSeriesSpec, since: date) -> list[tuple[date, Decimal]]:
    points = stored_points(db, spec.key, since=since)
    if spec.transform == "yoy_pct":
        return yoy_series(points)
    return points


def build_snapshot(
    spec: MacroSeriesSpec,
    values: list[tuple[date, Decimal]],
    *,
    today: date,
    status: MacroSeriesStatus | None = None,
) -> IndicatorSnapshot:
    places = _places(spec.unit, spec.transform)
    snap = IndicatorSnapshot(
        key=spec.key,
        label=spec.label,
        region=spec.region,
        group=spec.group,
        display_unit=spec.display_unit,
        frequency=spec.frequency,
        change_kind=spec.change_kind,
        description=spec.description,
        source_name=spec.source_name,
        source_series_id=spec.source_series_id,
        source_url=spec.source_url,
    )
    if status is not None:
        snap.last_success_at = status.last_success_at
        snap.last_error = status.last_error
    if not values:
        return snap
    latest_date, latest_value = values[-1]
    snap.value = _q(latest_value, places)
    snap.observed_on = latest_date
    snap.age_days = (today - latest_date).days
    snap.stale = snap.age_days > spec.stale_after_days
    for months, value_attr, change_attr in ((3, "value_3m_ago", "change_3m"), (12, "value_12m_ago", "change_12m")):
        earlier = _value_on_or_before(values, _months_back(latest_date, months))
        if earlier is None:
            continue
        setattr(snap, value_attr, _q(earlier[1], places))
        change = _change(spec.change_kind, latest_value, earlier[1])
        setattr(snap, change_attr, _q(change, "0.01"))
    snap.history = _monthly_history(values, latest_date, places)
    return snap


def build_derived(
    spec: DerivedIndicatorSpec, left: IndicatorSnapshot | None, right: IndicatorSnapshot | None, *, today: date
) -> IndicatorSnapshot:
    snap = IndicatorSnapshot(
        key=spec.key,
        label=spec.label,
        region=spec.region,
        group="derived",
        display_unit="pp",
        frequency="computed",
        change_kind="pp",
        description=spec.description,
        source_name="Computed by Aladdin",
        source_series_id=f"{spec.left} - {spec.right}",
        source_url="",
        derived=True,
    )
    if left is None or right is None or left.value is None or right.value is None:
        return snap
    snap.value = left.value - right.value
    snap.observed_on = min(left.observed_on, right.observed_on)  # type: ignore[type-var]
    snap.age_days = (today - snap.observed_on).days
    snap.stale = left.stale or right.stale
    snap.formula = (
        f"{left.label} {left.value}{_unit_suffix(left)} ({left.observed_on}) minus "
        f"{right.label} {right.value}{_unit_suffix(right)} ({right.observed_on})"
    )
    if left.value_12m_ago is not None and right.value_12m_ago is not None:
        snap.value_12m_ago = left.value_12m_ago - right.value_12m_ago
        snap.change_12m = snap.value - snap.value_12m_ago
    if left.value_3m_ago is not None and right.value_3m_ago is not None:
        snap.value_3m_ago = left.value_3m_ago - right.value_3m_ago
        snap.change_3m = snap.value - snap.value_3m_ago
    return snap


def _unit_suffix(snap: IndicatorSnapshot) -> str:
    return "%" if snap.display_unit == "%" else f" {snap.display_unit}"


@dataclass
class MacroIndicators:
    series_version: str
    indicators: list[IndicatorSnapshot]
    derived: list[IndicatorSnapshot]

    @property
    def any_available(self) -> bool:
        return any(i.available for i in self.indicators)

    @property
    def last_success_at(self) -> datetime | None:
        stamps = [i.last_success_at for i in self.indicators if i.last_success_at is not None]
        return max(stamps) if stamps else None


def get_macro_indicators(db: Session, *, today: date | None = None) -> MacroIndicators:
    settings = get_settings()
    today = today or datetime.now(timezone.utc).date()
    version = settings.active_macro_series_version
    # History window: 24 months shown + 12 for y/y + a little slack.
    since = today - timedelta(days=(_HISTORY_MONTHS + 14) * 31)
    snapshots: dict[str, IndicatorSnapshot] = {}
    ordered: list[IndicatorSnapshot] = []
    for spec in get_macro_series(version):
        snap = build_snapshot(
            spec, _series_values(db, spec, since), today=today, status=db.get(MacroSeriesStatus, spec.key)
        )
        snapshots[spec.key] = snap
        ordered.append(snap)
    derived = [
        build_derived(spec, snapshots.get(spec.left), snapshots.get(spec.right), today=today)
        for spec in get_derived_indicators(version)
    ]
    return MacroIndicators(series_version=version, indicators=ordered, derived=derived)
