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
from app.providers.factory import get_object_storage
from app.schemas.portfolio import (
    HoldingOut,
    PortfolioPositionOut,
    PortfolioSnapshotDetail,
    PortfolioSnapshotSummary,
    PortfolioUploadResponse,
)
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
