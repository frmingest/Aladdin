"""Newsweb background watch (2026-10-28): which holdings are watched, the
first-look baseline, new-message detection, failure isolation, acknowledge."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.config.settings import Settings
from app.models import Base, Document, Holding
from app.models.newsweb_announcement import NewswebAnnouncement
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.models.watchlist import WatchlistItem
from app.providers.base import ResearchItem, ResearchUnavailableError
from app.services.filings.newsweb_watch import (
    acknowledge,
    list_unread,
    message_id_from_url,
    run_watch,
    watched_holdings,
)
from app.services.job_status import build_background_jobs, read_job_run

NOW = datetime(2026, 10, 28, 12, 0, tzinfo=timezone.utc)


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


def _item(message_id: str, title: str = "Q3 report") -> ResearchItem:
    return ResearchItem(
        source_url=f"https://newsweb.oslobors.no/message/{message_id}",
        source_name="Oslo Børs Newsweb",
        title=title,
        summary="Regulated announcement.",
        source_type="regulatory_announcement",
        retrieved_at=NOW,
        published_at=NOW - timedelta(days=1),
    )


class FakeProvider:
    def __init__(self, by_ticker: dict[str, list[ResearchItem] | Exception]) -> None:
        self.by_ticker = by_ticker
        self.calls: list[str] = []

    def get_announcements(self, ticker: str):
        self.calls.append(ticker)
        value = self.by_ticker[ticker]
        if isinstance(value, Exception):
            raise value
        return value


def test_message_id_from_url() -> None:
    assert message_id_from_url("https://newsweb.oslobors.no/message/654321") == "654321"


def test_watched_holdings_are_owned_plus_watchlist_oslo_only_once_each() -> None:
    db = _session()
    owned = _holding(db, "EQNR.OL")
    watched = _holding(db, "KOG.OL")
    both = _holding(db, "DNB.OL")
    us = _holding(db, "AAPL", currency="USD")
    _holding(db, "NHY.OL")  # neither owned nor watched
    _own(db, [owned, both, us])
    db.add_all([WatchlistItem(holding_id=watched.id), WatchlistItem(holding_id=both.id)])
    db.commit()
    assert [h.ticker for h in watched_holdings(db)] == ["DNB.OL", "EQNR.OL", "KOG.OL"]


def test_first_look_is_a_baseline_then_only_new_messages_are_unread() -> None:
    db = _session()
    holding = _holding(db, "EQNR.OL")
    _own(db, [holding])
    provider = FakeProvider({"EQNR.OL": [_item("1"), _item("2")]})

    first = run_watch(db, provider, now=NOW)
    assert (first.checked, first.new_items, first.baselined) == (1, 0, 2)
    assert list_unread(db) == []

    provider.by_ticker["EQNR.OL"] = [_item("3", "Insider trade"), _item("2"), _item("1")]
    second = run_watch(db, provider, now=NOW + timedelta(hours=1))
    assert (second.new_items, second.baselined) == (1, 0)
    unread = list_unread(db)
    assert [(a.message_id, h.ticker) for a, h in unread] == [("3", "EQNR.OL")]

    third = run_watch(db, provider, now=NOW + timedelta(hours=2))
    assert third.new_items == 0  # nothing is double-counted
    assert len(db.scalars(select(NewswebAnnouncement)).all()) == 3


def test_one_failing_issuer_does_not_stop_the_others_and_is_reported() -> None:
    db = _session()
    a, b = _holding(db, "AKRBP.OL"), _holding(db, "EQNR.OL")
    _own(db, [a, b])
    provider = FakeProvider({"AKRBP.OL": ResearchUnavailableError("HTTP 503"), "EQNR.OL": [_item("9")]})
    result = run_watch(db, provider, now=NOW)
    assert result.checked == 1 and result.failed == ["AKRBP.OL"]
    assert "failed: AKRBP.OL" in result.summary()
    when, summary = read_job_run(db, "newsweb_watch")
    assert when == NOW and "failed: AKRBP.OL" in (summary or "")


def test_a_failed_first_look_is_retried_as_a_baseline_not_flagged_new() -> None:
    db = _session()
    holding = _holding(db, "EQNR.OL")
    _own(db, [holding])
    provider = FakeProvider({"EQNR.OL": ResearchUnavailableError("down")})
    run_watch(db, provider, now=NOW)
    provider.by_ticker["EQNR.OL"] = [_item("1"), _item("2")]
    result = run_watch(db, provider, now=NOW + timedelta(hours=1))
    assert result.new_items == 0 and result.baselined == 2
    assert list_unread(db) == []


def test_acknowledge_all_or_one_holding() -> None:
    db = _session()
    a, b = _holding(db, "AKRBP.OL"), _holding(db, "EQNR.OL")
    _own(db, [a, b])
    provider = FakeProvider({"AKRBP.OL": [_item("1")], "EQNR.OL": [_item("2")]})
    run_watch(db, provider, now=NOW)
    provider.by_ticker = {"AKRBP.OL": [_item("1"), _item("10")], "EQNR.OL": [_item("2"), _item("20")]}
    run_watch(db, provider, now=NOW + timedelta(hours=1))
    assert len(list_unread(db)) == 2
    assert acknowledge(db, holding_id=a.id, now=NOW) == 1
    assert [h.ticker for _, h in list_unread(db)] == ["EQNR.OL"]
    assert acknowledge(db, now=NOW) == 1
    assert list_unread(db) == []


def test_pause_between_issuers_is_applied() -> None:
    db = _session()
    a, b, c = _holding(db, "AKRBP.OL"), _holding(db, "DNB.OL"), _holding(db, "EQNR.OL")
    _own(db, [a, b, c])
    provider = FakeProvider({"AKRBP.OL": [], "DNB.OL": [], "EQNR.OL": []})
    sleeps: list[float] = []
    run_watch(db, provider, pause_seconds=1.5, now=NOW, sleep=sleeps.append)
    assert sleeps == [1.5, 1.5]


def test_system_status_reports_the_watch() -> None:
    db = _session()
    off = Settings(_env_file=None, newsweb_watch_interval_minutes=0)
    job = {j.key: j for j in build_background_jobs(db, off, worker_online=False, now=NOW)}["newsweb_watch"]
    assert job.status == "off"

    on = Settings(_env_file=None, newsweb_watch_interval_minutes=60)
    job = {j.key: j for j in build_background_jobs(db, on, worker_online=False, now=NOW)}["newsweb_watch"]
    assert job.status == "warn" and "not run yet" in job.detail

    _holding(db, "EQNR.OL")
    run_watch(db, FakeProvider({}), now=NOW)
    job = {j.key: j for j in build_background_jobs(db, on, worker_online=False, now=NOW)}["newsweb_watch"]
    assert job.status == "ok"
    late = NOW + timedelta(hours=4)
    job = {j.key: j for j in build_background_jobs(db, on, worker_online=False, now=late)}["newsweb_watch"]
    assert job.status == "warn" and "Overdue" in job.detail
