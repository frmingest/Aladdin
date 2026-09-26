"""Physical gold/silver coin tracking (2026-09-26, Faiz's request: "part
of my investments"). See app/services/precious_metals/.

GET .../overview values every holding at the current spot price (cached,
refreshed when stale — same discipline as every other live price in the
app). GET .../price-history/{metal} serves the accumulated spot-price
series for the price-development chart; there is no backfill (see
app/providers/gold_api_provider.py's docstring), so this can be a short
series right after the feature is first used and grows by one point a day
after that.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.domain.precious_metals import COIN_SERIES, METALS, is_valid_series
from app.providers.base import MarketDataProvider
from app.providers.factory import get_market_data_provider, get_metal_price_provider
from app.schemas.precious_metals import (
    CoinSeriesOut,
    HoldingRowOut,
    MetalPriceHistoryOut,
    MetalSpotOut,
    PreciousMetalHoldingCreate,
    PreciousMetalHoldingUpdate,
    PreciousMetalsOverviewOut,
    PricePointOut,
)
from app.services.precious_metals.holdings import (
    InvalidCoinSeriesError,
    MetalsOverview,
    compute_overview,
    create_holding,
    delete_holding,
    update_holding,
)
from app.services.precious_metals.pricing import get_price_history_nok

router = APIRouter(prefix="/precious-metals", tags=["precious-metals"])


@router.get("/coin-series", response_model=list[CoinSeriesOut])
def list_coin_series() -> list[CoinSeriesOut]:
    return [
        CoinSeriesOut(code=c.code, name=c.name, metal=c.metal, country=c.country, weight_oz=c.weight_oz)
        for c in COIN_SERIES
    ]


def _to_overview_out(overview: MetalsOverview) -> PreciousMetalsOverviewOut:
    from app.domain.precious_metals import display_name

    return PreciousMetalsOverviewOut(
        as_of=overview.as_of,
        spots=[
            MetalSpotOut(
                metal=s.metal, available=s.available, price_nok_per_oz=s.price_nok_per_oz,
                price_usd_per_oz=s.price_usd_per_oz, usd_nok_rate=s.usd_nok_rate, as_of=s.as_of, reason=s.reason,
            )
            for s in overview.spots.values()
        ],
        holdings=[
            HoldingRowOut(
                id=str(h.id), coin_series=h.coin_series, coin_series_label=display_name(h.coin_series),
                metal=h.metal, quantity=h.quantity, purchase_date=h.purchase_date,
                purchase_price_nok=h.purchase_price_nok, storage_location=h.storage_location, notes=h.notes,
                value_nok=h.value_nok, unrealized_pnl_nok=h.unrealized_pnl_nok,
            )
            for h in overview.holdings
        ],
        total_value_nok=overview.total_value_nok,
        total_oz_by_metal=overview.total_oz_by_metal,
    )


@router.get("/overview", response_model=PreciousMetalsOverviewOut)
def get_overview(
    db: Session = Depends(get_db),
    metal_provider: MarketDataProvider = Depends(get_metal_price_provider),
    fx_provider: MarketDataProvider = Depends(get_market_data_provider),
) -> PreciousMetalsOverviewOut:
    return _to_overview_out(compute_overview(db, metal_provider, fx_provider))


@router.post("/overview/refresh", response_model=PreciousMetalsOverviewOut)
def refresh_overview(
    db: Session = Depends(get_db),
    metal_provider: MarketDataProvider = Depends(get_metal_price_provider),
    fx_provider: MarketDataProvider = Depends(get_market_data_provider),
) -> PreciousMetalsOverviewOut:
    return _to_overview_out(compute_overview(db, metal_provider, fx_provider, force=True))


@router.get("/price-history/{metal}", response_model=MetalPriceHistoryOut)
def get_price_history(
    metal: str,
    days: int = Query(default=365, ge=1, le=3650),
    db: Session = Depends(get_db),
    metal_provider: MarketDataProvider = Depends(get_metal_price_provider),
    fx_provider: MarketDataProvider = Depends(get_market_data_provider),
) -> MetalPriceHistoryOut:
    if metal not in METALS:
        raise HTTPException(status_code=404, detail=f"Unknown metal: {metal!r}")
    points = get_price_history_nok(db, metal_provider, fx_provider, metal=metal)
    cutoff_count = max(days, 1)
    points = points[-cutoff_count:]
    return MetalPriceHistoryOut(
        metal=metal,
        points=[PricePointOut(on=on, price_nok=price) for on, price in points],
        method_note=(
            "Built from prices this app has fetched itself since gold/silver tracking was turned "
            "on (gold-api.com's historical data isn't free) — there is no backfilled history before "
            "that. One new point accumulates per day this app is used."
        ),
    )


@router.post("", response_model=HoldingRowOut, status_code=201)
def add_holding(
    payload: PreciousMetalHoldingCreate,
    db: Session = Depends(get_db),
) -> HoldingRowOut:
    from app.domain.precious_metals import display_name

    if not is_valid_series(payload.coin_series):
        raise HTTPException(status_code=422, detail=f"Unknown coin series: {payload.coin_series!r}")
    try:
        holding = create_holding(
            db,
            coin_series=payload.coin_series,
            quantity=payload.quantity,
            purchase_date=payload.purchase_date,
            purchase_price_nok=payload.purchase_price_nok,
            storage_location=payload.storage_location,
            notes=payload.notes,
        )
    except (InvalidCoinSeriesError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return HoldingRowOut(
        id=str(holding.id), coin_series=holding.coin_series, coin_series_label=display_name(holding.coin_series),
        metal=holding.metal, quantity=holding.quantity, purchase_date=holding.purchase_date,
        purchase_price_nok=holding.purchase_price_nok, storage_location=holding.storage_location,
        notes=holding.notes, value_nok=None, unrealized_pnl_nok=None,
    )


@router.patch("/{holding_id}", response_model=HoldingRowOut)
def patch_holding(
    holding_id: UUID,
    payload: PreciousMetalHoldingUpdate,
    db: Session = Depends(get_db),
) -> HoldingRowOut:
    from app.domain.precious_metals import display_name

    try:
        holding = update_holding(
            db,
            holding_id,
            quantity=payload.quantity,
            purchase_date=payload.purchase_date,
            purchase_price_nok=payload.purchase_price_nok,
            clear_purchase_price=payload.clear_purchase_price,
            storage_location=payload.storage_location,
            clear_storage_location=payload.clear_storage_location,
            notes=payload.notes,
            clear_notes=payload.clear_notes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if holding is None:
        raise HTTPException(status_code=404, detail="Holding not found")
    return HoldingRowOut(
        id=str(holding.id), coin_series=holding.coin_series, coin_series_label=display_name(holding.coin_series),
        metal=holding.metal, quantity=holding.quantity, purchase_date=holding.purchase_date,
        purchase_price_nok=holding.purchase_price_nok, storage_location=holding.storage_location,
        notes=holding.notes, value_nok=None, unrealized_pnl_nok=None,
    )


@router.delete("/{holding_id}", status_code=204, response_model=None)
def remove_holding(holding_id: UUID, db: Session = Depends(get_db)) -> None:
    if not delete_holding(db, holding_id):
        raise HTTPException(status_code=404, detail="Holding not found")
