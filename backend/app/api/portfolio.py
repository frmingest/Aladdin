"""Portfolio upload + snapshot endpoints (architecture §26 Phase 1)."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.settings import get_settings
from app.domain.errors import (
    FileTooLargeError,
    PortfolioValidationError,
    UnreadableFileError,
    UnsupportedFileTypeError,
)
from app.models.account import Account
from app.models.holding import Holding
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.providers.base import MarketDataProvider
from app.providers.factory import get_market_data_provider, get_object_storage
from app.schemas.market_data import PortfolioValuationOut
from app.schemas.portfolio import (
    HoldingOut,
    HoldingUpdate,
    ManualPositionCreate,
    PortfolioPositionOut,
    PortfolioResetResponse,
    PortfolioSnapshotDetail,
    PortfolioSnapshotSummary,
    PortfolioUploadResponse,
)
from app.services.market_data.valuation import refresh_and_value_snapshot
from app.services.portfolio.ingestion import ingest_portfolio_upload
from app.services.portfolio.manual_entry import ManualEntryValidationError, add_manual_position
from app.services.portfolio.reset import reset_all_portfolio_data

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
        account_id=position.account_id,
        account_name=position.account.name if position.account is not None else None,
        acquired_at=position.acquired_at,
    )


def _snapshot_to_summary(snapshot: PortfolioSnapshot) -> PortfolioSnapshotSummary:
    return PortfolioSnapshotSummary(
        id=snapshot.id,
        uploaded_at=snapshot.uploaded_at,
        source_file_id=snapshot.source_file_id,
        reporting_currency=snapshot.reporting_currency,
        status=snapshot.status,
        position_count=len(snapshot.positions),
        account_id=snapshot.account_id,
        account_name=snapshot.account.name if snapshot.account is not None else None,
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
    account_id: UUID | None = Form(default=None),
    db: Session = Depends(get_db),
    storage=Depends(get_object_storage),
) -> PortfolioUploadResponse:
    settings = get_settings()

    if account_id is not None and db.get(Account, account_id) is None:
        raise HTTPException(status_code=404, detail=f"account '{account_id}' not found")

    content = await file.read()

    try:
        result = ingest_portfolio_upload(
            db,
            storage,
            filename=file.filename or "upload",
            content=content,
            mime_type=file.content_type or "application/octet-stream",
            reporting_currency=(reporting_currency or settings.default_reporting_currency).upper(),
            account_id=account_id,
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
        new_position_count=result.new_position_count,
        updated_position_count=result.updated_position_count,
        carried_forward_position_count=result.carried_forward_position_count,
    )


@router.delete("/reset", response_model=PortfolioResetResponse)
def reset_portfolio(confirm: bool = False, db: Session = Depends(get_db)) -> PortfolioResetResponse:
    """Wipes every holding, snapshot, and uploaded portfolio file, plus every
    document/financial-fact/market-observation/thesis/valuation-case/
    analysis-run/risk-snapshot derived from them — a full, irreversible
    reset back to an empty portfolio. Requires `?confirm=true` so this can
    never fire from an accidental DELETE with no query string."""
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="pass ?confirm=true to confirm this irreversible full reset",
        )
    result = reset_all_portfolio_data(db)
    return PortfolioResetResponse(
        holdings_deleted=result.holdings_deleted,
        snapshots_deleted=result.snapshots_deleted,
        documents_deleted=result.documents_deleted,
    )


@router.get("/snapshots", response_model=list[PortfolioSnapshotSummary])
def list_snapshots(
    account_id: UUID | None = None, db: Session = Depends(get_db)
) -> list[PortfolioSnapshotSummary]:
    query = db.query(PortfolioSnapshot)
    if account_id is not None:
        query = query.filter(PortfolioSnapshot.account_id == account_id)
    snapshots = query.order_by(PortfolioSnapshot.uploaded_at.desc()).all()
    return [_snapshot_to_summary(s) for s in snapshots]


@router.get("/snapshots/{snapshot_id}", response_model=PortfolioSnapshotDetail)
def get_snapshot(snapshot_id: UUID, db: Session = Depends(get_db)) -> PortfolioSnapshotDetail:
    snapshot = db.get(PortfolioSnapshot, snapshot_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="snapshot not found")
    return _snapshot_to_detail(snapshot)


@router.get("/holdings", response_model=list[HoldingOut])
def list_holdings(
    account_id: list[UUID] = Query(default=[]), db: Session = Depends(get_db)
) -> list[HoldingOut]:
    """Used by the document-upload UI to let the user pick which holding a
    report belongs to (documents.holding_id, §20), and by the dashboard to
    let the user narrow the holding picker down to one or more accounts (the
    dashboard's account filter, §26 accounts feature — pass `?account_id=`
    once per selected account; omit it entirely for "all accounts").

    `account_id` filters to holdings that appear, tagged with one of those
    accounts, in the *latest* snapshot — i.e. what those accounts currently
    hold, not everything they have ever held (older, since-cleared positions
    aren't "watched" for an account anymore)."""
    query = db.query(Holding)
    if account_id:
        latest_snapshot = (
            db.query(PortfolioSnapshot).order_by(PortfolioSnapshot.uploaded_at.desc()).first()
        )
        if latest_snapshot is None:
            return []
        holding_ids = (
            db.query(PortfolioPosition.holding_id)
            .filter(
                PortfolioPosition.snapshot_id == latest_snapshot.id,
                PortfolioPosition.account_id.in_(account_id),
            )
            .scalar_subquery()
        )
        query = query.filter(Holding.id.in_(holding_ids))
    holdings = query.order_by(Holding.ticker).all()
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


@router.post("/holdings/manual", response_model=PortfolioPositionOut, status_code=201)
def add_manual_holding(
    body: ManualPositionCreate, db: Session = Depends(get_db)
) -> PortfolioPositionOut:
    """Hand-enters one lot of an alternative asset (§26 Phase 8, ADR 0011) —
    a physical gold/silver coin bought on its own date, or an item added to
    a collection — rather than through the bulk CSV/XLSX upload every other
    holding goes through. Scoped to `asset_class in {COMMODITY,
    COLLECTIBLE}`; see app.services.portfolio.manual_entry for why, and for
    how a second lot of the same ticker is handled (a new position, not a
    merge).

    Every manual entry lands in one persistent "manual entries" snapshot
    (`GET /portfolio/snapshots` will show it once one exists) rather than a
    new snapshot per call — it shows up in `GET /portfolio/holdings` and in
    valuation/concentration exactly like any other holding once it has a
    `market_ticker` (gold/silver route through the gold-api.com provider;
    see app.providers.gold_metal_provider) or is refreshed manually."""
    try:
        result = add_manual_position(
            db,
            ticker=body.ticker,
            name=body.name,
            asset_class=body.asset_class,
            trading_currency=body.trading_currency,
            quantity=body.quantity,
            cost_basis=body.cost_basis,
            cost_basis_currency=body.cost_basis_currency,
            market_ticker=body.market_ticker,
            custody_type=body.custody_type,
            acquired_at=body.acquired_at,
            notes=body.notes,
            account_id=body.account_id,
        )
    except ManualEntryValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return _position_to_out(result.position)


@router.post("/snapshots/{snapshot_id}/valuation", response_model=PortfolioValuationOut)
def refresh_valuation(
    snapshot_id: UUID,
    account_id: list[UUID] = Query(default=[]),
    db: Session = Depends(get_db),
    provider: MarketDataProvider = Depends(get_market_data_provider),
) -> PortfolioValuationOut:
    """Fetches live prices/FX for every holding in the snapshot, persists
    the observations (§8.3 provenance), and returns deterministic market
    value, unrealized P&L, and concentration/exposure (§26 Phase 2, §2.2 —
    no LLM involvement).

    `account_id` (repeatable) scopes the computation to just those accounts'
    positions — the dashboard's account filter (§26 accounts feature).
    Omitting it values every position in the snapshot, same as before this
    parameter existed.

    A holding failing to price (no market_ticker set, delisted ticker, FX
    pair unavailable) does not fail this request — it's reported per-holding
    via `data_warning` and excluded from totals, with that exclusion also
    surfaced in `warnings` (§21: fail visibly, not silently)."""
    snapshot = db.get(PortfolioSnapshot, snapshot_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="snapshot not found")

    valuation = refresh_and_value_snapshot(
        db, provider, snapshot, account_ids=set(account_id) if account_id else None
    )
    return PortfolioValuationOut.model_validate(valuation, from_attributes=True)
