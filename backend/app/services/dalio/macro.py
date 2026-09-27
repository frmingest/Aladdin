"""Dalio-only macro series (app/domain/dalio_macro_series.py): refresh,
snapshots and the two derived liquidity/debt figures (story 22.3).

CLAUDE.md Rule 1: every figure is Decimal arithmetic here, with the unit
conversion spelled out in the formula text the evidence item carries:

- Fed net liquidity (USD bn) = WALCL / 1000 (millions -> billions)
  - WTREGEN - RRPONTSYD, each taken at or before the WALCL date.
- Interest burden (%) = federal interest payments / federal current
  receipts x 100, same quarter (both SAAR, billions).

A missing input leaves the derived figure missing, with the reason — never
a placeholder (plan §2 "no fabricated data").
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.domain.dalio_macro_series import get_dalio_macro_series
from app.models.macro import MacroSeriesStatus
from app.providers.macro_data_providers import MacroDataProvider
from app.services.macro.indicators import (
    IndicatorSnapshot,
    _months_back,
    _value_on_or_before,
    build_snapshot,
)
from app.services.macro.refresh import (
    _RETRY_FAILED_AFTER,
    SeriesRefreshResult,
    _utc,
    refresh_series,
    stored_points,
)

logger = logging.getLogger(__name__)

_THOUSAND = Decimal(1000)
_HUNDRED = Decimal(100)
_HISTORY_DAYS = 3 * 366


def refresh_dalio_macro_data(
    db: Session, provider: MacroDataProvider, *, only_stale: bool = False, now: datetime | None = None
) -> list[SeriesRefreshResult]:
    """Same rules as app/services/macro/refresh.refresh_macro_data, over the
    Dalio catalogue: each series records its own success or error."""
    settings = get_settings()
    now = now or datetime.now(timezone.utc)
    threshold = now - timedelta(hours=settings.macro_stale_after_hours)
    results: list[SeriesRefreshResult] = []
    for spec in get_dalio_macro_series(settings.active_dalio_macro_series_version):
        if only_stale:
            status = db.get(MacroSeriesStatus, spec.key)
            last_success = _utc(status.last_success_at) if status else None
            if last_success is not None and last_success >= threshold:
                results.append(SeriesRefreshResult(spec.key, spec.label, "fresh"))
                continue
            last_attempt = _utc(status.last_attempt_at) if status else None
            if last_attempt is not None and last_attempt >= now - _RETRY_FAILED_AFTER:
                results.append(
                    SeriesRefreshResult(spec.key, spec.label, "failed", error=status.last_error if status else None)
                )
                continue
        results.append(refresh_series(db, provider, spec, now=now))
    return results


def ensure_dalio_macro_fresh(db: Session, provider: MacroDataProvider | None) -> None:
    """Best effort before a Dalio packet is built. Never raises."""
    if provider is None:
        return
    try:
        refresh_dalio_macro_data(db, provider, only_stale=True)
    except Exception:
        logger.exception("Dalio macro refresh before analysis failed")
        db.rollback()


@dataclass
class DerivedFigure:
    key: str
    label: str
    unit: str
    value: Decimal | None = None
    observed_on: date | None = None
    value_12m_ago: Decimal | None = None
    change_12m: Decimal | None = None
    formula: str | None = None
    reason: str | None = None  # why value is None
    description: str = ""


@dataclass
class DalioMacro:
    series_version: str
    snapshots: list[IndicatorSnapshot] = field(default_factory=list)
    derived: list[DerivedFigure] = field(default_factory=list)

    def by_key(self) -> dict[str, IndicatorSnapshot]:
        return {s.key: s for s in self.snapshots}


def _q(value: Decimal, places: str = "0.01") -> Decimal:
    return value.quantize(Decimal(places), rounding=ROUND_HALF_UP)


def net_liquidity_series(
    walcl: list[tuple[date, Decimal]],
    tga: list[tuple[date, Decimal]],
    rrp: list[tuple[date, Decimal]],
) -> list[tuple[date, Decimal]]:
    """(date, USD bn) on each WALCL date that has a TGA and RRP value at or
    before it. WALCL is in millions, the other two in billions."""
    out: list[tuple[date, Decimal]] = []
    for observed, assets_mn in walcl:
        t = _value_on_or_before(tga, observed)
        r = _value_on_or_before(rrp, observed)
        if t is None or r is None:
            continue
        out.append((observed, assets_mn / _THOUSAND - t[1] - r[1]))
    return out


def ratio_series(
    numerator: list[tuple[date, Decimal]], denominator: list[tuple[date, Decimal]]
) -> list[tuple[date, Decimal]]:
    """numerator / denominator x 100 on dates present in both."""
    denom = dict(denominator)
    return [(d, v / denom[d] * _HUNDRED) for d, v in numerator if d in denom and denom[d] != 0]


def _derived_from_series(
    key: str, label: str, unit: str, series: list[tuple[date, Decimal]], *, formula: str, missing: str, description: str
) -> DerivedFigure:
    fig = DerivedFigure(key=key, label=label, unit=unit, description=description)
    if not series:
        fig.reason = missing
        return fig
    latest_date, latest_value = series[-1]
    fig.value = _q(latest_value)
    fig.observed_on = latest_date
    fig.formula = formula
    earlier = _value_on_or_before(series, _months_back(latest_date, 12))
    if earlier is not None:
        fig.value_12m_ago = _q(earlier[1])
        fig.change_12m = _q(latest_value - earlier[1])
    return fig


def get_dalio_macro(db: Session, *, today: date | None = None) -> DalioMacro:
    settings = get_settings()
    today = today or datetime.now(timezone.utc).date()
    since = today - timedelta(days=_HISTORY_DAYS)
    version = settings.active_dalio_macro_series_version
    result = DalioMacro(series_version=version)
    raw: dict[str, list[tuple[date, Decimal]]] = {}
    for spec in get_dalio_macro_series(version):
        points = stored_points(db, spec.key, since=since)
        raw[spec.key] = points
        result.snapshots.append(
            build_snapshot(spec, points, today=today, status=db.get(MacroSeriesStatus, spec.key))
        )

    walcl, tga, rrp = raw["us_fed_total_assets"], raw["us_treasury_general_account"], raw["us_reverse_repo"]
    liquidity = net_liquidity_series(walcl, tga, rrp)
    formula = None
    if liquidity:
        d = liquidity[-1][0]
        a = walcl[[p[0] for p in walcl].index(d)][1]
        t = _value_on_or_before(tga, d)
        r = _value_on_or_before(rrp, d)
        formula = (
            f"WALCL {a} mn / 1000 - WTREGEN {t[1]} bn ({t[0]}) - RRPONTSYD {r[1]} bn ({r[0]}), "
            f"as of {d}"
        )
    result.derived.append(
        _derived_from_series(
            "us_fed_net_liquidity", "Fed net liquidity", "USD bn", liquidity,
            formula=formula or "",
            missing="needs stored WALCL, WTREGEN and RRPONTSYD observations",
            description="Fed balance sheet minus the Treasury's cash account and reverse repo: the dollar liquidity "
            "actually left in the system. Rising = easing, falling = draining.",
        )
    )

    interest, receipts = raw["us_federal_interest_outlays"], raw["us_federal_receipts"]
    burden = ratio_series(interest, receipts)
    burden_formula = ""
    if burden:
        d = burden[-1][0]
        burden_formula = (
            f"interest {dict(interest)[d]} bn / receipts {dict(receipts)[d]} bn x 100, quarter starting {d}"
        )
    result.derived.append(
        _derived_from_series(
            "us_interest_to_receipts", "US federal interest / receipts", "%", burden,
            formula=burden_formula,
            missing="needs stored A091RC1Q027SBEA and FGRECPT observations for the same quarter",
            description="Share of federal revenue spent on interest — a late-long-term-debt-cycle warning sign when it rises.",
        )
    )
    return result
