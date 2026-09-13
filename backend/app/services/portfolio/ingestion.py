"""
Portfolio upload orchestration (architecture §26 Phase 1): validate, store the
source file as a Document, upsert Holdings, and persist a PortfolioSnapshot +
PortfolioPositions. No AI dependency — this is pure deterministic ingestion.
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.domain.errors import PortfolioValidationError, UnsupportedFileTypeError
from app.models.document import DocumentType
from app.models.holding import Holding
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot, SnapshotStatus
from app.providers.base import ObjectStorageProvider
from app.services.documents.hashing import PORTFOLIO_EXTENSIONS, extension_of
from app.services.documents.ingestion import intake_raw_file
from app.services.portfolio.parser import parse_and_validate


@dataclass
class PortfolioIngestResult:
    snapshot: PortfolioSnapshot
    warnings: list[str]
    was_duplicate_file: bool


def ingest_portfolio_upload(
    db: Session,
    storage: ObjectStorageProvider,
    *,
    filename: str,
    content: bytes,
    mime_type: str,
    reporting_currency: str,
) -> PortfolioIngestResult:
    settings = get_settings()

    # Check the extension before parsing so an unsupported file type reports
    # as 415, not as a confusing "couldn't read this as a spreadsheet" 422.
    if extension_of(filename) not in PORTFOLIO_EXTENSIONS:
        raise UnsupportedFileTypeError(filename, PORTFOLIO_EXTENSIONS)

    # Validate the content *before* touching the DB so a bad file never
    # leaves a half-committed Document + failed snapshot behind.
    parse_result = parse_and_validate(filename=filename, content=content)
    if not parse_result.is_valid:
        raise PortfolioValidationError(parse_result.row_errors)

    intake = intake_raw_file(
        db,
        storage,
        content=content,
        filename=filename,
        mime_type=mime_type,
        document_type=DocumentType.PORTFOLIO_SNAPSHOT,
        allowed_extensions=PORTFOLIO_EXTENSIONS,
        max_bytes=settings.max_upload_size_mb * 1024 * 1024,
    )

    snapshot = PortfolioSnapshot(
        source_file_id=intake.document.id,
        reporting_currency=reporting_currency,
        status=SnapshotStatus.PENDING.value,
    )
    db.add(snapshot)
    db.flush()

    for position in parse_result.positions:
        holding = db.query(Holding).filter(Holding.ticker == position.ticker).one_or_none()
        if holding is None:
            holding = Holding(
                ticker=position.ticker,
                name=position.name,
                asset_class=position.asset_class.value,
                asset_class_raw=position.asset_class_raw,
                sector=position.sector,
                trading_currency=position.currency,
            )
            db.add(holding)
            db.flush()
        else:
            # The latest upload is the source of truth for descriptive fields
            # (name/sector/currency can legitimately change over time).
            holding.name = position.name
            holding.asset_class = position.asset_class.value
            holding.asset_class_raw = position.asset_class_raw
            holding.sector = position.sector
            holding.trading_currency = position.currency

        db.add(
            PortfolioPosition(
                snapshot_id=snapshot.id,
                holding_id=holding.id,
                weight_pct=position.weight_pct,
                quantity=position.quantity,
                cost_basis=position.cost_basis,
                cost_basis_currency=position.currency if position.cost_basis is not None else None,
                notes=position.notes,
            )
        )

    snapshot.status = SnapshotStatus.VALIDATED.value
    db.commit()
    db.refresh(snapshot)

    return PortfolioIngestResult(
        snapshot=snapshot, warnings=parse_result.warnings, was_duplicate_file=intake.was_duplicate
    )
