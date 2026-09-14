"""
Portfolio upload orchestration (architecture §26 Phase 1): validate, store the
source file as a Document, upsert Holdings, and persist a PortfolioSnapshot +
PortfolioPositions. No AI dependency — this is pure deterministic ingestion.

Uploads are additive, not replace-in-full: each new upload is merged on top
of the most recent snapshot (matched by (account, ticker)) rather than
starting from a blank portfolio, so uploading one broker's export and then
another's builds one combined "current" portfolio instead of two disconnected
ones. A ticker present in the new file for the *same account* always wins
(its row fully replaces the prior one); everything else is carried forward
unchanged. This means a sold-out position has to be cleared with a full reset
(see app.services.portfolio.reset) or a fresh upload for that account that
still lists it at zero — there's no "remove just this one" upload action yet.

The merge key is (account_id, ticker), not ticker alone. Faiz's holdings span
several accounts (Aksje & fonds konto, ASK, EPK Aktiv/Passiv, ...), and the
same instrument can legitimately sit in more than one of them at once (e.g.
"Salmon Evolution" held in both an ASK and Ezra's ASK) — merging by ticker
alone would silently collapse those into a single row and lose one account's
position outright the moment the other account's file was uploaded next.
"""

from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.domain.errors import PortfolioValidationError, UnsupportedFileTypeError
from app.models.document import DocumentType
from app.models.holding import Holding
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot, SnapshotStatus
from app.providers.base import ObjectStorageProvider
from app.services.documents.hashing import PORTFOLIO_EXTENSIONS, extension_of
from app.services.documents.ingestion import intake_raw_file
from app.services.portfolio.parser import ParsedPosition, parse_and_validate

# Same tolerance the parser applies to a single file's own weights (§7) —
# reused here for the post-merge, per-account sanity check.
_WEIGHT_SUM_TOLERANCE_PCT = Decimal("1.0")

# Key used to merge positions across uploads: (account_id, ticker). account_id
# may be None (an upload not tagged to any account), which is still a
# perfectly good, distinct bucket to merge within.
_MergeKey = tuple[UUID | None, str]


@dataclass
class PortfolioIngestResult:
    snapshot: PortfolioSnapshot
    warnings: list[str]
    was_duplicate_file: bool
    new_position_count: int
    updated_position_count: int
    carried_forward_position_count: int


@dataclass
class _MergedPosition:
    """A row in the merged position set — either carried forward unchanged
    from the previous snapshot, or freshly parsed from this upload."""

    ticker: str
    name: str
    asset_class: str  # canonical AssetClass value (already normalized)
    asset_class_raw: str
    currency: str
    quantity: Decimal | None
    weight_pct: Decimal | None
    cost_basis: Decimal | None
    sector: str | None
    notes: str | None
    market_ticker: str | None
    account_id: UUID | None
    carried_forward: bool


def _carried_forward_from(previous_snapshot: PortfolioSnapshot | None) -> dict[_MergeKey, _MergedPosition]:
    if previous_snapshot is None:
        return {}
    merged: dict[_MergeKey, _MergedPosition] = {}
    for position in previous_snapshot.positions:
        holding = position.holding
        merged[(position.account_id, holding.ticker)] = _MergedPosition(
            ticker=holding.ticker,
            name=holding.name,
            asset_class=holding.asset_class,
            asset_class_raw=holding.asset_class_raw,
            currency=holding.trading_currency,
            quantity=position.quantity,
            weight_pct=position.weight_pct,
            cost_basis=position.cost_basis,
            sector=holding.sector,
            notes=position.notes,
            market_ticker=holding.market_ticker,
            account_id=position.account_id,
            carried_forward=True,
        )
    return merged


def _from_parsed(position: ParsedPosition, account_id: UUID | None) -> _MergedPosition:
    return _MergedPosition(
        ticker=position.ticker,
        name=position.name,
        asset_class=position.asset_class.value,
        asset_class_raw=position.asset_class_raw,
        currency=position.currency,
        quantity=position.quantity,
        weight_pct=position.weight_pct,
        cost_basis=position.cost_basis,
        sector=position.sector,
        notes=position.notes,
        market_ticker=position.market_ticker,
        account_id=account_id,
        carried_forward=False,
    )


