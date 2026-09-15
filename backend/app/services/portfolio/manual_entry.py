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

Every manual add/edit carries forward the *current* snapshot (whichever
PortfolioSnapshot is most recent by `uploaded_at` — the same "current
portfolio" concept Dashboard.tsx and app.services.portfolio.ingestion both
use) into a brand-new snapshot, then applies just this one change on top —
the same "merge forward onto the latest snapshot" pattern ingestion.py uses
for brokerage uploads (see its module docstring). This module used to
instead keep one dedicated "manual entries" snapshot, created lazily and
reused forever, entirely separate from the brokerage-upload chain. That
made the Dashboard (which simply shows whichever snapshot is newest) go
blind to every brokerage-sourced holding — Securities dropping to 0 in
Portfolio composition — the moment any manual entry was added, since the
newest snapshot became the manual-only one and no longer carried Securities
positions at all. Carrying forward here keeps there being exactly one
ever-growing "current" snapshot, matching what Dashboard.tsx's own
docstring already promises ("uploads merge forward onto it... every
account's present holdings"). See the project doc "Securities missing from
Portfolio composition after a manual entry" for the full investigation.

Positions are cloned 1:1 on carry-forward (not merged by ticker the way
ingestion.py's brokerage merge does) so multiple manual lots of the same
ticker are preserved exactly as they were — a second lot of the same coin
ticker is simply inserted as an additional PortfolioPosition row, so two
purchases of the same coin at different dates/prices stay two distinct,
individually-priced positions (ADR 0011) instead of colliding. Both
brokerage-sourced and manually-entered positions carry forward identically;
app.services.market_data.valuation already groups by ticker when summing
market value for concentration (see _build_concentration's
single_name_values), so multiple lots of the same ticker value and roll up
correctly with no further changes needed there.

Known gap (documented, not fixed here — see docs/architecture "Known gaps"
in docs/PROGRESS.md): a brokerage CSV/XLSX upload merges by (account_id,
ticker) — see app.services.portfolio.ingestion's module docstring — which
is ticker-keyed, not lot-keyed. If two or more manual lots of literally the
same ticker exist when a brokerage file is next uploaded, that merge step
will still collapse them down to one. This only affects re-uploading a CSV
after holding multiple lots of the same manually-entered ticker — a normal
brokerage export never mentions a commodity/collectible ticker at all, so
this doesn't disturb the common case. A full fix would make the CSV merge
key lot-aware system-wide, which is a larger cross-cutting change deferred
until it's actually needed.
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

# Sentinel Document standing in for "source file" on every snapshot a manual
# add/edit creates (PortfolioSnapshot.source_file_id is NOT NULL, matching
# the "every snapshot traces to a real Document" invariant everywhere else —
# see app.models.document's module docstring). Content is deliberately
# empty; this Document is never actually stored/retrieved as a file. Reused
# across every manual-entry snapshot (source_file_id isn't unique on the
# model, so more than one snapshot pointing at it is fine) — a fixed sha256
# means at most one such Document row ever exists.
_MANUAL_ENTRY_DOCUMENT_FILENAME = "manual-entry-log"
_MANUAL_ENTRY_SENTINEL_SHA256 = hashlib.sha256(b"aladdin-manual-entry-log-v1").hexdigest()


class ManualEntryValidationError(ValueError):
    """Raised for a manual-entry request the caller must fix — an
    unsupported asset_class, an unknown account_id, or similar (§21: fail
    visibly with a specific reason, not a generic 500)."""


class ManualEntryNotFoundError(ValueError):
    """Raised by update_manual_position when holding_id isn't a manually-
    entered holding at all (never existed, or is an ordinary brokerage
    holding) — a 404, distinct from ManualEntryValidationError's 422."""


@dataclass
class ManualEntryResult:
    position: PortfolioPosition
    holding: Holding
    was_new_holding: bool


def _latest_snapshot(db: Session) -> PortfolioSnapshot | None:
    """The current "whole portfolio" snapshot — whichever is most recent by
    upload time, brokerage-sourced or manual-entry-sourced alike. Same query
    app.services.portfolio.ingestion uses to find what to carry forward
    onto; kept in sync deliberately so both entry paths agree on what
    "current" means."""
    return db.query(PortfolioSnapshot).order_by(PortfolioSnapshot.uploaded_at.desc()).first()


def _manual_entry_document(db: Session) -> Document:
    document = db.query(Document).filter(Document.sha256 == _MANUAL_ENTRY_SENTINEL_SHA256).one_or_none()
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
    return document


def _new_snapshot_carrying_forward(
    db: Session, previous: PortfolioSnapshot | None
) -> tuple[PortfolioSnapshot, list[PortfolioPosition]]:
    """Creates a new snapshot that carries forward every position from
    `previous` unchanged, cloned as new PortfolioPosition rows — the same
    "merge forward onto the latest snapshot" idea
    app.services.portfolio.ingestion uses for brokerage uploads (see module
    docstring), so a manual entry/edit stays part of the one ever-growing
    "current" portfolio the Dashboard shows (the latest snapshot) instead of
    forking off into an isolated island. Unlike ingestion's brokerage merge,
    positions are cloned 1:1 rather than merged by (account, ticker), so
    multiple manual lots of the same ticker are preserved exactly as they
    were. Returns the new snapshot plus the freshly-cloned positions (so a
    caller can find and mutate one of them before committing, for an edit)."""
    document = _manual_entry_document(db)
    settings = get_settings()
    snapshot = PortfolioSnapshot(
        source_file_id=document.id,
        reporting_currency=(previous.reporting_currency if previous is not None else settings.default_reporting_currency),
        status=SnapshotStatus.VALIDATED.value,
        account_id=None,
    )
    db.add(snapshot)
    db.flush()

    cloned: list[PortfolioPosition] = []
    if previous is not None:
        for position in previous.positions:
            clone = PortfolioPosition(
                snapshot_id=snapshot.id,
                holding_id=position.holding_id,
                account_id=position.account_id,
                weight_pct=position.weight_pct,
                quantity=position.quantity,
                cost_basis=position.cost_basis,
                cost_basis_currency=position.cost_basis_currency,
                notes=position.notes,
                acquired_at=position.acquired_at,
            )
            db.add(clone)
            cloned.append(clone)
    return snapshot, cloned


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

    previous_snapshot = _latest_snapshot(db)
    snapshot, _carried_forward = _new_snapshot_carrying_forward(db, previous_snapshot)

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


def list_manual_positions(db: Session) -> list[PortfolioPosition]:
    """Every manually-entered lot in the *current* portfolio, newest-acquired
    first — backs `GET /portfolio/holdings/manual` (the Portfolio tab's
    "Your manual entries" table), which exists so a mistake made at entry
    time (the classic one: "Holding currency" changed to NOK but "Buy price
    currency" left at its default) can actually be seen and corrected, not
    just avoided going forward. "Current" here is the same latest-snapshot
    definition every other read of the portfolio uses — a manual lot that
    was since dropped by a brokerage re-upload no longer shows up here,
    matching what the rest of the app would show for it too."""
    snapshot = _latest_snapshot(db)
    if snapshot is None:
        return []
    positions = [p for p in snapshot.positions if p.holding.asset_class in MANUAL_ENTRY_ASSET_CLASSES]
    return sorted(
        positions,
        key=lambda p: p.acquired_at or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )


def update_manual_position(
    db: Session,
    *,
    holding_id: UUID,
    **fields,
) -> ManualEntryResult:
    """Corrects a manually-entered coin/collectible after the fact. Faiz's
    real case: the "Holding currency" field was changed to NOK for a coin
    (so the dashboard reports it in NOK) but the separate "Buy price
    currency" field was left at its default — the NOK amount he actually
    paid then got stored (and FX-converted) as if it were that other
    currency, producing a cost basis many times too large and an
    Unrealized P&L wildly out of proportion to the holding's real value.
    There was previously no way to fix this short of deleting all portfolio
    data — this is a targeted correction, not a new entry.

    Only keys present in `fields` are applied (the caller passes
    `ManualPositionUpdate.model_dump(exclude_unset=True)` — §21 partial
    update, not "every field must be resupplied"). Scoped to a holding with
    exactly one manual lot *in the current snapshot*: a multi-lot manual
    holding (two purchases of the same coin at different times) is
    ambiguous about which lot to correct, so it's rejected rather than
    guessed — add a new entry instead, or ask for per-lot editing if this
    ever becomes a real need.
    """
    holding = db.get(Holding, holding_id)
    if holding is None or holding.asset_class not in MANUAL_ENTRY_ASSET_CLASSES:
        raise ManualEntryNotFoundError(f"no manually-entered holding '{holding_id}' found")

    previous_snapshot = _latest_snapshot(db)
    existing = [p for p in (previous_snapshot.positions if previous_snapshot is not None else []) if p.holding_id == holding_id]
    if len(existing) != 1:
        raise ManualEntryValidationError(
            f"holding '{holding_id}' has {len(existing)} manual lot(s) in the current portfolio — "
            "editing is only supported for a holding with exactly one lot; add a separate new entry "
            "instead of trying to edit an ambiguous multi-lot holding"
        )

    _snapshot, carried_forward = _new_snapshot_carrying_forward(db, previous_snapshot)
    position = next(p for p in carried_forward if p.holding_id == holding_id)

    if fields.get("name") is not None:
        holding.name = fields["name"].strip()
    if fields.get("trading_currency") is not None:
        trading_currency = fields["trading_currency"].strip().upper()
        if len(trading_currency) != 3 or not trading_currency.isalpha():
            raise ManualEntryValidationError(
                f"trading_currency '{trading_currency}' is not a 3-letter ISO code"
            )
        holding.trading_currency = trading_currency
    if "market_ticker" in fields:
        holding.market_ticker = (fields["market_ticker"] or "").strip().upper() or None
    if "custody_type" in fields:
        holding.custody_type = (fields["custody_type"] or "").strip() or None

    if fields.get("quantity") is not None:
        position.quantity = fields["quantity"]
    if "cost_basis" in fields:
        position.cost_basis = fields["cost_basis"]
    if "cost_basis_currency" in fields:
        cost_basis_currency = (fields["cost_basis_currency"] or "").strip().upper() or None
        if cost_basis_currency is not None and (
            len(cost_basis_currency) != 3 or not cost_basis_currency.isalpha()
        ):
            raise ManualEntryValidationError(
                f"cost_basis_currency '{cost_basis_currency}' is not a 3-letter ISO code"
            )
        position.cost_basis_currency = cost_basis_currency
    if "notes" in fields:
        position.notes = (fields["notes"] or "").strip() or None
    if fields.get("acquired_at") is not None:
        position.acquired_at = fields["acquired_at"]
    if "account_id" in fields:
        account_id = fields["account_id"]
        if account_id is not None and db.get(Account, account_id) is None:
            raise ManualEntryValidationError(f"account '{account_id}' not found")
        position.account_id = account_id

    # Same fallback add_manual_position applies: cost_basis with no explicit
    # cost_basis_currency defaults to the (possibly just-corrected) holding
    # currency, rather than leaving it None — a set cost_basis with no
    # currency to interpret it in would make the next valuation treat this
    # holding as unpriceable-at-cost, silently undoing the correction.
    if position.cost_basis is not None and position.cost_basis_currency is None:
        position.cost_basis_currency = holding.trading_currency

    db.commit()
    db.refresh(position)
    db.refresh(holding)
    return ManualEntryResult(position=position, holding=holding, was_new_holding=False)
