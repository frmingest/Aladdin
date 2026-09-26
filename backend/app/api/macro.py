"""Numeric macro data API (2026-09-24): Norges Bank / FRED / SSB series
stored in macro_observations, with deterministic changes and derived
real rates (app/services/macro/)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.providers.factory import get_macro_data_provider_or_none
from app.providers.macro_data_providers import MacroDataProvider
from app.schemas.macro import (
    MacroHistoryPointOut,
    MacroIndicatorOut,
    MacroIndicatorsOut,
    MacroRefreshOut,
    MacroSeriesRefreshOut,
)
from app.services.macro.indicators import (
    IndicatorSnapshot,
    MacroIndicators,
    get_macro_indicators,
)
from app.services.macro.refresh import refresh_macro_data
from app.services.settings.demo_guard import require_not_demo
from app.services.settings.demo_mode import is_demo_mode
from app.services.settings.synthetic_data import demo_macro_indicators

router = APIRouter(prefix="/macro", tags=["macro"])


def _indicator_out(snap: IndicatorSnapshot) -> MacroIndicatorOut:
    return MacroIndicatorOut(
        key=snap.key,
        label=snap.label,
        region=snap.region,
        group=snap.group,
        display_unit=snap.display_unit,
        frequency=snap.frequency,
        change_kind=snap.change_kind,
        description=snap.description,
        source_name=snap.source_name,
        source_series_id=snap.source_series_id,
        source_url=snap.source_url,
        derived=snap.derived,
        value=snap.value,
        observed_on=snap.observed_on,
        value_3m_ago=snap.value_3m_ago,
        change_3m=snap.change_3m,
        value_12m_ago=snap.value_12m_ago,
        change_12m=snap.change_12m,
        stale=snap.stale,
        age_days=snap.age_days,
        formula=snap.formula,
        last_success_at=snap.last_success_at,
        last_error=snap.last_error,
        history=[MacroHistoryPointOut(date=p.observed_on, value=p.value) for p in snap.history],
    )


def _indicators_out(result: MacroIndicators, *, fetching_enabled: bool) -> MacroIndicatorsOut:
    return MacroIndicatorsOut(
        series_version=result.series_version,
        fetching_enabled=fetching_enabled,
        last_success_at=result.last_success_at,
        indicators=[_indicator_out(s) for s in result.indicators],
        derived=[_indicator_out(s) for s in result.derived],
    )


@router.get("/indicators", response_model=MacroIndicatorsOut)
def list_indicators(
    db: Session = Depends(get_db),
    provider: MacroDataProvider | None = Depends(get_macro_data_provider_or_none),
) -> MacroIndicatorsOut:
    """Stored values only — no network call."""
    if is_demo_mode(db):
        return demo_macro_indicators()
    return _indicators_out(get_macro_indicators(db), fetching_enabled=provider is not None)


@router.post("/indicators/refresh", response_model=MacroRefreshOut)
def refresh_indicators(
    only_stale: bool = False,
    db: Session = Depends(get_db),
    provider: MacroDataProvider | None = Depends(get_macro_data_provider_or_none),
) -> MacroRefreshOut:
    require_not_demo(db)
    if provider is None:
        raise HTTPException(status_code=503, detail="Macro data fetching is off (MACRO_DATA_PROVIDER=none).")
    results = refresh_macro_data(db, provider, only_stale=only_stale)
    return MacroRefreshOut(
        results=[
            MacroSeriesRefreshOut(
                key=r.key,
                label=r.label,
                status=r.status,
                inserted=r.inserted,
                latest_observed=r.latest_observed,
                error=r.error,
            )
            for r in results
        ],
        indicators=_indicators_out(get_macro_indicators(db), fetching_enabled=True),
    )
