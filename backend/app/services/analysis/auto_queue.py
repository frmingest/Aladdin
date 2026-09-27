"""Side-by-side auto-queue (Epic F22, story 22.7; plan §5 decision 3).

While the app is in side-by-side mode, a holding whose other persona's run
is missing — or more than `f22_auto_queue_stale_days` older than its
partner — gets that run queued automatically. Guardrails, all enforced
here, not in the UI:

- local worker engine only (enqueue_local_run): never spends Gemini quota;
- dedupe: nothing is queued while a queued/running run already exists for
  that holding + persona;
- readiness: the same per-persona blocker check as "Queue all ready
  holdings" (queue.queue_blocker);
- nightly cap: at most `f22_auto_queue_nightly_cap` auto-queued runs in any
  rolling 24 hours (counted from `auto_queued` runs' queued_at);
- every auto-queued run carries auto_queued=True, shown as "auto" on the
  queue page;
- only in side-by-side mode: in any other mode this does nothing.

The Sprint 15 LLM usage ledger (a real cost/quota record) is still not
built; because auto-queued runs are local-only, the cap above is the
spend guard in the meantime — noted in the F22 build doc.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config.settings import Settings
from app.domain.analyst_modes import (
    DALIO,
    DALIO_ANALYZABLE_TYPES,
    PERSONAS,
    SIDE_BY_SIDE,
)
from app.domain.instrument_types import EQUITY_ANALYZABLE_TYPES
from app.models.analysis import EquityAnalysisRun
from app.models.holding import Holding
from app.services.analysis.latest import latest_runs_by_holding
from app.services.analysis.queue import (
    enqueue_local_run,
    pending_run_for_holding,
    queue_blocker,
)
from app.services.settings.analyst_mode import get_analyst_mode


@dataclass
class AutoQueueAction:
    holding_id: uuid.UUID
    ticker: str
    persona: str
    action: str  # "queued" | "already_pending" | "up_to_date" | "blocked" | "cap_reached" | "not_applicable"
    detail: str = ""
    run_id: uuid.UUID | None = None


@dataclass
class AutoQueueResult:
    mode: str
    cap: int
    auto_queued_last_24h: int
    actions: list[AutoQueueAction] = field(default_factory=list)

    @property
    def queued(self) -> list[AutoQueueAction]:
        return [a for a in self.actions if a.action == "queued"]


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def auto_queued_in_window(db: Session, now: datetime) -> int:
    return db.scalar(
        select(func.count())
        .select_from(EquityAnalysisRun)
        .where(EquityAnalysisRun.auto_queued.is_(True), EquityAnalysisRun.queued_at >= now - timedelta(hours=24))
    ) or 0


def _analyzed_at(run: EquityAnalysisRun) -> datetime:
    return _aware(run.completed_at or run.blind_completed_at or run.started_at)


def needs_partner(
    run: EquityAnalysisRun | None, partner: EquityAnalysisRun | None, *, stale_days: int
) -> tuple[bool, str]:
    """Should `run`'s persona be (re)queued, given the partner persona's
    latest run? Missing -> yes. Older than the partner by more than
    stale_days -> yes. The partner itself missing is the partner's problem."""
    if run is None:
        return True, "no run yet"
    if partner is None:
        return False, "partner run missing — the partner is queued instead"
    gap = _analyzed_at(partner) - _analyzed_at(run)
    if gap > timedelta(days=stale_days):
        return True, f"{gap.days} days older than its partner run"
    return False, "up to date"


def auto_queue_missing(
    db: Session,
    holdings: list[Holding],
    *,
    settings: Settings,
    now: datetime | None = None,
    mode: str | None = None,
) -> AutoQueueResult:
    now = now or datetime.now(timezone.utc)
    mode = mode or get_analyst_mode(db)
    cap = settings.f22_auto_queue_nightly_cap
    used = auto_queued_in_window(db, now)
    result = AutoQueueResult(mode=mode, cap=cap, auto_queued_last_24h=used)
    if mode != SIDE_BY_SIDE:
        return result

    ids = [h.id for h in holdings]
    latest = {p: latest_runs_by_holding(db, ids, persona=p) for p in PERSONAS}
    for holding in holdings:
        for persona in PERSONAS:
            allowed = DALIO_ANALYZABLE_TYPES if persona == DALIO else EQUITY_ANALYZABLE_TYPES
            if holding.asset_class_raw not in allowed:
                result.actions.append(
                    AutoQueueAction(holding.id, holding.ticker, persona, "not_applicable",
                                    "the Buffett/Munger engine doesn't analyze this instrument type")
                )
                continue
            partner = DALIO if persona != DALIO else PERSONAS[0]
            wanted, why = needs_partner(
                latest[persona].get(holding.id), latest[partner].get(holding.id),
                stale_days=settings.f22_auto_queue_stale_days,
            )
            if not wanted:
                result.actions.append(AutoQueueAction(holding.id, holding.ticker, persona, "up_to_date", why))
                continue
            pending = pending_run_for_holding(db, holding.id, persona=persona)
            if pending is not None:
                result.actions.append(
                    AutoQueueAction(holding.id, holding.ticker, persona, "already_pending", why, pending.id)
                )
                continue
            blocker = queue_blocker(db, holding, settings=settings, persona=persona)
            if blocker:
                result.actions.append(AutoQueueAction(holding.id, holding.ticker, persona, "blocked", blocker))
                continue
            if used >= cap:
                result.actions.append(
                    AutoQueueAction(holding.id, holding.ticker, persona, "cap_reached",
                                    f"{used} auto-queued runs in the last 24 hours (cap {cap})")
                )
                continue
            run, created = enqueue_local_run(
                db, holding, settings=settings, now=now, persona=persona, auto_queued=True
            )
            if created:
                used += 1
            result.actions.append(
                AutoQueueAction(holding.id, holding.ticker, persona, "queued" if created else "already_pending",
                                why, run.id)
            )
    result.auto_queued_last_24h = used
    return result