def _merge_positions(
    previous_snapshot: PortfolioSnapshot | None,
    new_positions: list[ParsedPosition],
    account_id: UUID | None,
) -> tuple[list[_MergedPosition], int, int]:
    """Merges this upload's positions on top of the previous snapshot's,
    keyed by (account_id, ticker) — see module docstring for why account is
    part of the key. Returns (merged, new_count, updated_count) — the
    carried-forward count is len(merged) - new_count - updated_count."""
    merged = _carried_forward_from(previous_snapshot)

    new_count = 0
    updated_count = 0
    for position in new_positions:
        key: _MergeKey = (account_id, position.ticker)
        if key in merged:
            updated_count += 1
        else:
            new_count += 1
        merged[key] = _from_parsed(position, account_id)

    return list(merged.values()), new_count, updated_count


def _merged_weight_sum_warning(positions: list[_MergedPosition]) -> list[str]:
    """Checks weights sum to ~100% *within each account* rather than across
    the whole merged set — accounts are independent portfolios, so summing
    every account's weights together would almost always (correctly) miss
    100% once more than one account is represented, which isn't a real
    problem worth warning about."""
    by_account: dict[UUID | None, list[_MergedPosition]] = {}
    for position in positions:
        by_account.setdefault(position.account_id, []).append(position)

    warnings: list[str] = []
    for account_id, account_positions in by_account.items():
        weights = [p.weight_pct for p in account_positions if p.weight_pct is not None]
        if not account_positions or len(weights) != len(account_positions):
            continue
        total = sum(weights)
        if abs(total - Decimal("100")) > _WEIGHT_SUM_TOLERANCE_PCT:
            label = "unassigned positions" if account_id is None else f"account {account_id}"
            warnings.append(
                f"merged weights for {label} sum to {total}%, expected ~100% "
                f"(tolerance ±{_WEIGHT_SUM_TOLERANCE_PCT}%) — carrying forward "
                "positions from a prior upload alongside a new file commonly "
                "does this if the new file's weights were computed against a "
                "different total; re-upload a full export to reset weights"
            )
    return warnings


def ingest_portfolio_upload(
    db: Session,
    storage: ObjectStorageProvider,
    *,
    filename: str,
    content: bytes,
    mime_type: str,
    reporting_currency: str,
    account_id: UUID | None = None,
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

    previous_snapshot = (
        db.query(PortfolioSnapshot).order_by(PortfolioSnapshot.uploaded_at.desc()).first()
    )
    merged_positions, new_count, updated_count = _merge_positions(
        previous_snapshot, parse_result.positions, account_id
    )
    carried_forward_count = len(merged_positions) - new_count - updated_count

    warnings = list(parse_result.warnings)
    if previous_snapshot is not None:
        warnings.append(
            f"merged with previous snapshot: {new_count} new, {updated_count} updated, "
            f"{carried_forward_count} carried forward unchanged"
        )
    warnings.extend(_merged_weight_sum_warning(merged_positions))

    snapshot = PortfolioSnapshot(
        source_file_id=intake.document.id,
        reporting_currency=reporting_currency,
        status=SnapshotStatus.PENDING.value,
        account_id=account_id,
    )
    db.add(snapshot)
    db.flush()

    for position in merged_positions:
        holding = db.query(Holding).filter(Holding.ticker == position.ticker).one_or_none()
        if holding is None:
            holding = Holding(
                ticker=position.ticker,
                name=position.name,
                asset_class=position.asset_class,
                asset_class_raw=position.asset_class_raw,
                sector=position.sector,
                trading_currency=position.currency,
                market_ticker=position.market_ticker,
            )
            db.add(holding)
            db.flush()
        elif not position.carried_forward:
            # The latest upload is the source of truth for descriptive fields
            # (name/sector/currency can legitimately change over time). A
            # carried-forward position leaves the holding exactly as it was.
            holding.name = position.name
            holding.asset_class = position.asset_class
            holding.asset_class_raw = position.asset_class_raw
            holding.sector = position.sector
            holding.trading_currency = position.currency
            # Only adopt an upload-provided market_ticker if the holding
            # doesn't already have one — a value set manually via
            # PATCH /portfolio/holdings/{id} (e.g. for a Nordnet holding
            # with no ticker in its own export) must survive a re-upload,
            # never get silently cleared back to None.
            if holding.market_ticker is None and position.market_ticker is not None:
                holding.market_ticker = position.market_ticker

        db.add(
            PortfolioPosition(
                snapshot_id=snapshot.id,
                holding_id=holding.id,
                account_id=position.account_id,
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
        snapshot=snapshot,
        warnings=warnings,
        was_duplicate_file=intake.was_duplicate,
        new_position_count=new_count,
        updated_position_count=updated_count,
        carried_forward_position_count=carried_forward_count,
    )
