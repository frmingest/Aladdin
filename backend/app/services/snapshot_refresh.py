"""Nightly rebuild of the stored page snapshots (2026-09-30).

The PC worker (home IP, so Yahoo is reachable) calls `run_if_due` on its
poll loop: once per UTC day after `snapshot_refresh_hour_utc` it refreshes
price history, prices and valuations and stores fresh Risk, Performance,
Margin-of-safety and Watchlist payloads (app/services/snapshots.py). Each
of the four is independent — one failing never blocks the others, and the
result is a one-line summary in `app_settings` (no extra migration).
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.app_setting import AppSetting
from app.providers.base import MarketDataProvider, RiskFreeRateProvider
from app.services import snapshots

log = logging.getLogger("aladdin.snapshot_refresh")

LAST_RUN_KEY = "snapshots_last_run"
LAST_SUMMARY_KEY = "snapshots_last_summary"


def _write(db: Session, key: str, value: str) -> None:
    row = db.get(AppSetting, key)
    if row is None:
        db.add(AppSetting(key=key, value=value[:255]))
    else:
        row.value = value[:255]
        row.updated_at = datetime.now(timezone.utc)


def _read(db: Session, key: str) -> str | None:
    try:
        row = db.get(AppSetting, key)
    except Exception:  # noqa: BLE001
        db.rollback()
        return None
    return row.value if row is not None else None


def last_run(db: Session) -> tuple[datetime | None, str | None]:
    raw = _read(db, LAST_RUN_KEY)
    when = None
    if raw:
        try:
            when = datetime.fromisoformat(raw)
            if when.tzinfo is None:
                when = when.replace(tzinfo=timezone.utc)
        except ValueError:
            when = None
    return when, _read(db, LAST_SUMMARY_KEY)


def refresh_all_snapshots(
    db: Session,
    *,
    market_data_provider: MarketDataProvider,
    risk_free_rate_provider: RiskFreeRateProvider,
    now: datetime | None = None,
) -> str:
    """Rebuild all four snapshots with live data; returns the summary."""
    # Imported here: the payload builders live next to their endpoints.
    from app.api.performance import build_performance_out
    from app.api.risk import build_risk_out
    from app.api.valuation import build_board_out
    from app.api.watchlist import build_watchlist_out
    from app.services.performance.portfolio_performance import resolve_window

    lookback, bench = resolve_window(None, None)
    jobs = {
        "risk": (
            snapshots.RISK_KEY,
            lambda: build_risk_out(db, market_data_provider, risk_free_rate_provider, force_refresh=True),
        ),
        "performance": (
            snapshots.performance_key(lookback, bench),
            lambda: build_performance_out(db, market_data_provider, lookback, bench, force_refresh=True),
        ),
        "board": (
            snapshots.BOARD_KEY,
            lambda: build_board_out(db, market_data_provider, risk_free_rate_provider, force_refresh=True),
        ),
        "watchlist": (
            snapshots.WATCHLIST_KEY,
            lambda: build_watchlist_out(db, market_data_provider, risk_free_rate_provider, force_refresh=True),
        ),
    }
    ok: list[str] = []
    failed: list[str] = []
    for name, (key, build) in jobs.items():
        try:
            model = build()
            snapshots.store(db, key, model)
            ok.append(name)
        except Exception:
            db.rollback()
            log.warning("snapshot %s failed", name, exc_info=True)
            failed.append(name)
    summary = f"rebuilt {', '.join(ok) or 'nothing'}" + (f"; FAILED: {', '.join(failed)}" if failed else "")
    stamp = now or datetime.now(timezone.utc)
    _write(db, LAST_RUN_KEY, stamp.isoformat())
    _write(db, LAST_SUMMARY_KEY, summary)
    db.commit()
    log.info("snapshot refresh: %s", summary)
    return summary


def is_due(db: Session, *, now: datetime, hour_utc: int) -> bool:
    if now.hour < hour_utc:
        return False
    when, _ = last_run(db)
    return when is None or when.astimezone(timezone.utc).date() < now.astimezone(timezone.utc).date()


def run_if_due(
    db: Session,
    *,
    market_data_provider: MarketDataProvider,
    risk_free_rate_provider: RiskFreeRateProvider,
    hour_utc: int,
    now: datetime | None = None,
) -> str | None:
    now = now or datetime.now(timezone.utc)
    if not is_due(db, now=now, hour_utc=hour_utc):
        return None
    return refresh_all_snapshots(
        db,
        market_data_provider=market_data_provider,
        risk_free_rate_provider=risk_free_rate_provider,
        now=now,
    )
