"""
Manual single-lot holding entry (architecture §26 Phase 8, ADR 0011).

Every existing way to get a holding into the system is a bulk CSV/XLSX
upload (app.services.portfolio.ingestion) tied to a periodic brokerage
export. That's the wrong shape for "I bought one gold coin today" or "I
added a bottle to my whisky collection" — a one-off, hand-entered lot with
its own purchase date and price. This module is the alternative entry path
ADR 0011 designs for exactly that, scoped to AssetClass.COMMODITY and
AssetClass.COLLECTIBLE so it never competes with the CSV/XLSX path for
ordinary brokerage holdings.

Every manual entry lands in one persistent "manual entries" PortfolioSnapshot
(created lazily, reused thereafter) rather than a fresh snapshot per entry.
This deliberately does NOT go through app.services.portfolio.ingestion's
merge-by-(account, ticker) logic: a second lot of the same ticker is simply
inserted as an additional PortfolioPosition row, so two purchases of the
same coin at different dates/prices stay two distinct, individually-priced
positions (ADR 0011) instead of one colliding on ticker the way a bare
`{ticker: ...}` dict would. app.services.market_data.valuation already
groups by ticker when summing market value for concentration (see
_build_concentration's single_name_values), so multiple lots of the same
ticker value and roll up correctly with no further changes needed there.

Known gap (documented, not fixed here — see docs/architecture "Known gaps"
in docs/PROGRESS.md): if a brokerage CSV/XLSX is uploaded *after* two or
more manual lots of the same ticker exist, app.services.portfolio.ingestion's
own carry-forward step (keyed by (account_id, ticker), one entry per key)
will collapse those lots down to one when building the next snapshot. This
only affects re-uploading a CSV after holding multiple lots of literally the
same manually-entered ticker — a normal brokerage export never mentions a
commodity/collectible ticker at all, so this doesn't disturb the common
case. A full fix would make the CSV merge key lot-aware system-wide, which
is a larger cross-cutting change deferred until it's actually needed.
"""

import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.domain.asset_class import AssetClass
from app.models.account import Account
from app.models.document import Document, DocumentStatus, DocumentType
from app.models.holding import Holding
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot, SnapshotStatus

# Only these two asset classes may be entered by hand — every other asset
# class has a real bulk-upload path (canonical CSV/XLSX or Nordnet export)
# and should keep using it, so there is exactly one entry path per kind of
# holding rather than two that could silently disagree.
MANUAL_ENTRY_ASSET_CLASSES = frozenset({AssetClass.COMMODITY.value, AssetClass.COLLECTIBLE.value})

# Sentinel Document standing in for "source file" on the manual-entries
# snapshot (PortfolioSnapshot.source_file_id is NOT NULL, matching the "every
# snapshot traces to a real Document" invariant everywhere else — see
# app.models.document's module docstring). Content is deliberately empty;
# this Document is never actually stored/retrieved as a file. A fixed sha256
# means at most one such row ever exists (the column is unique).
_MANUAL_ENTRY_DOCUMENT_FILENAME = "manual-entry-log"
_MANUAL_ENTRY_SENTINEL_SHA256 = hashlib.sha256(b"aladdin-manual-entry-log-v1").hexdigest()


class ManualEntryValidationError(ValueError):
    """Raised for a manual-entry request the caller must fix — an
    unsupported asset_class, an unknown account_id, or similar (§21: fail
    visibly with a specific reason, not a generic 500)."""


@dataclass
class ManualEntryResult:
    position: PortfolioPosition
    holding: Holding
    was_new_holding: bool


