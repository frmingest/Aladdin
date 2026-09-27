"""Dalio-mode endpoints (Epic F22): the All-Weather portfolio view (22.9),
the cycle-fit board (22.11), the Dalio macro/country data (22.3, 22.10)
and their refresh. Reads are served from stored data plus the cached price
history; only POST /dalio/refresh fetches from FRED and the World Bank.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.models.holding import Holding
from app.providers.factory import (
    get_country_indicator_provider_or_none,
    get_macro_data_provider_or_none,
    get_market_data_provider_or_none,
)
from app.schemas.dalio import (
    AllWeatherOut,
    CountryFigureOut,
    CountryRefreshOut,
    CountryRiskOut,
    CycleFitBoardOut,
    DalioDerivedOut,
    DalioMacroOut,
    DalioRefreshOut,
    DalioSeriesOut,
    GoldDemandOut,
)
from app.services.country_risk.domicile import country_exposure
from app.services.country_risk.indicators import get_country_risk, refresh_countries
from app.services.dalio import gold_demand
from app.services.dalio.all_weather import build_all_weather
from app.services.dalio.board import build_cycle_fit_board
from app.services.dalio.macro import get_dalio_macro, refresh_dalio_macro_data
from app.services.portfolio_overview import build_overview
from app.services.settings.demo_guard import require_not_demo
from app.services.settings.demo_mode import is_demo_mode
from app.services.settings.synthetic_dalio import (
    demo_all_weather,
    demo_cycle_fit_board,
    demo_dalio_macro,
)

router = APIRouter(prefix="/dalio", tags=["dalio"])


def _portfolio_countries(db: Session) -> list[str]:
    countries: list[str] = []
    for p in build_overview(db).positions:
        holding = db.get(Holding, p.holding_id)
        if holding is None:
            continue
        for c, w in country_exposure(db, holding).weights.items():
            if w >= 5 and c not in countries:
                countries.append(c)
    return countries


@router.get("/all-weather", response_model=AllWeatherOut)
def get_all_weather(
    db: Session = Depends(get_db),
    market_data_provider=Depends(get_market_data_provider_or_none),
) -> AllWeatherOut:
    if is_demo_mode(db):
        return demo_all_weather()
    result = build_all_weather(db, market_data_provider=market_data_provider)
    return AllWeatherOut.model_validate(result, from_attributes=True)


@router.get("/cycle-fit-board", response_model=CycleFitBoardOut)
def get_cycle_fit_board(db: Session = Depends(get_db)) -> CycleFitBoardOut:
    if is_demo_mode(db):
        return demo_cycle_fit_board()
    return CycleFitBoardOut.model_validate(build_cycle_fit_board(db), from_attributes=True)


@router.get("/macro", response_model=DalioMacroOut)
def get_dalio_macro_data(db: Session = Depends(get_db)) -> DalioMacroOut:
    """Stored values only — no network call."""
    if is_demo_mode(db):
        return demo_dalio_macro()
    macro = get_dalio_macro(db)
    countries = []
    for c in _portfolio_countries(db):
        risk = get_country_risk(db, c)
        countries.append(
            CountryRiskOut(
                country=risk.country, name=risk.name, currency=risk.currency,
                sdr_basket_currency=risk.sdr_basket_currency, ssi_score=risk.ssi.score, ssi_band=risk.ssi.band,
                ssi_components=risk.ssi.components, ssi_missing=risk.ssi.missing,
                data_quality=risk.ssi.data_quality,
                figures=[CountryFigureOut(**f.__dict__) for f in risk.figures],
                fetched_at=risk.fetched_at,
            )
        )
    summary = gold_demand.summarize(datetime.now(timezone.utc).date())
    return DalioMacroOut(
        series_version=macro.series_version,
        series=[
            DalioSeriesOut(
                key=s.key, label=s.label, group=s.group, display_unit=s.display_unit, frequency=s.frequency,
                value=s.value, observed_on=s.observed_on, change_12m=s.change_12m, stale=s.stale,
                description=s.description, source_series_id=s.source_series_id, source_url=s.source_url,
                last_error=s.last_error,
            )
            for s in macro.snapshots
        ],
        derived=[DalioDerivedOut(**d.__dict__) for d in macro.derived],
        countries=countries,
        gold_demand=GoldDemandOut(**summary.__dict__, source=gold_demand.SOURCE),
    )


@router.post("/refresh", response_model=DalioRefreshOut)
def refresh_dalio_data(
    db: Session = Depends(get_db),
    macro_provider=Depends(get_macro_data_provider_or_none),
    country_provider=Depends(get_country_indicator_provider_or_none),
) -> DalioRefreshOut:
    """Fetch the Dalio FRED series and the World Bank / WGI inputs for every
    country the portfolio is exposed to (>= 5% of a holding)."""
    require_not_demo(db)
    if macro_provider is None and country_provider is None:
        raise HTTPException(status_code=503, detail="Data fetching is off (MACRO_DATA_PROVIDER=none).")
    macro = refresh_dalio_macro_data(db, macro_provider) if macro_provider is not None else []
    countries = refresh_countries(db, country_provider, _portfolio_countries(db), only_stale=False)
    return DalioRefreshOut(
        macro=[
            {"key": r.key, "label": r.label, "status": r.status, "inserted": r.inserted, "error": r.error}
            for r in macro
        ],
        countries=[CountryRefreshOut(**c.__dict__) for c in countries],
    )
