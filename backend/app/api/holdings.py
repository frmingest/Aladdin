"""Holding CRUD endpoints — Sprint 1's "Minimal API" deliverable.

Closes the gap flagged after document ingestion shipped: a document could
only be attached to a `holding_id` that already existed in the DB, created
directly (not through the app). This router is how a holding gets created
in the first place.

Deletion is destructive (CLAUDE.md "Destructive operations"): every delete
requires `confirm=true`. A plain holding delete is refused while documents,
positions or extracted facts point at it. Since 2026-09-23 (Faiz's ask:
make a real clean slate possible) `cascade=true` removes the holding with
its documents, facts, analyses, notes, prices and research in one go;
`DELETE /holdings/{id}/documents` does the same but keeps the holding; and
`DELETE /holdings/all` wipes every holding once the portfolio is empty.
Portfolio positions are never cascade-deleted from here — see
app/services/deletion.py.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.domain.instrument_types import INSTRUMENT_TYPES, classify_instrument
from app.domain.sectors import SECTORS
from app.models.document import Document
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.models.portfolio import PortfolioPosition
from app.providers.base import MarketDataProvider
from app.providers.factory import get_market_data_provider_or_none, get_object_storage
from app.schemas.document import DeletionResult
from app.schemas.holding import (
    HoldingCreate,
    HoldingFieldOptions,
    HoldingOut,
    HoldingUpdate,
)
from app.schemas.metrics import (
    HoldingMetricsOut,
    MarketContextOut,
    MetricFactOut,
    ShareCountIn,
    ShareCountOut,
)
from app.services.deletion import (
    DeletionBlockedError,
    DeletionCounts,
    detach_holding_rows,
    purge_holding,
    wipe_all_holdings,
)
from app.services.holding_facts import facts_by_period, latest_period, previous_period
from app.services.market_data.shares import (
    ShareCountResult,
    add_manual_share_count,
    clear_manual_share_counts,
    resolve_share_count,
)
from app.services.market_inputs import MarketContext, build_market_context
from app.services.metrics import compute_holding_metrics

router = APIRouter(prefix="/holdings", tags=["holdings"])


def _to_out(db: Session, holding: Holding) -> HoldingOut:
    return _to_out_many(db, [holding])[0]


def _to_out_many(db: Session, holdings: list[Holding]) -> list[HoldingOut]:
    """Batches the document/position counts for every holding into two
    aggregate queries total, not two queries per holding — the page-load-
    speed fix (2026-09-21). `list_holdings` returns every row in the
    `holdings` table, including the legacy pre-reset ones (individual
    whisky/precious-metals entries — see CLAUDE.md), so on the real DB this
    was previously 2N+1 round trips to Postgres for a page load; now it's
    3 regardless of N.
    """
    if not holdings:
        return []

    ids = [h.id for h in holdings]
    document_counts = dict(
        db.execute(
            select(Document.holding_id, func.count())
            .where(Document.holding_id.in_(ids))
            .group_by(Document.holding_id)
        ).all()
    )
    position_counts = dict(
        db.execute(
            select(PortfolioPosition.holding_id, func.count())
            .where(PortfolioPosition.holding_id.in_(ids))
            .group_by(PortfolioPosition.holding_id)
        ).all()
    )

    return [
        HoldingOut(
            id=h.id,
            ticker=h.ticker,
            name=h.name,
            sector=h.sector,
            trading_currency=h.trading_currency,
            institution=h.institution,
            custody_type=h.custody_type,
            asset_class_raw=h.asset_class_raw,
            created_at=h.created_at,
            updated_at=h.updated_at,
            document_count=document_counts.get(h.id, 0),
            position_count=position_counts.get(h.id, 0),
        )
        for h in holdings
    ]


@router.post("", response_model=HoldingOut, status_code=201)
def create_holding(payload: HoldingCreate, db: Session = Depends(get_db)) -> HoldingOut:
    existing = db.scalar(select(Holding).where(Holding.ticker == payload.ticker))
    if existing is not None:
        raise HTTPException(
            status_code=409, detail=f"a holding with ticker '{payload.ticker}' already exists"
        )

    holding = Holding(
        ticker=payload.ticker,
        name=payload.name,
        trading_currency=payload.trading_currency.upper(),
        sector=payload.sector,
        institution=payload.institution,
        custody_type=payload.custody_type,
        asset_class_raw=payload.asset_class_raw or classify_instrument(payload.name),
    )
    db.add(holding)
    db.commit()
    db.refresh(holding)
    return _to_out(db, holding)


@router.get("", response_model=list[HoldingOut])
def list_holdings(db: Session = Depends(get_db)) -> list[HoldingOut]:
    holdings = db.scalars(select(Holding).order_by(Holding.ticker)).all()
    return _to_out_many(db, list(holdings))


@router.get("/field-options", response_model=HoldingFieldOptions)
def get_field_options() -> HoldingFieldOptions:
    """Backs the frontend's Sector / Instrument Type dropdowns in the
    manual-edit UI (Faiz's request, 2026-09-21) — single source of truth
    so those dropdowns can never offer a value `update_holding` would then
    reject. Must stay registered before `GET /{holding_id}` below, or
    FastAPI will try to parse "field-options" as a holding UUID.
    """
    return HoldingFieldOptions(sectors=list(SECTORS), instrument_types=list(INSTRUMENT_TYPES))


@router.get("/{holding_id}", response_model=HoldingOut)
def get_holding(holding_id: UUID, db: Session = Depends(get_db)) -> HoldingOut:
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")
    return _to_out(db, holding)


@router.patch("/{holding_id}", response_model=HoldingOut)
def update_holding(
    holding_id: UUID, payload: HoldingUpdate, db: Session = Depends(get_db)
) -> HoldingOut:
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")

    updates = payload.model_dump(exclude_unset=True)
    if "trading_currency" in updates and updates["trading_currency"] is not None:
        updates["trading_currency"] = updates["trading_currency"].upper()

    # ticker is now editable (see HoldingUpdate's docstring) but the column
    # is still UNIQUE NOT NULL — check-then-set here, same shape as
    # create_holding's own check, rather than letting a collision fall
    # through to a raw IntegrityError 500.
    if "ticker" in updates and updates["ticker"] != holding.ticker:
        new_ticker = updates["ticker"]
        collision = db.scalar(
            select(Holding).where(Holding.ticker == new_ticker, Holding.id != holding_id)
        )
        if collision is not None:
            raise HTTPException(
                status_code=409, detail=f"a holding with ticker '{new_ticker}' already exists"
            )

    for field, value in updates.items():
        setattr(holding, field, value)

    try:
        db.commit()
    except IntegrityError as exc:  # belt-and-braces — the check above should catch this first
        db.rollback()
        raise HTTPException(
            status_code=409, detail="cannot update holding: ticker already in use"
        ) from exc
    db.refresh(holding)
    return _to_out(db, holding)


@router.delete("/all", response_model=DeletionResult)
def delete_all_holdings(
    confirm: bool = False,
    db: Session = Depends(get_db),
    storage=Depends(get_object_storage),
) -> DeletionResult:
    """Clean slate for holdings — added 2026-09-23 at Faiz's request (the
    2026-09-21 portfolio wipe deliberately left holdings and documents
    alone). Deletes every holding with all its documents (+ stored files),
    facts, analysis runs, notes, price observations and company research,
    plus any document not tied to a holding. Refused (409) while portfolio
    snapshots exist: wipe the portfolio first, so each destructive step
    stays explicit. Destructive (CLAUDE.md): `confirm=true` required."""
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="wiping all holdings and documents is destructive — pass confirm=true to proceed",
        )
    try:
        counts = wipe_all_holdings(db, storage)
    except DeletionBlockedError as exc:
        raise HTTPException(status_code=409, detail=f"cannot wipe holdings: {exc}") from exc
    return DeletionResult(**vars(counts))


@router.delete("/{holding_id}/documents", response_model=DeletionResult)
def delete_holding_documents(
    holding_id: UUID,
    confirm: bool = False,
    db: Session = Depends(get_db),
    storage=Depends(get_object_storage),
) -> DeletionResult:
    """Deletes everything uploaded, imported or generated for one holding —
    documents (+ stored files), extracted facts (incl. SEC EDGAR imports),
    analysis runs, notes, price observations and company research — but
    keeps the holding itself and its portfolio positions. Destructive
    (CLAUDE.md): `confirm=true` required."""
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="deleting a holding's documents and data is destructive — pass confirm=true to proceed",
        )
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")
    try:
        counts = purge_holding(db, storage, holding, keep_holding=True)
    except DeletionBlockedError as exc:
        raise HTTPException(status_code=409, detail=f"cannot delete: {exc}") from exc
    return DeletionResult(**vars(counts))


@router.delete("/{holding_id}", status_code=204, response_model=None)
def delete_holding(
    holding_id: UUID,
    confirm: bool = False,
    cascade: bool = False,
    db: Session = Depends(get_db),
    storage=Depends(get_object_storage),
) -> None:
    """Without `cascade`: refused while anything references the holding.
    With `cascade=true`: its documents, facts, analyses, notes, prices and
    research go too (still refused while it's in a portfolio snapshot)."""
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="deleting a holding is destructive — pass confirm=true to proceed",
        )

    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")

    if cascade:
        try:
            purge_holding(db, storage, holding, keep_holding=False)
        except DeletionBlockedError as exc:
            raise HTTPException(status_code=409, detail=f"cannot delete holding: {exc}") from exc
        return

    blockers = []
    document_count = db.scalar(
        select(func.count()).select_from(Document).where(Document.holding_id == holding_id)
    )
    if document_count:
        blockers.append(f"{document_count} document(s)")
    position_count = db.scalar(
        select(func.count())
        .select_from(PortfolioPosition)
        .where(PortfolioPosition.holding_id == holding_id)
    )
    if position_count:
        blockers.append(f"{position_count} portfolio position(s)")
    fact_count = db.scalar(
        select(func.count())
        .select_from(FinancialLineItem)
        .where(FinancialLineItem.holding_id == holding_id)
    )
    if fact_count:
        blockers.append(f"{fact_count} extracted fact(s)")

    if blockers:
        raise HTTPException(
            status_code=409,
            detail=(
                f"cannot delete holding '{holding.ticker}': still referenced by "
                f"{', '.join(blockers)}. Delete those first."
            ),
        )

    try:
        # A watchlist entry goes with the holding; journal entries are kept
        # and unlinked (app/services/deletion.py).
        detach_holding_rows(db, [holding.id], DeletionCounts())
        db.delete(holding)
        db.commit()
    except IntegrityError as exc:  # belt-and-braces — the checks above should catch this first
        db.rollback()
        raise HTTPException(
            status_code=409, detail="cannot delete holding: still referenced elsewhere"
        ) from exc


