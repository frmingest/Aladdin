"""Automatic fetch of new Newsweb reports (2026-11-11).

The hourly watch (newsweb_watch.py) only stores announcement metadata, so a
new quarterly or annual report never reached the game: Ravens and the library
read stored `Document` rows, and those came only from the manual "Fetch
reports" buttons. This job closes that gap. For every holding the watch covers
(Oslo-listed, owned or on the watchlist) it runs the same importers the
buttons use, over a short recent window:

* Reports already on file are skipped by Newsweb message id, so a repeat pass
  downloads nothing. A holding with no report in the window is "nothing new",
  not a failure.
* Same pipeline as a manual fetch: annual ESEF files give facts, half-year and
  quarterly PDFs are text evidence only (CLAUDE.md Rule 1). No LLM, no analysis.
* One failing issuer or report never stops the others.
"""
from __future__ import annotations

import logging
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.providers.newsweb_filing_provider import NewswebFilingProvider
from app.providers.object_storage import ObjectStorageProvider
from app.services.filings.newsweb_annual_report import (
    NewswebImportError,
    NewswebNothingFoundError,
    import_all_annual_reports_from_newsweb,
    import_all_interim_reports_from_newsweb,
)
from app.services.filings.newsweb_watch import watched_holdings
from app.services.job_status import read_job_run, record_job_run

log = logging.getLogger("aladdin.newsweb_report_fetch")

JOB_KEY = "newsweb_reports"


@dataclass
class ReportFetchResult:
    checked: int = 0
    imported: list[str] = field(default_factory=list)  # "TICKER: title"
    failed: list[str] = field(default_factory=list)  # "TICKER: reason"

    def summary(self) -> str:
        parts = [f"checked {self.checked} issuer(s)", f"{len(self.imported)} new report(s)"]
        if self.imported:
            parts.append(", ".join(self.imported[:3]))
        if self.failed:
            parts.append(f"{len(self.failed)} problem(s): {'; '.join(self.failed[:2])}")
        return "; ".join(parts)


def is_due(db: Session, *, now: datetime, interval_minutes: int) -> bool:
    """True when no pass has been recorded, or the last one is old enough."""
    if interval_minutes <= 0:
        return False
    last, _ = read_job_run(db, JOB_KEY)
    return last is None or now - last >= timedelta(minutes=interval_minutes)


def run_report_fetch(
    db: Session,
    provider: NewswebFilingProvider,
    storage: ObjectStorageProvider,
    *,
    lookback_days: int,
    pause_seconds: float = 0.0,
    now: datetime | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> ReportFetchResult:
    """One pass over all watched holdings. Never raises for a single issuer."""
    now = now or datetime.now(timezone.utc)
    since: date = (now - timedelta(days=lookback_days)).date()
    result = ReportFetchResult()
    importers = (import_all_annual_reports_from_newsweb, import_all_interim_reports_from_newsweb)
    for index, holding in enumerate(watched_holdings(db)):
        if index and pause_seconds > 0:
            sleep(pause_seconds)  # a public endpoint: be polite
        result.checked += 1
        for importer in importers:
            try:
                bulk = importer(db, holding, provider, storage, since=since)
            except NewswebNothingFoundError:
                continue
            except NewswebImportError as exc:
                db.rollback()
                result.failed.append(f"{holding.ticker}: {exc}"[:160])
                log.warning("newsweb report fetch: %s: %s", holding.ticker, exc)
                continue
            except Exception as exc:
                db.rollback()
                result.failed.append(f"{holding.ticker}: {type(exc).__name__}")
                log.exception("newsweb report fetch crashed for %s", holding.ticker)
                continue
            result.imported.extend(f"{holding.ticker}: {r.title}" for r in bulk.newly_imported)
            result.failed.extend(f"{holding.ticker}: {item}"[:160] for item in bulk.failed)
    record_job_run(db, JOB_KEY, result.summary(), now=now)
    return result
