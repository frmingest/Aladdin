"""Sprint 11 — status classification (\U0001F534\U0001F7E0⚪\U0001F7E2) and the
cross-portfolio monitor list (GET /thesis/monitor). Stored data only (see
app/services/thesis/prices.py) — no live market-data provider call, so
this is cheap enough to render on every dashboard load.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.holding import Holding
from app.models.thesis import ThesisTripwire
from app.services.analysis.latest import latest_runs_by_holding, run_ratings
from app.services.thesis.history import changes_since_run
from app.services.thesis.tripwires import evaluate_holding_tripwires
from app.services.valuation.board import current_positions

STATUS_FIRING = "tripwire_fired"
STATUS_REVIEW = "review"
STATUS_NOT_ANALYZED = "not_analyzed"
STATUS_INTACT = "intact"
STATUS_ORDER = {STATUS_FIRING: 0, STATUS_REVIEW: 1, STATUS_NOT_ANALYZED: 2, STATUS_INTACT: 3}
STATUS_LABELS = {
    STATUS_FIRING: "\U0001F534 Tripwire fired",
    STATUS_REVIEW: "\U0001F7E0 Review",
    STATUS_NOT_ANALYZED: "⚪ Not analyzed",
    STATUS_INTACT: "\U0001F7E2 Intact",
}


@dataclass
class HoldingThesisSummary:
    holding_id: uuid.UUID
    ticker: str
    name: str
    status: str
    status_label: str
    firing_count: int
    change_reason_count: int
    analyzed_at: datetime | None


def classify(*, firing_count: int, change_reason_count: int, has_usable_run: bool) -> str:
    """Most urgent first: a firing tripwire beats a plain "something
    changed", which beats "never analyzed" — an unanalyzed holding isn't
    wrong, just uninformative."""
    if firing_count > 0:
        return STATUS_FIRING
    if change_reason_count > 0:
        return STATUS_REVIEW
    if not has_usable_run:
        return STATUS_NOT_ANALYZED
    return STATUS_INTACT


def holdings_to_monitor(db: Session) -> list[Holding]:
    """Every holding with a current portfolio position or at least one
    tripwire — a watched-but-not-owned company with a tripwire still
    belongs on the monitor."""
    owned_ids = {p.holding_id for p in current_positions(db)}
    tripwire_ids = set(db.scalars(select(ThesisTripwire.holding_id).distinct()))
    ids = owned_ids | tripwire_ids
    if not ids:
        return []
    return list(db.scalars(select(Holding).where(Holding.id.in_(ids))))


def summarize_holding(db: Session, holding: Holding, *, now: datetime | None = None) -> HoldingThesisSummary:
    run = latest_runs_by_holding(db, [holding.id]).get(holding.id)
    evaluations = evaluate_holding_tripwires(db, holding, now=now)
    firing_count = sum(1 for e in evaluations if e.firing)
    change_reasons = changes_since_run(db, holding, run, now=now) if run is not None else []
    status = classify(
        firing_count=firing_count, change_reason_count=len(change_reasons), has_usable_run=run is not None
    )
    analyzed_at = run_ratings(run)[2] if run is not None else None
    return HoldingThesisSummary(
        holding_id=holding.id,
        ticker=holding.ticker,
        name=holding.name,
        status=status,
        status_label=STATUS_LABELS[status],
        firing_count=firing_count,
        change_reason_count=len(change_reasons),
        analyzed_at=analyzed_at,
    )


def build_monitor(db: Session, *, now: datetime | None = None) -> list[HoldingThesisSummary]:
    rows = [summarize_holding(db, h, now=now) for h in holdings_to_monitor(db)]
    rows.sort(key=lambda r: (STATUS_ORDER[r.status], r.ticker))
    return rows