@router.get("/{holding_id}/periods", response_model=list[str])
def list_holding_periods(holding_id: UUID, db: Session = Depends(get_db)) -> list[str]:
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")

    periods = db.scalars(
        select(FinancialLineItem.period)
        .where(FinancialLineItem.holding_id == holding_id)
        .distinct()
        .order_by(FinancialLineItem.period)
    ).all()
    return list(periods)


def _share_count_out(result: ShareCountResult) -> ShareCountOut:
    low, high = result.eps_implied_range or (None, None)
    return ShareCountOut(
        shares=result.shares,
        source=result.source,
        source_label=result.source_label or None,
        as_of=result.as_of,
        reference=result.reference,
        note=result.note,
        override_id=result.override_id,
        eps_implied_low=low,
        eps_implied_high=high,
        warnings=result.warnings,
        unavailable_reason=result.unavailable_reason,
    )


def _market_out(context: MarketContext, *, stale_period: bool) -> MarketContextOut:
    return MarketContextOut(
        price=context.price,
        price_currency=context.price_currency,
        price_as_of=context.price_as_of,
        fx_rate=context.fx_rate,
        price_in_reporting_currency=context.price_in_reporting_currency,
        reporting_currency=context.reporting_currency,
        shares=_share_count_out(context.shares),
        unavailable_reason=context.unavailable_reason,
        stale_period=stale_period,
    )


