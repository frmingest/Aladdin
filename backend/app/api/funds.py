"""Fund / ETF facts API (Sprint 8, F9).

Figures are typed in (each row citing an uploaded document of this fund)
or imported from a provider holdings file; never extracted by an LLM
(decision 23). GET returns the facts together with every deterministic
fund metric (app/services/funds/metrics.py).
"""
from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.domain.document_types import (
    DOCUMENT_TYPE_FUND_HOLDINGS,
    DOCUMENT_TYPE_SEC_XBRL,
)
from app.domain.errors import (
    FileTooLargeError,
    UnreadableFileError,
    UnsupportedFileTypeError,
)
from app.models.document import Document
from app.models.holding import Holding
from app.providers.factory import get_object_storage
from app.schemas.fund import (
    FundDocumentOut,
    FundExposureOut,
    FundExposuresIn,
    FundFactsOut,
    FundProfileIn,
    FundProfileOut,
    FundReturnIn,
    FundReturnOut,
    HoldingsImportOut,
    ManualLinkIn,
)
from app.services.documents.ingestion import ingest_holding_document
from app.services.funds.facts import (
    EXPOSURE_DIMENSIONS,
    ExposureInput,
    FundFactsError,
    get_profile,
    latest_exposures,
    list_returns,
    replace_exposures,
    replace_returns,
    require_fund_holding,
    set_manual_link,
    upsert_profile,
)
from app.services.funds.holdings_import import HoldingsFileError, parse_holdings_file
from app.services.funds.metrics import compute_fund_metrics

router = APIRouter(prefix="/funds", tags=["funds"])


def _holding(db: Session, holding_id: UUID) -> Holding:
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")
    return holding


def _facts_out(db: Session, holding: Holding) -> FundFactsOut:
    profile = get_profile(db, holding.id)
    exposures: dict[str, list[FundExposureOut]] = {}
    for dimension in EXPOSURE_DIMENSIONS:
        _as_of, rows = latest_exposures(db, holding.id, dimension)
        exposures[dimension] = [FundExposureOut.model_validate(r) for r in rows]
    documents = [
        FundDocumentOut(
            id=d.id, original_filename=d.original_filename, type=d.type, reporting_period=d.reporting_period
        )
        for d in db.scalars(
            select(Document)
            .where(Document.holding_id == holding.id, Document.type != DOCUMENT_TYPE_SEC_XBRL)
            .order_by(Document.uploaded_at.desc())
        )
    ]
    return FundFactsOut(
        holding_id=holding.id,
        instrument_type=holding.asset_class_raw,
        profile=FundProfileOut.model_validate(profile) if profile else None,
        returns=[FundReturnOut.model_validate(r) for r in list_returns(db, holding.id)],
        exposures=exposures,
        documents=documents,
        metrics=compute_fund_metrics(db, holding),
    )


@router.get("/{holding_id}", response_model=FundFactsOut)
def get_fund_facts(holding_id: UUID, db: Session = Depends(get_db)) -> FundFactsOut:
    holding = _holding(db, holding_id)
    try:
        require_fund_holding(holding)
    except FundFactsError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _facts_out(db, holding)


@router.put("/{holding_id}/profile", response_model=FundFactsOut)
def put_profile(holding_id: UUID, body: FundProfileIn, db: Session = Depends(get_db)) -> FundFactsOut:
    holding = _holding(db, holding_id)
    values = body.model_dump()
    for key in ("base_currency", "fund_size_currency"):
        if values.get(key):
            values[key] = values[key].upper()
    try:
        upsert_profile(db, holding, values)
    except FundFactsError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _facts_out(db, holding)


@router.put("/{holding_id}/returns", response_model=FundFactsOut)
def put_returns(holding_id: UUID, body: list[FundReturnIn], db: Session = Depends(get_db)) -> FundFactsOut:
    holding = _holding(db, holding_id)
    try:
        replace_returns(db, holding, [r.model_dump() for r in body])
    except FundFactsError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _facts_out(db, holding)


