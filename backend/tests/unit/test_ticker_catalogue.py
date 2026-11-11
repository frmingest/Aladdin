"""The Norwegian ticker catalogue behind Sal's shop (2026-11-11): rules, the yfinance provider (with a fake
screener, never Yahoo), the refresh service, the worker job and the status-page entry."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.config.settings import Settings
from app.domain.sectors import SECTORS
from app.domain.ticker_catalogue import (
    YAHOO_SECTORS,
    app_sector,
    is_oslo_symbol,
    size_band,
)
from app.models import Base
from app.models.ticker_catalogue import TickerCatalogueEntry
from app.providers.base import CatalogueFetch, CatalogueProvider, CatalogueRecord
from app.providers.yfinance_catalogue import PAGE_SIZE, YFinanceCatalogueProvider
from app.services import ticker_catalogue
from app.services.job_status import build_background_jobs
from tests.unit.test_sprint20_speed import _factory, _worker

NOW = datetime(2026, 11, 11, 12, tzinfo=timezone.utc)


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def rec(ticker: str, name: str = "", sector: str | None = "Energy", cap: int | None = 5_000_000_000) -> CatalogueRecord:
    return CatalogueRecord(
        ticker=ticker, name=name or ticker, exchange="OSL", currency="NOK",
        yahoo_sector=sector, market_cap=Decimal(cap) if cap is not None else None,
    )


# --- rules ------------------------------------------------------------------


def test_every_yahoo_sector_maps_to_an_app_sector():
    assert len(YAHOO_SECTORS) == 11
    for sector in YAHOO_SECTORS:
        assert app_sector(sector) in SECTORS


@pytest.mark.parametrize(
    ("yahoo", "ours"),
    [
        ("Basic Materials", "Materials"),
        ("Consumer Cyclical", "Consumer Discretionary"),
        ("Consumer Defensive", "Consumer Staples"),
        ("Financial Services", "Financials"),
        ("Healthcare", "Health Care"),
        ("Technology", "Information Technology"),
        ("Energy", "Energy"),
    ],
)
def test_sector_mapping(yahoo, ours):
    assert app_sector(yahoo) == ours


def test_an_unknown_or_missing_sector_stays_unclassified():
    assert app_sector(None) is None
    assert app_sector("") is None
    assert app_sector("Crypto Mining") is None


@pytest.mark.parametrize(
    ("cap", "currency", "band"),
    [
        (700_000_000_000, "NOK", "giant"),
        (50_000_000_000, "NOK", "giant"),  # lower bounds are inclusive
        (49_999_999_999, "NOK", "big"),
        (10_000_000_000, "NOK", "big"),
        (9_999_999_999, "NOK", "small"),
        (1_000_000_000, "NOK", "small"),
        (999_999_999, "NOK", "tiny"),
        (1, "NOK", "tiny"),
        (0, "NOK", "unknown"),
        (-5, "NOK", "unknown"),
        (None, "NOK", "unknown"),
        (700_000_000_000, "USD", "unknown"),  # no FX guess
        (700_000_000_000, None, "unknown"),
    ],
)
def test_size_band(cap, currency, band):
    assert size_band(cap, currency) == band


def test_oslo_symbols():
    assert is_oslo_symbol("EQNR.OL") and is_oslo_symbol(" dnb.ol ")
    assert not is_oslo_symbol(".OL") and not is_oslo_symbol("EQNR") and not is_oslo_symbol("VOLV-B.ST")
    assert not is_oslo_symbol(None)


# --- the yfinance provider, against a fake screener -------------------------


class FakeScreen:
    """Answers like yf.screen: {'quotes': [...], 'total': n}, per sector and page."""

    def __init__(self, by_sector: dict[str | None, list[dict]], fail: set[str | None] | None = None):
        self.by_sector = by_sector
        self.fail = fail or set()
        self.calls: list[tuple[str | None, int, int]] = []

    def __call__(self, sector, offset, size):
        self.calls.append((sector, offset, size))
        if sector in self.fail:
            raise RuntimeError("429 too many requests")
        rows = self.by_sector.get(sector, [])
        return {"quotes": rows[offset : offset + size], "total": len(rows)}


def quote(symbol, name="Co", cap=2_000_000_000, **extra):
    q = {"symbol": symbol, "longName": name, "currency": "NOK", "quoteType": "EQUITY", "marketCap": cap}
    q.update(extra)
    return q


def provider(screen) -> YFinanceCatalogueProvider:
    return YFinanceCatalogueProvider(screen=screen, sleep=lambda _s: None)


def test_the_provider_tags_each_company_with_the_sector_it_was_found_under():
    screen = FakeScreen(
        {
            "Energy": [quote("EQNR.OL", "Equinor ASA", 700_000_000_000), quote("AKRBP.OL", "Aker BP ASA")],
            "Financial Services": [quote("DNB.OL", "DNB Bank ASA")],
        }
    )
    fetch = provider(screen).fetch_oslo()
    assert fetch.complete and fetch.problems == []
    by = {r.ticker: r for r in fetch.records}
    assert by["EQNR.OL"].yahoo_sector == "Energy" and by["DNB.OL"].yahoo_sector == "Financial Services"
    assert by["EQNR.OL"].name == "Equinor ASA" and by["EQNR.OL"].market_cap == Decimal(700_000_000_000)
    assert {c[0] for c in screen.calls} == set(YAHOO_SECTORS) | {None}  # one query per sector plus the unfiltered pass


def test_companies_without_a_sector_arrive_unclassified_not_guessed():
    screen = FakeScreen({"Energy": [quote("EQNR.OL")], None: [quote("EQNR.OL"), quote("NOSECT.OL", "No Sector AS")]})
    by = {r.ticker: r for r in provider(screen).fetch_oslo().records}
    assert by["EQNR.OL"].yahoo_sector == "Energy"  # the sector-tagged copy wins
    assert by["NOSECT.OL"].yahoo_sector is None


def test_the_provider_keeps_only_oslo_equities():
    screen = FakeScreen(
        {
            "Energy": [
                quote("EQNR.OL"),
                quote("VOLV-B.ST"),  # another exchange
                quote("ETF1.OL", quoteType="ETF"),
                {"symbol": "", "longName": "blank"},
                {"longName": "no symbol"},
            ]
        }
    )
    assert [r.ticker for r in provider(screen).fetch_oslo().records] == ["EQNR.OL"]


def test_the_provider_reads_names_and_numbers_defensively():
    screen = FakeScreen(
        {
            "Energy": [
                {"symbol": "A.OL", "shortName": "  Short A  ", "marketCap": {"raw": 3_000_000_000, "fmt": "3B"}},
                {"symbol": "B.OL", "marketCap": "garbage", "currency": "nok"},
                {"symbol": "C.OL", "longName": "C", "marketCap": 0, "currency": "N"},
                {"symbol": "D.OL", "longName": "D", "marketCap": True},
            ]
        }
    )
    by = {r.ticker: r for r in provider(screen).fetch_oslo().records}
    assert by["A.OL"].name == "Short A" and by["A.OL"].market_cap == Decimal(3_000_000_000)
    assert by["B.OL"].name == "B" and by["B.OL"].market_cap is None and by["B.OL"].currency == "NOK"
    assert by["C.OL"].market_cap is None and by["C.OL"].currency == "NOK"  # zero is no value; a 1-letter code is not a currency
    assert by["D.OL"].market_cap is None


def test_the_provider_pages_through_a_big_sector():
    rows = [quote(f"S{i:04d}.OL") for i in range(PAGE_SIZE + 40)]
    screen = FakeScreen({"Industrials": rows})
    fetch = provider(screen).fetch_oslo()
    assert len(fetch.records) == PAGE_SIZE + 40
    industrials = [c for c in screen.calls if c[0] == "Industrials"]
    assert [c[1] for c in industrials] == [0, PAGE_SIZE]


def test_a_failed_sector_makes_the_fetch_incomplete_but_keeps_the_rest():
    screen = FakeScreen({"Energy": [quote("EQNR.OL")], "Healthcare": [quote("X.OL")]}, fail={"Healthcare"})
    fetch = provider(screen).fetch_oslo()
    assert not fetch.complete
    assert any("Healthcare" in p for p in fetch.problems)
    assert [r.ticker for r in fetch.records] == ["EQNR.OL"]


def test_a_request_is_retried_once():
    attempts = {"n": 0}

    def flaky(sector, offset, size):
        if sector == "Energy":
            attempts["n"] += 1
            if attempts["n"] == 1:
                raise RuntimeError("blip")
            return {"quotes": [quote("EQNR.OL")], "total": 1}
        return {"quotes": [], "total": 0}

    fetch = provider(flaky).fetch_oslo()
    assert fetch.complete and [r.ticker for r in fetch.records] == ["EQNR.OL"]


# --- the refresh service ----------------------------------------------------


def fetch_of(*records: CatalogueRecord, complete: bool = True, problems: list[str] | None = None) -> CatalogueFetch:
    return CatalogueFetch(records=list(records), complete=complete, problems=problems or [])


def entries(db) -> dict[str, TickerCatalogueEntry]:
    return {e.ticker: e for e in db.scalars(select(TickerCatalogueEntry))}


def test_first_fetch_fills_the_table_with_app_sectors(db):
    result = ticker_catalogue.apply_fetch(db, fetch_of(rec("EQNR.OL", "Equinor ASA"), rec("DNB.OL", sector="Financial Services")), now=NOW)
    assert result.saved and result.added == 2 and result.total_active == 2
    rows = entries(db)
    assert rows["EQNR.OL"].sector == "Energy" and rows["DNB.OL"].sector == "Financials"
    assert rows["DNB.OL"].yahoo_sector == "Financial Services" and rows["EQNR.OL"].active


def test_an_empty_fetch_changes_nothing(db):
    ticker_catalogue.apply_fetch(db, fetch_of(rec("EQNR.OL")), now=NOW)
    result = ticker_catalogue.apply_fetch(db, fetch_of(), now=NOW)
    assert not result.saved
    assert entries(db)["EQNR.OL"].active


def test_a_refresh_updates_values_but_never_overwrites_known_facts_with_missing(db):
    ticker_catalogue.apply_fetch(db, fetch_of(rec("EQNR.OL", "Equinor ASA", cap=700)), now=NOW)
    later = NOW + timedelta(days=7)
    result = ticker_catalogue.apply_fetch(db, fetch_of(rec("EQNR.OL", "Equinor ASA", sector=None, cap=None)), now=later)
    row = entries(db)["EQNR.OL"]
    assert row.sector == "Energy" and row.yahoo_sector == "Energy"  # kept
    assert row.market_cap == Decimal(700)  # kept
    assert row.last_seen_at.replace(tzinfo=timezone.utc) == later
    assert result.added == 0
    ticker_catalogue.apply_fetch(db, fetch_of(rec("EQNR.OL", "Equinor ASA", cap=900)), now=later)
    assert entries(db)["EQNR.OL"].market_cap == Decimal(900)


def test_a_company_missing_from_a_complete_fetch_is_retired_not_deleted(db):
    ticker_catalogue.apply_fetch(db, fetch_of(rec("A.OL"), rec("B.OL"), rec("C.OL")), now=NOW)
    result = ticker_catalogue.apply_fetch(db, fetch_of(rec("A.OL"), rec("B.OL")), now=NOW)
    assert result.deactivated == 1 and result.total_active == 2
    rows = entries(db)
    assert rows["C.OL"].active is False and "C.OL" in rows


def test_a_partial_fetch_retires_nothing(db):
    ticker_catalogue.apply_fetch(db, fetch_of(rec("A.OL"), rec("B.OL")), now=NOW)
    result = ticker_catalogue.apply_fetch(db, fetch_of(rec("A.OL"), complete=False, problems=["Energy: boom"]), now=NOW)
    assert result.deactivated == 0 and entries(db)["B.OL"].active


def test_a_suspiciously_small_complete_fetch_retires_nothing(db):
    many = [rec(f"T{i}.OL") for i in range(10)]
    ticker_catalogue.apply_fetch(db, fetch_of(*many), now=NOW)
    result = ticker_catalogue.apply_fetch(db, fetch_of(*many[:3]), now=NOW)  # 3 of 10 came back
    assert result.deactivated == 0 and result.total_active == 10
    assert any("none were retired" in p for p in result.problems)


def test_a_retired_company_that_returns_is_active_again(db):
    ticker_catalogue.apply_fetch(db, fetch_of(rec("A.OL"), rec("B.OL")), now=NOW)
    ticker_catalogue.apply_fetch(db, fetch_of(rec("A.OL")), now=NOW)
    ticker_catalogue.apply_fetch(db, fetch_of(rec("A.OL"), rec("B.OL")), now=NOW)
    assert entries(db)["B.OL"].active


def test_active_entries_are_biggest_first_and_unknown_values_last(db):
    ticker_catalogue.apply_fetch(
        db, fetch_of(rec("SMALL.OL", "Small", cap=5), rec("NOCAP.OL", "Zeta", cap=None), rec("BIG.OL", "Big", cap=50), rec("NOCAP2.OL", "Alpha", cap=None)), now=NOW
    )
    assert [e.ticker for e in ticker_catalogue.active_entries(db)] == ["BIG.OL", "SMALL.OL", "NOCAP2.OL", "NOCAP.OL"]


class FakeCatalogue(CatalogueProvider):
    name = "fake"

    def __init__(self, fetch: CatalogueFetch | Exception):
        self.fetch = fetch
        self.calls = 0

    def fetch_oslo(self) -> CatalogueFetch:
        self.calls += 1
        if isinstance(self.fetch, Exception):
            raise self.fetch
        return self.fetch


def test_refresh_records_a_success_only_for_a_complete_pass(db):
    ok = ticker_catalogue.refresh(db, FakeCatalogue(fetch_of(rec("A.OL"))), now=NOW)
    assert ok.saved and ticker_catalogue.last_success(db)[0] == NOW
    assert ticker_catalogue.last_problem(db)[0] is None

    later = NOW + timedelta(days=8)
    partial = ticker_catalogue.refresh(db, FakeCatalogue(fetch_of(rec("A.OL"), complete=False, problems=["Energy: boom"])), now=later)
    assert partial.saved and not partial.complete
    assert ticker_catalogue.last_success(db)[0] == NOW  # unchanged: not a success
    assert ticker_catalogue.last_problem(db)[0] == later


def test_refresh_never_raises(db):
    result = ticker_catalogue.refresh(db, FakeCatalogue(RuntimeError("yahoo is down")), now=NOW)
    assert not result.saved and "yahoo is down" in result.summary()
    assert ticker_catalogue.last_problem(db)[0] == NOW


def test_is_due(db):
    assert ticker_catalogue.is_due(db, interval_hours=168, now=NOW)  # empty
    ticker_catalogue.refresh(db, FakeCatalogue(fetch_of(rec("A.OL"))), now=NOW)
    assert not ticker_catalogue.is_due(db, interval_hours=168, now=NOW + timedelta(days=6))
    assert ticker_catalogue.is_due(db, interval_hours=168, now=NOW + timedelta(days=7, minutes=1))


def test_is_due_when_rows_exist_but_no_success_is_recorded(db):
    ticker_catalogue.apply_fetch(db, fetch_of(rec("A.OL")), now=NOW)  # e.g. a partial pass only
    assert ticker_catalogue.is_due(db, interval_hours=168, now=NOW)


# --- the worker job ---------------------------------------------------------


def worker_with(fake: FakeCatalogue, **settings):
    factory = _factory()
    worker = _worker(factory, ticker_catalogue_enabled=True, **settings)
    worker.providers.catalogue = fake
    return worker, factory


def test_the_worker_stocks_the_shelves_once_then_waits_for_the_interval():
    fake = FakeCatalogue(fetch_of(rec("EQNR.OL"), rec("DNB.OL", sector="Financial Services")))
    worker, factory = worker_with(fake)
    worker.maybe_refresh_ticker_catalogue()
    worker.maybe_refresh_ticker_catalogue()
    assert fake.calls == 1  # the second pass finds nothing due
    with factory() as db:
        assert set(entries(db)) == {"EQNR.OL", "DNB.OL"}


def test_a_failed_pass_is_retried_only_after_the_retry_delay():
    fake = FakeCatalogue(RuntimeError("blocked"))
    worker, _ = worker_with(fake, ticker_catalogue_retry_seconds=3600)
    worker.maybe_refresh_ticker_catalogue()
    worker.maybe_refresh_ticker_catalogue()  # the next poll
    assert fake.calls == 1
    worker._last_catalogue_attempt -= 3601
    worker.maybe_refresh_ticker_catalogue()
    assert fake.calls == 2


def test_the_worker_job_can_be_switched_off():
    fake = FakeCatalogue(fetch_of(rec("EQNR.OL")))
    factory = _factory()
    worker = _worker(factory, ticker_catalogue_enabled=False)
    worker.providers.catalogue = fake
    worker.maybe_refresh_ticker_catalogue()
    assert fake.calls == 0


def test_the_job_is_one_of_the_workers_background_jobs():
    worker, _f = worker_with(FakeCatalogue(fetch_of(rec("A.OL"))))
    assert "Oslo ticker catalogue" in [name for name, _job in worker._background_jobs()]


# --- the System status page entry ------------------------------------------


def _settings(**overrides) -> Settings:
    base = {"_env_file": None, "macro_data_provider": "none", "market_data_provider": "yfinance", "ticker_catalogue_enabled": True}
    base.update(overrides)
    return Settings(**base)


def job(db, *, online=False, now=NOW, **settings):
    jobs = {j.key: j for j in build_background_jobs(db, _settings(**settings), worker_online=online, now=now)}
    return jobs["ticker_catalogue"]


def test_status_before_the_first_run(db):
    assert job(db).status == "off" and "PC worker" in job(db).detail
    assert job(db, online=True).status == "warn"


def test_status_after_a_good_run_then_overdue(db):
    ticker_catalogue.refresh(db, FakeCatalogue(fetch_of(rec("A.OL"))), now=NOW)
    assert job(db).status == "ok" and "1 Oslo companies" in job(db).detail
    assert job(db, now=NOW + timedelta(days=15)).status == "warn"  # twice the weekly interval, and then some


def test_status_warns_after_a_problem_newer_than_the_last_success(db):
    ticker_catalogue.refresh(db, FakeCatalogue(fetch_of(rec("A.OL"))), now=NOW)
    ticker_catalogue.refresh(db, FakeCatalogue(RuntimeError("blocked")), now=NOW + timedelta(days=1))
    item = job(db, now=NOW + timedelta(days=1))
    assert item.status == "warn" and "blocked" in item.detail


def test_status_off_when_switched_off(db):
    assert job(db, ticker_catalogue_enabled=False).status == "off"
    assert job(db, market_data_provider="none").status == "off"