@router.get("/{holding_id}/metrics", response_model=HoldingMetricsOut)
def get_holding_metrics(
    holding_id: UUID,
    period: str,
    db: Session = Depends(get_db),
    market_data_provider: MarketDataProvider | None = Depends(get_market_data_provider_or_none),
) -> HoldingMetricsOut:
    """Deterministic ratios computed from this holding's extracted filing
    facts for one period — CLAUDE.md Rule 1, never LLM arithmetic. See
    app/services/metrics.py. ROE / ROIC / ROCE average this and the prior
    year when the prior year is on file; the market multiples use today's
    price (converted to the filing's currency) and the current share count
    (app/services/market_data/shares.py), and are skipped with the reason
    when either is missing.
    """
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")

    line_items = db.scalars(
        select(FinancialLineItem).where(
            FinancialLineItem.holding_id == holding_id, FinancialLineItem.period == period
        )
    ).all()
    if not line_items:
        raise HTTPException(
            status_code=404,
            detail=f"no extracted facts for holding '{holding.ticker}' in period '{period}'",
        )

    facts = {item.metric: item.value for item in line_items}
    currencies = {item.metric: item.currency for item in line_items}
    periods = facts_by_period(db, holding_id)
    prior = previous_period(periods, period)
    latest = latest_period(periods)
    reporting_currency = periods[period].currency if period in periods else None
    no_currency = not any(
        c for m, c in currencies.items() if m not in ("shares_outstanding",)
    )
    market = build_market_context(
        db,
        holding,
        market_data_provider,
        reporting_currency=reporting_currency,
        latest_facts=latest.facts if latest else facts,
        latest_period=latest.period if latest else period,
        currency_unknown_not_mixed=no_currency,
    )
    result = compute_holding_metrics(
        facts,
        currencies,
        prior_facts=prior.facts if prior else None,
        market=market.inputs,
        market_unavailable_reason=market.unavailable_reason,
    )
    stale_period = latest is not None and latest.period != period
    if stale_period and market.inputs is not None:
        for key in ("price_to_earnings", "price_to_sales", "price_to_book", "ev_to_ebitda", "fcf_yield"):
            if key in result.computed:
                result.notes[key] = "; ".join(
                    filter(None, [result.notes.get(key), f"today's price on {period} figures"])
                )

    documents = {
        d.id: d
        for d in db.scalars(
            select(Document).where(Document.id.in_({item.document_id for item in line_items}))
        )
    }
    fact_details: list[MetricFactOut] = []
    for item in sorted(line_items, key=lambda i: i.metric):
        document = documents.get(item.document_id)
        flags = (document.quality_flags if document else None) or {}
        sources = (flags.get("ixbrl") or {}).get("fact_sources") or {}
        fact_details.append(
            MetricFactOut(
                metric=item.metric,
                value=item.value,
                currency=item.currency,
                document_id=item.document_id,
                original_filename=document.original_filename if document else "?",
                source_page=item.source_page,
                confidence=item.confidence,
                source=sources.get(f"{period} {item.metric}"),
            )
        )

    notes = dict(result.notes)
    by_metric = {f.metric: f for f in fact_details}
    interest = by_metric.get("interest_expense")
    if interest and interest.source and interest.source.startswith("proxy:"):
        notes["interest_coverage"] = "; ".join(
            filter(None, [notes.get("interest_coverage"), "interest = cash interest paid (proxy)"])
        )
    capex = by_metric.get("capital_expenditures")
    if capex and capex.source and capex.source.startswith("derived:"):
        parts = capex.source.removeprefix("derived:").strip().split(" + ")
        text = "capex = " + " + ".join(p.split(":", 1)[-1] for p in parts)
        for key in ("free_cash_flow", "owner_earnings"):
            notes[key] = "; ".join(filter(None, [notes.get(key), text]))

    warnings = list(result.warnings)
    hybrid_label = (
        "Hybrid capital counted as debt (net debt, debt / equity)"
        if "hybrid_capital" in facts
        # an upload extracted before hybrid_capital existed: re-upload to fix
        else "Debt / equity uses equity as reported — re-upload the file to treat hybrid capital as debt"
    )
    for document in documents.values():
        flags = document.quality_flags or {}
        for key, label in (
            ("equity_includes_hybrid_capital", hybrid_label),
            ("facts_differ_from_existing", "Kept an earlier file's value"),
            ("fact_conflicts", "Conflicting tags, not imported"),
        ):
            for entry in flags.get(key) or []:
                if isinstance(entry, str) and entry.startswith(period):
                    warnings.append(f"{label} ({document.original_filename}): {entry}")
        for entry in ((flags.get("ixbrl") or {}).get("integrity_checks") or {}).get("failed") or []:
            if isinstance(entry, str) and entry.startswith(period):
                warnings.append(
                    f"Statement check failed ({document.original_filename}): {entry}"
                )

    warnings.extend(market.warnings)
    monetary = {c for m, c in currencies.items() if c and m not in ("shares_outstanding", "eps_basic")}
    return HoldingMetricsOut(
        holding_id=holding_id,
        period=period,
        facts=facts,
        computed=result.computed,
        skipped=result.skipped,
        currency=next(iter(monetary)) if len(monetary) == 1 else None,
        notes=notes,
        warnings=warnings,
        fact_details=fact_details,
        prior_period=prior.period if prior else None,
        market=_market_out(market, stale_period=stale_period),
    )