def _get_or_create_manual_snapshot(db: Session) -> PortfolioSnapshot:
    document = (
        db.query(Document).filter(Document.sha256 == _MANUAL_ENTRY_SENTINEL_SHA256).one_or_none()
    )
    if document is None:
        document = Document(
            holding_id=None,
            type=DocumentType.OTHER.value,
            original_filename=_MANUAL_ENTRY_DOCUMENT_FILENAME,
            mime_type="application/x-aladdin-manual-entry",
            size_bytes=0,
            storage_path="",
            sha256=_MANUAL_ENTRY_SENTINEL_SHA256,
            status=DocumentStatus.VALIDATED.value,
            quality_flags=[],
        )
        db.add(document)
        db.flush()

    snapshot = (
        db.query(PortfolioSnapshot)
        .filter(PortfolioSnapshot.source_file_id == document.id)
        .one_or_none()
    )
    if snapshot is None:
        settings = get_settings()
        snapshot = PortfolioSnapshot(
            source_file_id=document.id,
            reporting_currency=settings.default_reporting_currency,
            status=SnapshotStatus.VALIDATED.value,
            account_id=None,
        )
        db.add(snapshot)
        db.flush()
    return snapshot


def add_manual_position(
    db: Session,
    *,
    ticker: str,
    name: str,
    asset_class: str,
    trading_currency: str,
    quantity: Decimal,
    cost_basis: Decimal | None,
    cost_basis_currency: str | None,
    market_ticker: str | None,
    custody_type: str | None,
    acquired_at: datetime | None,
    notes: str | None,
    account_id: UUID | None,
) -> ManualEntryResult:
    if asset_class not in MANUAL_ENTRY_ASSET_CLASSES:
        raise ManualEntryValidationError(
            f"asset_class '{asset_class}' is not supported for manual entry — "
            f"must be one of {sorted(MANUAL_ENTRY_ASSET_CLASSES)}; an ordinary "
            "brokerage holding goes through POST /portfolio/upload instead"
        )

    ticker = ticker.strip()
    name = name.strip()
    trading_currency = trading_currency.strip().upper()
    if not ticker or not name:
        raise ManualEntryValidationError("ticker and name are required")
    if len(trading_currency) != 3 or not trading_currency.isalpha():
        raise ManualEntryValidationError(f"trading_currency '{trading_currency}' is not a 3-letter ISO code")

    if account_id is not None and db.get(Account, account_id) is None:
        raise ManualEntryValidationError(f"account '{account_id}' not found")

    market_ticker = (market_ticker or "").strip().upper() or None
    custody_type = (custody_type or "").strip() or None
    notes = (notes or "").strip() or None
    cost_basis_currency = (cost_basis_currency or "").strip().upper() or None

    holding = db.query(Holding).filter(Holding.ticker == ticker).one_or_none()
    was_new_holding = holding is None
    if holding is None:
        holding = Holding(
            ticker=ticker,
            name=name,
            asset_class=asset_class,
            asset_class_raw=asset_class,
            sector=None,
            trading_currency=trading_currency,
            market_ticker=market_ticker,
            custody_type=custody_type,
        )
        db.add(holding)
        db.flush()
    else:
        # An existing holding (an earlier lot of the same ticker) is the
        # source of truth for its own descriptive fields — this call only
        # adds a new lot under it, never silently rewrites what it already
        # is. Only fill in a market_ticker/custody_type the holding doesn't
        # have yet, same convention as app.services.portfolio.ingestion.
        if holding.market_ticker is None and market_ticker is not None:
            holding.market_ticker = market_ticker
        if holding.custody_type is None and custody_type is not None:
            holding.custody_type = custody_type

    snapshot = _get_or_create_manual_snapshot(db)

    position = PortfolioPosition(
        snapshot_id=snapshot.id,
        holding_id=holding.id,
        account_id=account_id,
        weight_pct=None,
        quantity=quantity,
        cost_basis=cost_basis,
        cost_basis_currency=cost_basis_currency or (trading_currency if cost_basis is not None else None),
        notes=notes,
        acquired_at=acquired_at or datetime.now(timezone.utc),
    )
    db.add(position)
    db.commit()
    db.refresh(position)
    db.refresh(holding)

    return ManualEntryResult(position=position, holding=holding, was_new_holding=was_new_holding)
