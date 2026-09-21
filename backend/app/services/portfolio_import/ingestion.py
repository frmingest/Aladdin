"""Portfolio CSV import — DB side.

Stores the raw file as a traceable Document (no page/text extraction here
— see csv_parser.py's docstring for why this structured format doesn't go
through the PDF/PPTX/XLSX extraction pipeline in
app/services/documents/ingestion.py), then find-or-creates the Account and
Holdings the parsed rows point at, and creates one PortfolioSnapshot + its
PortfolioPositions in a single transaction.

Every PortfolioSnapshot still points at a real uploaded Document
(source_file_id, NOT NULL) — Faiz's explicit traceability choice
(2026-09-21, see app/api/portfolio.py's module docstring) applies here
exactly as it does to the manual snapshot-create path.

Faiz also explicitly asked (same session) that every row in these mixed
brokerage exports be imported — stocks, equity ETFs, bond funds,
money-market funds, a physical gold ETC — tagged with its real instrument
type via app/domain/instrument_types.py, rather than silently dropping the
non-equity rows. CLAUDE.md Rule 1 (deterministic arithmetic) applies: every
figure below is either a raw broker-reported value or a simple
weight/cost-basis computation from those raw values, never LLM output.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.domain.document_types import DOCUMENT_STATUS_PROCESSED
from app.domain.errors import FileTooLargeError, UnsupportedFileTypeError
from app.domain.instrument_types import classify_instrument
from app.models.account import Account
from app.models.document import Document
from app.models.holding import Holding
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.providers.object_storage import ObjectStorageProvider
from app.services.documents.hashing import sha256_hex
from app.services.portfolio_import.csv_parser import (
    CsvParseError,
    extract_account_number_from_filename,
    parse_broker_csv,
)

CSV_EXTENSION = ".csv"
CSV_DOCUMENT_TYPE = "portfolio_export"
SNAPSHOT_STATUS_PROCESSED = "processed"

_WEIGHT_QUANTIZE = Decimal("0.0001")  # matches portfolio_positions.weight_pct Numeric(9, 4)
_COST_QUANTIZE = Decimal("0.000001")  # matches portfolio_positions.cost_basis Numeric(20, 6)


@dataclass
class PortfolioImportResult:
    document: Document
    account: Account
    snapshot: PortfolioSnapshot
    holdings_created: int
    holdings_matched: int
    was_duplicate_file: bool


def _slugify_ticker(name: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "-", name).strip("-").upper()
    return slug[:250] or "HOLDING"


def _find_or_create_account(db: Session, *, account_number: str, name_hint: str | None) -> Account:
    account = db.query(Account).filter(Account.account_number == account_number).one_or_none()
    if account is not None:
        return account
    account = Account(name=name_hint or f"Account {account_number}", account_number=account_number)
    db.add(account)
    db.flush()
    return account


def _find_or_create_holding(db: Session, *, name: str, currency: str) -> tuple[Holding, bool]:
    """Returns (holding, was_created).

    Dedup key is a ticker slugified from the security name — the only
    stable identifier these exports give us (no ISIN/ticker column) — so
    "Alfred Berg Nordic High Yield II R (NOK)" appearing in two different
    accounts' exports resolves to the same Holding both times.
    """
    ticker = _slugify_ticker(name)
    holding = db.query(Holding).filter(Holding.ticker == ticker).one_or_none()
    if holding is not None:
        return holding, False
    holding = Holding(
        ticker=ticker,
        name=name,
        trading_currency=currency,
        asset_class_raw=classify_instrument(name),
    )
    db.add(holding)
    db.flush()
    return holding, True


def import_portfolio_csv(
    db: Session,
    storage: ObjectStorageProvider,
    *,
    filename: str,
    content: bytes,
    account_number: str | None = None,
    account_name: str | None = None,
) -> PortfolioImportResult:
    if not filename.lower().endswith(CSV_EXTENSION):
        raise UnsupportedFileTypeError(filename, (CSV_EXTENSION,))

    settings = get_settings()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise FileTooLargeError(filename, len(content), max_bytes)

    resolved_account_number = account_number or extract_account_number_from_filename(filename)
    if not resolved_account_number:
        raise CsvParseError(
            filename,
            "no account_number given and none found in the filename "
            "(expected a pattern like '...kontono._12345678_...')",
        )

    # Parse before touching storage/DB — an unparseable file should fail
    # with nothing written, not leave an orphaned Document behind.
    positions = parse_broker_csv(content, filename)

    digest = sha256_hex(content)
    document = db.query(Document).filter(Document.sha256 == digest).one_or_none()
    was_duplicate = document is not None
    if document is None:
        storage_key = f"{digest}/{filename}"
        storage_path = storage.store(storage_key, content)
        document = Document(
            holding_id=None,
            type=CSV_DOCUMENT_TYPE,
            original_filename=filename,
            mime_type="text/csv",
            size_bytes=len(content),
            storage_path=storage_path,
            reporting_period=None,
            sha256=digest,
            status=DOCUMENT_STATUS_PROCESSED,
            quality_flags={},
        )
        db.add(document)
        db.flush()

    account = _find_or_create_account(
        db, account_number=resolved_account_number, name_hint=account_name
    )

    total_value_nok = sum((p.value_nok for p in positions), Decimal(0))

    snapshot = PortfolioSnapshot(
        source_file_id=document.id,
        reporting_currency="NOK",
        status=SNAPSHOT_STATUS_PROCESSED,
        account_id=account.id,
    )
    db.add(snapshot)
    db.flush()

    holdings_created = 0
    holdings_matched = 0
    for p in positions:
        holding, created = _find_or_create_holding(db, name=p.name, currency=p.currency)
        holdings_created += 1 if created else 0
        holdings_matched += 0 if created else 1

        weight_pct = (
            (p.value_nok / total_value_nok * 100).quantize(_WEIGHT_QUANTIZE)
            if total_value_nok
            else None
        )
        cost_basis = (p.avg_cost * p.quantity).quantize(_COST_QUANTIZE)

        db.add(
            PortfolioPosition(
                snapshot_id=snapshot.id,
                holding_id=holding.id,
                weight_pct=weight_pct,
                quantity=p.quantity,
                cost_basis=cost_basis,
                cost_basis_currency=p.currency,
                account_id=account.id,
            )
        )

    db.commit()
    db.refresh(snapshot)
    return PortfolioImportResult(
        document=document,
        account=account,
        snapshot=snapshot,
        holdings_created=holdings_created,
        holdings_matched=holdings_matched,
        was_duplicate_file=was_duplicate,
    )
