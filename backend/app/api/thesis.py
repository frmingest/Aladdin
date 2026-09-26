"""Thesis tracking endpoints (Sprint 11) — "is my thesis still intact?"
See app/services/thesis/*. Every number here is deterministic, computed
from data already in the database; nothing here calls an LLM, and nothing
here calls a live market-data provider either (app/services/thesis/
prices.py's docstring explains why) — CLAUDE.md Rule 1.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.models.holding import Holding
from app.models.thesis import ThesisTripwire
from app.schemas.thesis import (
    ChangeReasonOut,
    HoldingThesisOut,
    MetricDefOut,
    MonitorOut,
    MonitorRowOut,
    TimelineEntryOut,
    TripwireCreate,
    TripwireOut,
    TripwireSuggestionOut,
    TripwireUpdate,
)
from app.services.analysis.latest import latest_runs_by_holding, run_ratings
from app.services.settings.demo_guard import require_not_demo
from app.services.settings.demo_mode import is_demo_mode
from app.services.settings.synthetic_data import demo_thesis, demo_thesis_monitor
from app.services.thesis.history import changes_since_run
from app.services.thesis.metrics_registry import METRICS_BY_KEY, metric_registry
from app.services.thesis.monitor import STATUS_LABELS, build_monitor, classify
from app.services.thesis.timeline import build_timeline
from app.services.thesis.tripwires import (
    UNSET,
    TripwireEvaluation,
    acknowledge_tripwire,
    create_tripwire,
    evaluate_holding_tripwires,
    suggestions_from_run,
    update_tripwire,
)

router = APIRouter(prefix="/thesis", tags=["thesis"])


def _metric_label(metric: str) -> str:
    definition = METRICS_BY_KEY.get(metric)
    return definition.label if definition else metric


def _tripwire_out(evaluation_or_tripwire) -> TripwireOut:
    if isinstance(evaluation_or_tripwire, TripwireEvaluation):
        tripwire = evaluation_or_tripwire.tripwire
        current_value = evaluation_or_tripwire.current_value
        unavailable_reason = evaluation_or_tripwire.unavailable_reason
        firing = evaluation_or_tripwire.firing
    else:
        tripwire = evaluation_or_tripwire
        current_value = None
        unavailable_reason = None
        firing = tripwire.fired_at is not None

    return TripwireOut(
        id=tripwire.id,
        holding_id=tripwire.holding_id,
        metric=tripwire.metric,
        metric_label=_metric_label(tripwire.metric),
        operator=tripwire.operator,
        threshold=tripwire.threshold,
        label=tripwire.label,
        origin=tripwire.origin,
        source_run_id=tripwire.source_run_id,
        active=tripwire.active,
        fired_at=tripwire.fired_at,
        seen_at=tripwire.seen_at,
        created_at=tripwire.created_at,
        updated_at=tripwire.updated_at,
        current_value=current_value,
        unavailable_reason=unavailable_reason,
        firing=firing,
    )


@router.get("/metrics", response_model=list[MetricDefOut])
def get_metric_registry() -> list[MetricDefOut]:
    return [MetricDefOut(key=m.key, label=m.label, group=m.group, unit=m.unit) for m in metric_registry()]


@router.get("/holdings/{holding_id}", response_model=HoldingThesisOut)
def get_holding_thesis(holding_id: UUID, db: Session = Depends(get_db)) -> HoldingThesisOut:
    if is_demo_mode(db):
        demo = demo_thesis(holding_id)
        if demo is None:
            raise HTTPException(status_code=404, detail="holding not found")
        return demo
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")

    run = latest_runs_by_holding(db, [holding.id]).get(holding.id)
    analyzed_at = run_ratings(run)[2] if run is not None else None

    evaluations = evaluate_holding_tripwires(db, holding)
    firing_count = sum(1 for e in evaluations if e.firing)
    change_reasons = changes_since_run(db, holding, run) if run is not None else []
    status = classify(
        firing_count=firing_count, change_reason_count=len(change_reasons), has_usable_run=run is not None
    )

    timeline = [
        TimelineEntryOut(
            run_id=entry.run_id,
            date=entry.date,
            verdict=entry.verdict,
            verdict_direction=entry.verdict_direction,
            moat=entry.moat,
            moat_direction=entry.moat_direction,
            price=entry.price,
            price_currency=entry.price_currency,
            dcf_low=entry.dcf_low,
            dcf_high=entry.dcf_high,
            pass_type=entry.pass_type,
            engine=entry.engine,
            model_name=entry.model_name,
            thesis_bullets=entry.thesis_bullets,
        )
        for entry in build_timeline(db, holding.id)
    ]
    suggestions = [
        TripwireSuggestionOut(
            text=s.text,
            metric=s.parsed.metric if s.parsed else None,
            operator=s.parsed.operator if s.parsed else None,
            threshold=s.parsed.threshold if s.parsed else None,
        )
        for s in suggestions_from_run(run)
    ]

    return HoldingThesisOut(
        holding_id=holding.id,
        ticker=holding.ticker,
        name=holding.name,
        status=status,
        status_label=STATUS_LABELS[status],
        analyzed_at=analyzed_at,
        change_reasons=[ChangeReasonOut(key=r.key, text=r.text) for r in change_reasons],
        tripwires=[_tripwire_out(e) for e in evaluations],
        timeline=timeline,
        suggestions=suggestions,
    )


@router.post("/holdings/{holding_id}/tripwires", response_model=TripwireOut, status_code=201)
def create_holding_tripwire(
    holding_id: UUID, payload: TripwireCreate, db: Session = Depends(get_db)
) -> TripwireOut:
    require_not_demo(db)
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")
    try:
        tripwire = create_tripwire(
            db,
            holding,
            metric=payload.metric,
            operator=payload.operator,
            threshold=payload.threshold,
            label=payload.label,
            origin=payload.origin,
            source_run_id=payload.source_run_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _tripwire_out(tripwire)


@router.patch("/tripwires/{tripwire_id}", response_model=TripwireOut)
def patch_tripwire(tripwire_id: UUID, payload: TripwireUpdate, db: Session = Depends(get_db)) -> TripwireOut:
    require_not_demo(db)
    tripwire = db.get(ThesisTripwire, tripwire_id)
    if tripwire is None:
        raise HTTPException(status_code=404, detail="tripwire not found")
    fields = payload.model_fields_set
    try:
        tripwire = update_tripwire(
            db,
            tripwire,
            operator=payload.operator if "operator" in fields else None,
            threshold=payload.threshold if "threshold" in fields else None,
            label=payload.label if "label" in fields else UNSET,
            active=payload.active if "active" in fields else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _tripwire_out(tripwire)


@router.post("/tripwires/{tripwire_id}/acknowledge", response_model=TripwireOut)
def acknowledge(tripwire_id: UUID, db: Session = Depends(get_db)) -> TripwireOut:
    require_not_demo(db)
    tripwire = db.get(ThesisTripwire, tripwire_id)
    if tripwire is None:
        raise HTTPException(status_code=404, detail="tripwire not found")
    try:
        tripwire = acknowledge_tripwire(db, tripwire)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _tripwire_out(tripwire)


@router.delete("/tripwires/{tripwire_id}", status_code=204, response_model=None)
def delete_tripwire(tripwire_id: UUID, confirm: bool = False, db: Session = Depends(get_db)) -> None:
    require_not_demo(db)
    if not confirm:
        raise HTTPException(status_code=400, detail="pass confirm=true to delete a tripwire")
    tripwire = db.get(ThesisTripwire, tripwire_id)
    if tripwire is None:
        raise HTTPException(status_code=404, detail="tripwire not found")
    db.delete(tripwire)
    db.commit()


@router.get("/monitor", response_model=MonitorOut)
def get_monitor(db: Session = Depends(get_db)) -> MonitorOut:
    if is_demo_mode(db):
        return demo_thesis_monitor()
    rows = build_monitor(db)
    return MonitorOut(
        rows=[
            MonitorRowOut(
                holding_id=r.holding_id,
                ticker=r.ticker,
                name=r.name,
                status=r.status,
                status_label=r.status_label,
                firing_count=r.firing_count,
                change_reason_count=r.change_reason_count,
                analyzed_at=r.analyzed_at,
            )
            for r in rows
        ]
    )
