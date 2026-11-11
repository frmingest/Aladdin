"""Automatic Newsweb report fetch (2026-11-11): a new quarterly report on a
watched holding is imported without anyone pressing a button, a repeat pass
downloads nothing, one failing issuer does not stop the others, and the job
shows on the System status page."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.config.settings import Settings
from app.models import Base, Document, Holding
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.providers.newsweb_filing_provider import (
    NewswebAnnualReportRef,
    NewswebAttachmentRef,
    NewswebFilingUnavailableError,
)
from app.providers.object_storage import LocalObjectStorageProvider
from app.services.filings.newsweb_report_fetch import is_due, run_report_fetch
from app.services.job_status import build_background_jobs, read_job_run

NOW = datetime(2026, 11, 11, 12, 0, tzinfo=timezone.utc)


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def _holding(db: Session, ticker: str, currency: str = "NOK") -> Holding:
    holding = Holding(
        ticker=ticker, name=f"{ticker} ASA", trading_currency=currency, sector="Energy", asset_class_raw="stock"
    )
    db.add(holding)
    db.commit()
    return holding


def _own(db: Session, holdings: list[Holding]) -> None:
    doc = Document(
        type="portfolio_csv", original_filename="p.csv", mime_type="text/csv", size_bytes=1,
        storage_path="p.csv", sha256="c" * 64, status="processed", quality_flags={},
    )
    db.add(doc)
    db.flush()
    snap = PortfolioSnapshot(source_file=doc, reporting_currency="NOK", status="processed")
    db.add(snap)
    db.flush()
    for holding in holdings:
        db.add(PortfolioPosition(snapshot_id=snap.id, holding_id=holding.id, quantity=Decimal(1)))
    db.commit()


def _pdf(text: str) -> bytes:
    import pymupdf

    doc = pymupdf.open()
    doc.new_page().insert_text((72, 72), text)
    content = doc.tobytes()
    doc.close()
    return content


def _ref(message_id: str, title: str) -> NewswebAnnualReportRef:
    return NewswebAnnualReportRef(
        message_id=message_id,
        message_url=f"https://newsweb.oslobors.no/message/{message_id}",
        title=title,
        published_at=NOW - timedelta(days=21),
        attachments=[
            NewswebAttachmentRef(f"{message_id}1", "Presentation Q3 2026.pdf"),
            NewswebAttachmentRef(f"{message_id}2", "Report Q3 2026.pdf"),
        ],
    )


class FakeFiling:
    """interim[ticker sign] is a list of refs or an exception; same for annual."""

    def __init__(self, interim=None, annual=None):
        self.interim = interim or {}
        self.annual = annual or {}
        self.downloads: list[tuple[str, str]] = []
        self.since: list = []

    @staticmethod
    def _get(table, sign):
        value = table.get(sign, [])
        if isinstance(value, Exception):
            raise value
        return value

    def list_annual_reports(self, issuer_sign, *, since, today=None):
        self.since.append(since)
        return self._get(self.annual, issuer_sign)

    def list_interim_reports(self, issuer_sign, *, since, today=None):
        self.since.append(since)
        return self._get(self.interim, issuer_sign)

    def download_attachment(self, message_id, attachment_id):
        self.downloads.append((message_id, attachment_id))
        return _pdf(f"report {message_id}")


@pytest.fixture()
def storage(tmp_path) -> LocalObjectStorageProvider:
    return LocalObjectStorageProvider(str(tmp_path))


def test_a_new_quarterly_report_is_imported_once_and_skipped_on_the_next_pass(storage) -> None:
    db = _session()
    holding = _holding(db, "VAR.OL")
    _own(db, [holding])
    provider = FakeFiling(interim={"VAR": [_ref("700001", "Vår Energi reports strong financial results")]})

    first = run_report_fetch(db, provider, storage, lookback_days=60, now=NOW)
    assert first.checked == 1 and len(first.imported) == 1 and first.failed == []
    assert provider.downloads == [("700001", "7000012")]  # the report, not the presentation
    docs = db.scalars(select(Document).where(Document.holding_id == holding.id)).all()
    assert [d.type for d in docs] == ["quarterly_report"]
    assert docs[0].quality_flags["newsweb_source"]["message_id"] == "700001"

    second = run_report_fetch(db, provider, storage, lookback_days=60, now=NOW + timedelta(hours=6))
    assert second.imported == [] and len(provider.downloads) == 1  # nothing downloaded twice
    assert len(db.scalars(select(Document).where(Document.holding_id == holding.id)).all()) == 1


def test_the_window_is_the_lookback_not_the_full_history(storage) -> None:
    db = _session()
    _own(db, [_holding(db, "VAR.OL")])
    provider = FakeFiling()
    run_report_fetch(db, provider, storage, lookback_days=60, now=NOW)
    assert set(provider.since) == {(NOW - timedelta(days=60)).date()}


def test_nothing_in_the_window_is_not_a_failure(storage) -> None:
    db = _session()
    _own(db, [_holding(db, "EQNR.OL")])
    result = run_report_fetch(db, FakeFiling(), storage, lookback_days=60, now=NOW)
    assert (result.checked, result.imported, result.failed) == (1, [], [])
    when, summary = read_job_run(db, "newsweb_reports")
    assert when == NOW and "0 new report(s)" in (summary or "")


def test_one_failing_issuer_does_not_stop_the_others(storage) -> None:
    db = _session()
    a, b = _holding(db, "AKRBP.OL"), _holding(db, "VAR.OL")
    _own(db, [a, b])
    provider = FakeFiling(
        interim={
            "AKRBP": NewswebFilingUnavailableError("HTTP 503"),
            "VAR": [_ref("700001", "Q3 2026")],
        }
    )
    result = run_report_fetch(db, provider, storage, lookback_days=60, now=NOW)
    assert len(result.imported) == 1 and result.imported[0].startswith("VAR.OL")
    assert len(result.failed) == 1 and result.failed[0].startswith("AKRBP.OL")
    assert "1 problem(s)" in result.summary()


def test_only_watched_oslo_holdings_are_fetched(storage) -> None:
    db = _session()
    own = _holding(db, "VAR.OL")
    _holding(db, "NHY.OL")  # neither owned nor on the watchlist
    us = _holding(db, "AAPL", currency="USD")
    _own(db, [own, us])
    provider = FakeFiling()
    result = run_report_fetch(db, provider, storage, lookback_days=60, now=NOW)
    assert result.checked == 1


def test_pause_between_issuers_is_applied(storage) -> None:
    db = _session()
    a, b = _holding(db, "AKRBP.OL"), _holding(db, "VAR.OL")
    _own(db, [a, b])
    sleeps: list[float] = []
    run_report_fetch(db, FakeFiling(), storage, lookback_days=60, pause_seconds=2.0, now=NOW, sleep=sleeps.append)
    assert sleeps == [2.0]


def test_is_due_follows_the_interval_and_zero_means_off(storage) -> None:
    db = _session()
    assert is_due(db, now=NOW, interval_minutes=360)  # never ran
    assert not is_due(db, now=NOW, interval_minutes=0)
    _own(db, [_holding(db, "VAR.OL")])
    run_report_fetch(db, FakeFiling(), storage, lookback_days=60, now=NOW)
    assert not is_due(db, now=NOW + timedelta(hours=5), interval_minutes=360)
    assert is_due(db, now=NOW + timedelta(hours=6), interval_minutes=360)


def test_system_status_reports_the_job(storage) -> None:
    db = _session()
    off = Settings(_env_file=None, newsweb_report_fetch_interval_minutes=0)
    job = {j.key: j for j in build_background_jobs(db, off, worker_online=False, now=NOW)}["newsweb_reports"]
    assert job.status == "off"

    on = Settings(_env_file=None, newsweb_report_fetch_interval_minutes=360)
    job = {j.key: j for j in build_background_jobs(db, on, worker_online=False, now=NOW)}["newsweb_reports"]
    assert job.status == "warn" and "not run yet" in job.detail

    _own(db, [_holding(db, "VAR.OL")])
    run_report_fetch(db, FakeFiling(), storage, lookback_days=60, now=NOW)
    job = {j.key: j for j in build_background_jobs(db, on, worker_online=False, now=NOW)}["newsweb_reports"]
    assert job.status == "ok" and job.schedule == "every 6 h"
    late = NOW + timedelta(hours=19)
    job = {j.key: j for j in build_background_jobs(db, on, worker_online=False, now=late)}["newsweb_reports"]
    assert job.status == "warn" and "Overdue" in job.detail
