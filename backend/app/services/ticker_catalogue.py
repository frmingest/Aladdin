"""The Norwegian ticker catalogue: refresh it from a provider, read it for Sal's shop (2026-11-11).

Refresh rules, chosen so a bad Yahoo day can only make the catalogue slightly stale, never wrong:

* A fetch that found nothing changes nothing.
* Known facts are not overwritten by "missing": a company that comes back without a sector or a market
  value keeps the one it had.
* A company is marked inactive only after a COMPLETE fetch that still returned most of what was there
  (`MIN_KEEP_RATIO`). A partial or suspiciously small fetch never retires anything.
* Rows are never deleted: a stall on the street keeps pointing at a known company.

Database only except `refresh`, which calls the provider it is given. Called from the PC worker.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domain.ticker_catalogue import app_sector
from app.models.ticker_catalogue import TickerCatalogueEntry
from app.providers.base import CatalogueFetch, CatalogueProvider
from app.services.job_status import read_job_run, record_job_run

log = logging.getLogger("aladdin.catalogue")

JOB = "ticker_catalogue"
PROBLEM_JOB = "ticker_catalogue_problem"
MIN_KEEP_RATIO = 0.6


@dataclass
class RefreshResult:
    saved: bool = False
    complete: bool = False
    added: int = 0
    updated: int = 0
    deactivated: int = 0
    total_active: int = 0
    problems: list[str] = field(default_factory=list)

    def summary(self) -> str:
        if not self.saved:
            return "Nothing saved. " + ("; ".join(self.problems)[:180] if self.problems else "No companies came back.")
        base = f"{self.total_active} Oslo companies: {self.added} new, {self.updated} updated, {self.deactivated} retired"
        if self.problems:
            return f"{base}. Partial: {'; '.join(self.problems)[:140]}"
        return base


def apply_fetch(db: Session, fetch: CatalogueFetch, *, now: datetime | None = None) -> RefreshResult:
    """Write one fetch into the table. Commits."""
    now = now or datetime.now(timezone.utc)
    result = RefreshResult(complete=fetch.complete, problems=list(fetch.problems))
    if not fetch.records:
        return result

    existing = {e.ticker: e for e in db.scalars(select(TickerCatalogueEntry))}
    active_before = sum(1 for e in existing.values() if e.active)
    seen: set[str] = set()

    for rec in fetch.records:
        seen.add(rec.ticker)
        entry = existing.get(rec.ticker)
        if entry is None:
            db.add(
                TickerCatalogueEntry(
                    ticker=rec.ticker,
                    name=rec.name,
                    exchange=rec.exchange,
                    currency=rec.currency,
                    yahoo_sector=rec.yahoo_sector,
                    sector=app_sector(rec.yahoo_sector),
                    market_cap=rec.market_cap,
                    market_cap_currency=rec.currency if rec.market_cap is not None else None,
                    active=True,
                    first_seen_at=now,
                    last_seen_at=now,
                )
            )
            result.added += 1
            continue
        before = (entry.name, entry.currency, entry.yahoo_sector, entry.market_cap, entry.active)
        entry.name = rec.name
        entry.exchange = rec.exchange
        entry.currency = rec.currency
        if rec.yahoo_sector:  # never replace a known sector with "none given"
            entry.yahoo_sector = rec.yahoo_sector
            entry.sector = app_sector(rec.yahoo_sector)
        if rec.market_cap is not None:
            entry.market_cap = rec.market_cap
            entry.market_cap_currency = rec.currency
        entry.active = True
        entry.last_seen_at = now
        if before != (entry.name, entry.currency, entry.yahoo_sector, entry.market_cap, entry.active):
            result.updated += 1

    if fetch.complete and active_before and len(seen) >= MIN_KEEP_RATIO * active_before:
        for ticker, entry in existing.items():
            if entry.active and ticker not in seen:
                entry.active = False
                result.deactivated += 1
    elif fetch.complete and active_before:
        result.problems.append(
            f"only {len(seen)} of {active_before} known companies came back, so none were retired"
        )

    db.commit()
    result.saved = True
    result.total_active = db.scalar(select(func.count()).select_from(TickerCatalogueEntry).where(TickerCatalogueEntry.active)) or 0
    return result


def refresh(db: Session, provider: CatalogueProvider, *, now: datetime | None = None) -> RefreshResult:
    """Fetch, store, and leave a run record for the System status page. Never raises."""
    now = now or datetime.now(timezone.utc)
    try:
        fetch = provider.fetch_oslo()
        result = apply_fetch(db, fetch, now=now)
    except Exception as exc:
        db.rollback()
        log.exception("ticker catalogue refresh failed")
        result = RefreshResult(problems=[f"{type(exc).__name__}: {exc}"])
    if result.saved and result.complete and not result.problems:
        record_job_run(db, JOB, result.summary(), now=now)
    else:
        record_job_run(db, PROBLEM_JOB, result.summary(), now=now)
        log.warning("ticker catalogue: %s", result.summary())
    return result


def last_success(db: Session) -> tuple[datetime | None, str | None]:
    return read_job_run(db, JOB)


def last_problem(db: Session) -> tuple[datetime | None, str | None]:
    return read_job_run(db, PROBLEM_JOB)


def is_due(db: Session, *, interval_hours: int, now: datetime | None = None) -> bool:
    """True when the table is empty or the last complete refresh is older than the interval."""
    now = now or datetime.now(timezone.utc)
    if not db.scalar(select(func.count()).select_from(TickerCatalogueEntry)):
        return True
    when, _ = last_success(db)
    return when is None or now - when >= timedelta(hours=interval_hours)


def active_entries(db: Session) -> list[TickerCatalogueEntry]:
    """Active companies, biggest first; companies without a market value come last, by name."""
    rows = list(db.scalars(select(TickerCatalogueEntry).where(TickerCatalogueEntry.active)))
    rows.sort(key=lambda e: (e.market_cap is None, -(e.market_cap or 0), e.name.lower()))
    return rows


def as_of(db: Session) -> datetime | None:
    """When the catalogue was last confirmed against Yahoo (newest `last_seen_at`)."""
    value = db.scalar(select(func.max(TickerCatalogueEntry.last_seen_at)))
    if value is not None and value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value


__all__ = [
    "JOB",
    "RefreshResult",
    "active_entries",
    "apply_fetch",
    "as_of",
    "is_due",
    "last_problem",
    "last_success",
    "refresh",
]
