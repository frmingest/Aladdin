"""Sprint 11 — the verdict timeline: read-only from equity_analysis_runs,
newest first. No new storage — every run already stores its own
verdict/moat/DCF/etc. in full (app/models/analysis.py); this just reads
them back with a direction arrow against the previous run.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.analysis import EquityAnalysisRun
from app.services.analysis.latest import run_ratings
from app.services.thesis.prices import stored_price_at_or_before

VERDICT_RANK = {"Avoid": 0, "Sell": 1, "Hold": 2, "Buy": 3, "Strong Buy": 4}
MOAT_RANK = {"None": 0, "Narrow": 1, "Wide": 2}


@dataclass
class TimelineEntry:
    run_id: uuid.UUID
    date: datetime
    verdict: str | None
    verdict_direction: str | None  # "up" | "down" | "flat" | None
    moat: str | None
    moat_direction: str | None
    price: Decimal | None
    price_currency: str | None
    dcf_low: Decimal | None
    dcf_high: Decimal | None
    pass_type: str  # "blind_only" | "reconciled"
    engine: str
    model_name: str | None
    thesis_bullets: list[str]


def _direction(rank_map: dict[str, int], current: str | None, previous: str | None) -> str | None:
    if current not in rank_map or previous not in rank_map:
        return None
    if rank_map[current] > rank_map[previous]:
        return "up"
    if rank_map[current] < rank_map[previous]:
        return "down"
    return "flat"


def build_timeline(db: Session, holding_id: uuid.UUID) -> list[TimelineEntry]:
    runs = db.scalars(
        select(EquityAnalysisRun)
        .where(EquityAnalysisRun.holding_id == holding_id)
        .order_by(EquityAnalysisRun.started_at.desc())
    ).all()
    # Filtered in Python (JSON null quirk), same as latest_runs_by_holding.
    runs = [r for r in runs if r.blind_pass_json]

    entries: list[TimelineEntry] = []
    for index, run in enumerate(runs):
        verdict, moat, date = run_ratings(run)
        previous_run = runs[index + 1] if index + 1 < len(runs) else None
        prev_verdict, prev_moat, _ = run_ratings(previous_run) if previous_run else (None, None, None)

        blind = run.blind_pass_json or {}
        reconciliation = run.reconciliation_json or {}
        thesis_bullets = list(reconciliation.get("thesis_bullets") or blind.get("thesis_bullets") or [])[:3]

        price_row = stored_price_at_or_before(db, holding_id, run.started_at)

        entries.append(
            TimelineEntry(
                run_id=run.id,
                date=date or run.started_at,
                verdict=verdict,
                verdict_direction=_direction(VERDICT_RANK, verdict, prev_verdict),
                moat=moat,
                moat_direction=_direction(MOAT_RANK, moat, prev_moat),
                price=price_row.price if price_row else None,
                price_currency=price_row.currency if price_row else None,
                dcf_low=run.price_target_low,
                dcf_high=run.price_target_high,
                pass_type="reconciled" if run.reconciliation_json else "blind_only",
                engine=run.engine,
                model_name=run.model_name,
                thesis_bullets=thesis_bullets,
            )
        )
    return entries
