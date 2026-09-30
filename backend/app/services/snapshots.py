"""Stored snapshots of the slow read endpoints (2026-09-30).

Measured live on 2026-09-30: Portfolio risk 9.3 s, Watchlist 6.9 s,
Margin of safety 5.0 s, Performance 3.3 s — each rebuilt from scratch on
every visit. `get_or_build` serves the stored JSON of the last build when

* it is younger than `snapshot_max_age_hours`, and
* the *fingerprint* of the inputs is unchanged.

The fingerprint is one cheap aggregate query over the tables whose changes
must show up immediately: portfolio snapshots (a new import), holdings,
watchlist entries (incl. buy-below prices), uploaded documents and finished
analysis runs. Market prices are deliberately NOT in it — prices move
between refreshes by design; the PC worker refreshes the snapshots nightly
(`refresh_all_snapshots`) and every page's Refresh button rebuilds its own.

A snapshot is a cache, never a source of truth: any read or write problem
falls back to building live, exactly as the endpoint did before.
"""
from __future__ import annotations

import hashlib
import logging
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from typing import TypeVar

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.models.analysis import EquityAnalysisRun
from app.models.document import Document
from app.models.holding import Holding
from app.models.portfolio import PortfolioSnapshot
from app.models.snapshot import ComputedSnapshot
from app.models.watchlist import WatchlistItem

log = logging.getLogger("aladdin.snapshots")

T = TypeVar("T", bound=BaseModel)

RISK_KEY = "risk_portfolio"
BOARD_KEY = "valuation_board"
WATCHLIST_KEY = "watchlist"


def performance_key(lookback_days: int, benchmark_ticker: str) -> str:
    return f"performance:{lookback_days}:{benchmark_ticker}"


def fingerprint(db: Session) -> str:
    """One round trip: counts and newest timestamps of the inputs."""
    row = db.execute(
        select(
            select(func.count()).select_from(PortfolioSnapshot).scalar_subquery(),
            select(func.max(PortfolioSnapshot.uploaded_at)).scalar_subquery(),
            select(func.count()).select_from(Holding).scalar_subquery(),
            select(func.max(Holding.updated_at)).scalar_subquery(),
            select(func.count()).select_from(WatchlistItem).scalar_subquery(),
            select(func.max(WatchlistItem.added_at)).scalar_subquery(),
            select(func.coalesce(func.sum(WatchlistItem.buy_below_price), 0)).scalar_subquery(),
            select(func.count()).select_from(Document).scalar_subquery(),
            select(func.max(Document.uploaded_at)).scalar_subquery(),
            select(func.count()).select_from(EquityAnalysisRun).scalar_subquery(),
            select(func.max(EquityAnalysisRun.completed_at)).scalar_subquery(),
        )
    ).one()
    return hashlib.sha256(repr(tuple(row)).encode()).hexdigest()[:32]


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _with_stamp(model: T, when: datetime) -> T:
    if hasattr(model, "snapshot_at"):
        return model.model_copy(update={"snapshot_at": when})
    return model


def store(db: Session, key: str, model: BaseModel, *, fp: str | None = None) -> datetime:
    """Save `model` under `key`; returns the computed_at stamp. Never raises."""
    now = datetime.now(timezone.utc)
    try:
        fp = fp or fingerprint(db)
        payload = _with_stamp(model, now).model_dump_json()
        row = db.get(ComputedSnapshot, key)
        if row is None:
            db.add(ComputedSnapshot(key=key, payload=payload, fingerprint=fp, computed_at=now))
        else:
            row.payload, row.fingerprint, row.computed_at = payload, fp, now
        db.commit()
    except Exception:  # noqa: BLE001 - a cache write must never fail the request
        db.rollback()
        log.warning("could not store snapshot %s", key, exc_info=True)
    return now


def get_or_build(
    db: Session,
    key: str,
    model_cls: type[T],
    build: Callable[[], T],
    *,
    refresh: bool = False,
) -> T:
    """Serve the stored snapshot when valid, else build, store and return."""
    fp: str | None = None
    if not refresh:
        try:
            fp = fingerprint(db)
            row = db.get(ComputedSnapshot, key)
            max_age = timedelta(hours=get_settings().snapshot_max_age_hours)
            if (
                row is not None
                and row.fingerprint == fp
                and datetime.now(timezone.utc) - _aware(row.computed_at) <= max_age
            ):
                return model_cls.model_validate_json(row.payload)
        except Exception:  # noqa: BLE001 - unreadable/absent snapshot -> build live
            db.rollback()
            log.warning("snapshot %s unreadable; building live", key, exc_info=True)
    model = build()
    stamp = store(db, key, model, fp=fp)
    return _with_stamp(model, stamp)
