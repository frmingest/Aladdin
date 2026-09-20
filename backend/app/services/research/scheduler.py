"""
Background scheduled refresh (architecture §4 "Background jobs: APScheduler
initially", §9.1/§9.3 refresh cadence, §26 Phase 4). The first thing in this
codebase to actually start APScheduler — Phases 0-3 never needed a
background job, since portfolio/market/analysis refreshes are all
user-triggered (§2.9: avoid premature infrastructure). Research is different:
§9.1 explicitly calls for it to be "a periodic job, not a per-click API
call" (§2.7).

Runs two interval jobs against their own DB session (APScheduler jobs run
outside any request, so they can't use the `get_db` FastAPI dependency):

- macro refresh, every `macro_refresh_interval_hours`
- sector research refresh, every `sector_research_refresh_interval_days`,
  once per distinct sector currently present on any holding (§9.3: routed
  by sector, not a fixed hardcoded list)
- company research refresh, every `company_research_refresh_interval_days`,
  once per holding currently on record (Phase 11 Sprint 2 — routed by
  holding_id, the per-company counterpart to the sector job above)

Both call the same `refresh_*` functions the manual API endpoints use
(app.api.research) with `force=False` — the interval only decides how often
the scheduler *tries*; the service layer's own staleness check
(app.services.research.common) is what actually prevents redundant provider
calls if, say, the app was restarted shortly after a manual refresh.

Disabled during tests via `settings.enable_scheduler=False` (set in
tests/__init__.py) so the test suite never opens a background thread or
makes a live provider call merely by importing app.main.
"""

from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session

from app.config.database import SessionLocal
from app.config.logging import get_logger
from app.config.settings import Settings, get_settings
from app.models.holding import Holding
from app.providers.factory import get_macro_data_provider, get_research_provider
from app.services.research.company import refresh_company_research
from app.services.research.macro import refresh_macro_snapshot
from app.services.research.sector import refresh_sector_research

logger = get_logger(__name__)


def _run_macro_refresh_job() -> None:
    db: Session = SessionLocal()
    try:
        run = refresh_macro_snapshot(db, get_macro_data_provider(), get_research_provider(), force=False)
        logger.info("scheduled_macro_refresh_completed", status=run.status)
    except Exception:  # noqa: BLE001 — a scheduled job must never crash the scheduler thread (§21)
        logger.exception("scheduled_macro_refresh_failed")
    finally:
        db.close()


def _run_sector_refresh_job() -> None:
    db: Session = SessionLocal()
    try:
        sectors = [
            row[0]
            for row in db.query(Holding.sector).filter(Holding.sector.isnot(None)).distinct().all()
        ]
        provider = get_research_provider()
        for sector in sectors:
            try:
                run = refresh_sector_research(db, provider, sector, force=False)
                logger.info("scheduled_sector_refresh_completed", sector=sector, status=run.status)
            except Exception:  # noqa: BLE001 — one sector failing must not skip the rest (§21)
                logger.exception("scheduled_sector_refresh_failed", sector=sector)
    finally:
        db.close()


def _run_company_refresh_job() -> None:
    """Phase 11 Sprint 2 — one company-research refresh per holding
    currently on record, mirroring _run_sector_refresh_job's per-sector
    loop. Not filtered by asset class yet — Sprint 5 (non-equity removal)
    is what narrows the app to equity holdings; until then this refreshes
    every holding the same way sector refresh already does."""
    db: Session = SessionLocal()
    try:
        holdings = db.query(Holding).all()
        provider = get_research_provider()
        for holding in holdings:
            try:
                run = refresh_company_research(db, provider, holding, force=False)
                logger.info("scheduled_company_refresh_completed", ticker=holding.ticker, status=run.status)
            except Exception:  # noqa: BLE001 — one holding failing must not skip the rest (§21)
                logger.exception("scheduled_company_refresh_failed", ticker=holding.ticker)
    finally:
        db.close()


def start_research_scheduler(settings: Settings | None = None) -> BackgroundScheduler | None:
    """Returns the started scheduler, or None if disabled — the caller
    (app.main's lifespan) holds onto it only to shut it down cleanly."""
    settings = settings or get_settings()
    if not settings.enable_scheduler:
        logger.info("research_scheduler_disabled")
        return None

    # Both jobs' own service-layer staleness check (app.services.research.common)
    # is what actually prevents a redundant provider call, so it's safe (and
    # desirable — see module docstring) to have both fire shortly after
    # startup rather than only after a full interval elapses first.
    now = datetime.now(timezone.utc)
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        _run_macro_refresh_job,
        trigger=IntervalTrigger(hours=settings.macro_refresh_interval_hours),
        id="macro_refresh",
        next_run_time=now,
    )
    scheduler.add_job(
        _run_sector_refresh_job,
        trigger=IntervalTrigger(days=settings.sector_research_refresh_interval_days),
        id="sector_refresh",
        next_run_time=now,
    )
    scheduler.add_job(
        _run_company_refresh_job,
        trigger=IntervalTrigger(days=settings.company_research_refresh_interval_days),
        id="company_refresh",
        next_run_time=now,
    )
    scheduler.start()
    logger.info(
        "research_scheduler_started",
        macro_refresh_interval_hours=settings.macro_refresh_interval_hours,
        sector_research_refresh_interval_days=settings.sector_research_refresh_interval_days,
        company_research_refresh_interval_days=settings.company_research_refresh_interval_days,
    )
    return scheduler
