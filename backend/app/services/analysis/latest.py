"""The latest usable analysis result per holding, shared by every roll-up
(margin-of-safety board, portfolio overview, watchlist).

"Usable" = the run produced at least a blind-pass verdict. A newer run
that failed or is still running never hides an older result: before
2026-09-23 the board took the newest run of any status, so one failed retry
made a holding look "Not analyzed".
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.analysis import EquityAnalysisRun


def latest_runs_by_holding(
    db: Session, holding_ids: list[uuid.UUID]
) -> dict[uuid.UUID, EquityAnalysisRun]:
    if not holding_ids:
        return {}
    runs = db.scalars(
        select(EquityAnalysisRun)
        .where(EquityAnalysisRun.holding_id.in_(holding_ids))
        .order_by(EquityAnalysisRun.started_at.desc())
    ).all()
    latest: dict[uuid.UUID, EquityAnalysisRun] = {}
    for run in runs:
        # Filtered in Python, not SQL: the JSON column stores Python None as
        # a JSON `null` value, which `IS NOT NULL` does not exclude.
        if run.blind_pass_json:
            latest.setdefault(run.holding_id, run)
    return latest


def run_ratings(run: EquityAnalysisRun) -> tuple[str | None, str | None, datetime | None]:
    """(verdict, moat, analyzed_at). The reconciliation verdict wins over
    the blind one when both exist; the moat only comes from the blind pass."""
    verdict = (run.reconciliation_json or {}).get("verdict") or (run.blind_pass_json or {}).get("verdict")
    moat = (run.blind_pass_json or {}).get("moat")
    analyzed_at = run.completed_at or run.blind_completed_at or run.started_at
    return (
        verdict.get("rating") if verdict else None,
        moat.get("overall_rating") if moat else None,
        analyzed_at,
    )