@router.put("/{holding_id}/exposures/{dimension}", response_model=FundFactsOut)
def put_exposures(
    holding_id: UUID, dimension: str, body: FundExposuresIn, db: Session = Depends(get_db)
) -> FundFactsOut:
    holding = _holding(db, holding_id)
    try:
        replace_exposures(
            db,
            holding,
            dimension=dimension,
            as_of_date=body.as_of_date,
            source_document_id=body.source_document_id,
            rows=[
                ExposureInput(
                    label=r.label, weight_pct=r.weight_pct, ticker=r.ticker, isin=r.isin, source_page=r.source_page
                )
                for r in body.rows
            ],
        )
    except FundFactsError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _facts_out(db, holding)


@router.patch("/{holding_id}/exposures/{exposure_id}/link", response_model=FundFactsOut)
def patch_link(
    holding_id: UUID, exposure_id: UUID, body: ManualLinkIn, db: Session = Depends(get_db)
) -> FundFactsOut:
    holding = _holding(db, holding_id)
    try:
        set_manual_link(db, holding, exposure_id, body.linked_holding_id)
    except FundFactsError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _facts_out(db, holding)


@router.post("/{holding_id}/holdings/import", response_model=HoldingsImportOut, status_code=201)
async def import_holdings_file(
    holding_id: UUID,
    file: UploadFile = File(...),
    as_of_date: date | None = Form(default=None),
    db: Session = Depends(get_db),
    storage=Depends(get_object_storage),
) -> HoldingsImportOut:
    """Uploads a provider holdings file (CSV/XLSX) as a `fund_holdings`
    document of this fund, parses it deterministically and replaces the
    holding rows for its as-of date. Sector / country / currency splits
    are derived from the same rows when the file has those columns."""
    holding = _holding(db, holding_id)
    try:
        require_fund_holding(holding)
    except FundFactsError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    content = await file.read()
    filename = file.filename or "holdings.csv"
    # Parse first: a file that isn't a holdings list is refused before
    # anything is stored.
    try:
        parsed = parse_holdings_file(filename, content)
    except HoldingsFileError as exc:
        raise HTTPException(status_code=422, detail=f"could not read holdings: {exc}") from exc
    effective_date = as_of_date or parsed.as_of_date
    if effective_date is None:
        raise HTTPException(
            status_code=422,
            detail="the file does not say which date its holdings are as of — enter the as-of date",
        )

    try:
        intake = ingest_holding_document(
            db,
            storage,
            holding_id=holding.id,
            filename=filename,
            content=content,
            mime_type=file.content_type or "application/octet-stream",
            document_type=DOCUMENT_TYPE_FUND_HOLDINGS,
            reporting_period=effective_date.isoformat(),
        )
    except UnsupportedFileTypeError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except FileTooLargeError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except UnreadableFileError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    document = intake.document
    if document.holding_id != holding.id:
        raise HTTPException(
            status_code=409,
            detail=f"this exact file was already uploaded to another holding ('{document.original_filename}')",
        )

    try:
        created = replace_exposures(
            db,
            holding,
            dimension="holding",
            as_of_date=effective_date,
            source_document_id=document.id,
            rows=[
                ExposureInput(label=r.name, weight_pct=r.weight_pct, ticker=r.ticker, isin=r.isin)
                for r in parsed.rows
            ],
            commit=False,
        )
        derived: list[str] = []
        for dimension in ("sector", "country", "currency"):
            split = parsed.derived_exposures(dimension)
            if split:
                replace_exposures(
                    db,
                    holding,
                    dimension=dimension,
                    as_of_date=effective_date,
                    source_document_id=document.id,
                    rows=[ExposureInput(label=label[:255], weight_pct=weight) for label, weight in split],
                    commit=False,
                )
                derived.append(dimension)
        db.commit()
    except FundFactsError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return HoldingsImportOut(
        document_id=document.id,
        was_duplicate_file=intake.was_duplicate,
        as_of_date=effective_date,
        rows_imported=len(created),
        weight_sum_pct=parsed.weight_sum_pct,
        linked=sum(1 for e in created if e.linked_holding_id is not None),
        derived_dimensions=derived,
        sheet=parsed.sheet,
        header_row=parsed.header_row,
        columns=parsed.columns,
        weights_were_fractions=parsed.weights_were_fractions,
        warnings=parsed.warnings,
    )
