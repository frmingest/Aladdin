"""Portfolio upload + snapshot endpoints (architecture §26 Phase 1)."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.settings import get_settings
from app.domain.errors import (
    FileTooLargeError,
    PortfolioValidationError,
    UnreadableFileError,
    UnsupportedFileTypeError,
)
from app.models.holding import Holding
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.providers.base import MarketDataProvider
from app.providers.factory import get_market_data_provider, get_object_storage
from app.schemas.market_data import PortfolioValuationOut
from app.schemas.portfolio import (
    HoldingOut,
    HoldingUpdate,
    PortfolioPositionOut,
    PortfolioSnapshotDetail,
    PortfolioSnapshotSummary,
    PortfolioUploadResponse,
)
from app.services.market_data.valuation import refresh_and_value_snapshot
from app.services.portfolio.ingestion import ingest_portfolio_upload

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


def _position_to_out(position: PortfolioPosition) -> PortfolioPositionOut:
    holding = position.holding
    return PortfolioPositionOut(
        holding_id=holding.id,
        ticker=holding.ticker,
        name=holding.name,
        asset_class=holding.asset_class,
        sector=holding.sector,
        trading_currency=holding.trading_currency,
        weight_pct=position.weight_pct,
        quantity=position.quantity,
        cost_basis=position.cost_basis,
        cost_basis_currency=position.cost_basis_currency,
        notes=position.notes,
    )


def _snapshot_to_summary(snapshot: PortfolioSnapshot) -> PortfolioSnapshotSummary:
    return PortfolioSnapshotSummary(
        id=snapshot.id,
        uploaded_at=snapshot.uploaded_at,
        source_file_id=snapshot.source_file_id,
        reporting_currency=snapshot.reporting_currency,
        status=snapshot.status,
        position_count=len(snapshot.positions),
    )


def _snapshot_to_detail(snapshot: PortfolioSnapshot) -> PortfolioSnapshotDetail:
    summary = _snapshot_to_summary(snapshot)
    return PortfolioSnapshotDetail(
        **summary.model_dump(),
        positions=[_position_to_out(p) for p in snapshot.positions],
    )


@router.post("/upload", response_model=PortfolioUploadResponse, status_code=201)
async def upload_portfolio(
    file: UploadFile = File(...),
    reporting_currency: str | None = Form(default=None),
    db: Session = Depends(get_db),
    storage=Depends(get_object_storage),
) -> PortfolioUploadResponse:
    settings = get_settings()
    content = await file.read()

    try:
        result = ingest_portfolio_upload(
            db,
            storage,
            filename=file.filename or "upload",
            content=content,
            mime_type=file.content_type or "application/octet-stream",
            reporting_currency=(reporting_currency or settings.default_reporting_currency).upper(),
        )
    except PortfolioValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail={"message": str(exc), "row_errors": exc.row_errors},
        ) from exc
    except UnsupportedFileTypeError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except FileTooLargeError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except UnreadableFileError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return PortfolioUploadResponse(
        snapshot=_snapshot_to_detail(result.snapshot),
        warnings=result.warnings,
        was_duplicate_file=result.was_duplicate_file,
    )


@router.get("/snapshots", response_model=list[PortfolioSnapshotSummary])
def list_snapshots(db: Session = Depends(get_db)) -> list[PortfolioSnapshotSummary]:
    snapshots = db.query(PortfolioSnapshot).order_by(PortfolioSnapshot.uploaded_at.desc()).all()
    return [_snapshot_to_summary(s) for s in snapshots]


@router.get("/snapshots/{snapshot_id}", response_model=PortfolioSnapshotDetail)
def get_snapshot(snapshot_id: UUID, db: Session = Depends(get_db)) -> PortfolioSnapshotDetail:
    snapshot = db.get(PortfolioSnapshot, snapshot_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="snapshot not found")
    return _snapshot_to_detail(snapshot)


@router.get("/holdings", response_model=list[HoldingOut])
def list_holdings(db: Session = Depends(get_db)) -> list[HoldingOut]:
    """Used by the document-upload UI to let the user pick which holding a
    report belongs to (documents.holding_id, §20)."""
    holdings = db.query(Holding).order_by(Holding.ticker).all()
    return [HoldingOut.model_validate(h) for h in holdings]


@router.patch("/holdings/{holding_id}", response_model=HoldingOut)
def update_holding(
    holding_id: UUID, body: HoldingUpdate, db: Session = Depends(get_db)
) -> HoldingOut:
    """Sets a holding's market-data symbol (§26 Phase 2). Needed for any
    holding ingested from a Nordnet export (decision 0003), which has no
    exchange ticker of its own — market_ticker starts NULL for those and
    must be supplied explicitly here rather than guessed (§21)."""
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")

    market_ticker = (body.market_ticker or "").strip() or None
    holding.market_ticker = market_ticker
    db.commit()
    db.refresh(holding)
    return HoldingOut.model_validate(holding)


@router.post("/snapshots/{snapshot_id}/valuation", response_model=PortfolioValuationOut)
def refresh_valuation(
    snapshot_id: UUID,
    db: Session = Depends(get_db),
    provider: MarketDataProvider = Depends(get_market_data_provider),
) -> PortfolioValuationOut:
    """Fetches live prices/FX for every holding in the snapshot, persists
    the observations (§8.3 provenance), and returns deterministic market
    value, unrealized P&L, and concentration/exposure (§26 Phase 2, §2.2 —
    no LLM involvement).

    A holding failing to price (no market_ticker set, delisted ticker, FX
    pair unavailable) does not fail this request — it's reported per-holding
    via `data_warning` and excluded from totals, with that exclusion also
    surfaced in `warnings` (§21: fail visibly, not silently)."""
    snapshot = db.get(PortfolioSnapshot, snapshot_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="snapshot not found")

    valuation = refresh_and_value_snapshot(db, provider, snapshot)
    return PortfolioValuationOut.model_validate(valuation, from_attributes=True)