@router.get("/{holding_id}/share-count", response_model=ShareCountOut)
def get_share_count(
    holding_id: UUID,
    db: Session = Depends(get_db),
    market_data_provider: MarketDataProvider | None = Depends(get_market_data_provider_or_none),
) -> ShareCountOut:
    """The share count the multiples and the DCF use, with its source."""
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")
    latest = latest_period(facts_by_period(db, holding_id))
    return _share_count_out(
        resolve_share_count(
            db,
            holding,
            market_data_provider,
            latest_facts=latest.facts if latest else None,
            latest_period=latest.period if latest else None,
        )
    )


@router.put("/{holding_id}/share-count", response_model=ShareCountOut)
def set_share_count(
    holding_id: UUID,
    payload: ShareCountIn,
    db: Session = Depends(get_db),
) -> ShareCountOut:
    """Enter the current share count yourself (e.g. from a Newsweb notice
    after a share issue). It wins over Yahoo / SEC until removed."""
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")
    if payload.shares <= 0:
        raise HTTPException(status_code=422, detail="shares must be positive")
    add_manual_share_count(
        db,
        holding,
        shares=payload.shares,
        as_of=payload.as_of,
        reference=payload.reference,
        note=payload.note,
    )
    latest = latest_period(facts_by_period(db, holding_id))
    return _share_count_out(
        resolve_share_count(
            db,
            holding,
            None,
            latest_facts=latest.facts if latest else None,
            latest_period=latest.period if latest else None,
        )
    )


@router.delete("/{holding_id}/share-count", response_model=dict)
def remove_share_count_override(
    holding_id: UUID, confirm: bool = False, db: Session = Depends(get_db)
) -> dict:
    """Removes the share counts you entered; Yahoo / SEC take over again.
    Only manual entries are removed — nothing fetched is deleted. Requires
    confirm=true like every delete."""
    if not confirm:
        raise HTTPException(status_code=400, detail="pass confirm=true to remove your share count")
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")
    return {"removed": clear_manual_share_counts(db, holding)}
