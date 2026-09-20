"""
Unit tests for app.services.research.macro / .sector — the refresh/read
service layer (§26 Phase 4, §2.7 caching, §21 partial-failure handling).
Exercises against a throwaway SQLite session and hand-written fake
MacroDataProvider/ResearchProvider implementations, independent of any real
vendor (§22).
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401 — populates Base.metadata before create_all
from app.config.database import Base
from app.config.settings import Settings
from app.models.holding import Holding
from app.models.research import ResearchRun, ResearchRunStatus, ResearchRunType
from app.providers.base import (
    MacroDataProvider,
    MacroDataUnavailableError,
    MacroSeriesPoint,
    ResearchItem,
    ResearchProvider,
    ResearchUnavailableError,
)
from app.services.research.company import get_latest_company_research, refresh_company_research
from app.services.research.macro import get_latest_macro_snapshot, refresh_macro_snapshot
from app.services.research.sector import get_latest_sector_research, refresh_sector_research


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = session_factory()
    yield session
    session.close()
    engine.dispose()


def _settings(**overrides):
    defaults = dict(
        macro_refresh_interval_hours=24,
        sector_research_refresh_interval_days=7,
        company_research_refresh_interval_days=3,
        research_max_grounded_items=8,
        active_macro_series_version="v1",
        active_research_prompt_version="v1",
    )
    defaults.update(overrides)
    return Settings(**defaults)


def _make_holding(db, ticker="VAR.OL", name="Vår Energi", sector="Energy"):
    holding = Holding(
        ticker=ticker,
        name=name,
        asset_class="EQUITY",
        asset_class_raw="Aksje",
        sector=sector,
        trading_currency="NOK",
    )
    db.add(holding)
    db.commit()
    return holding


class _FakeMacroProvider(MacroDataProvider):
    def __init__(self, points_by_key=None, fail_keys=()):
        self._points_by_key = points_by_key or {}
        self._fail_keys = set(fail_keys)

    def get_latest(self, series_key):
        if series_key in self._fail_keys or series_key not in self._points_by_key:
            raise MacroDataUnavailableError(series_key, "not available in fake")
        return self._points_by_key[series_key]

    def get_series(self, series_key, start, end):
        return [self.get_latest(series_key)]


class _FakeResearchProvider(ResearchProvider):
    def __init__(
        self,
        macro_items=None,
        sector_items=None,
        company_items=None,
        fail_macro=False,
        fail_sector=False,
        fail_company=False,
    ):
        self._macro_items = macro_items or []
        self._sector_items = sector_items or []
        self._company_items = company_items or []
        self._fail_macro = fail_macro
        self._fail_sector = fail_sector
        self._fail_company = fail_company

    def get_macro_snapshot(self):
        if self._fail_macro:
            raise ResearchUnavailableError("fake narrative failure")
        return self._macro_items

    def get_sector_research(self, sector):
        if self._fail_sector:
            raise ResearchUnavailableError("fake sector research failure")
        return self._sector_items

    def get_company_research(self, company_name, ticker, sector):
        if self._fail_company:
            raise ResearchUnavailableError("fake company research failure")
        return self._company_items


def _point(series_key="us_policy_rate", value="5.33", region="US", provider="fred"):
    return MacroSeriesPoint(
        series_key=series_key,
        value=Decimal(value),
        unit="percent",
        observed_at=datetime(2026, 9, 1, tzinfo=timezone.utc),
        provider=provider,
        region=region,
    )


def _item(url="https://example.com/1", source_type="macro_news"):
    return ResearchItem(
        source_url=url,
        source_name="example.com",
        title="Some headline",
        summary="Some summary text.",
        source_type=source_type,
        published_at=None,
        retrieved_at=datetime.now(timezone.utc),
    )


# --- macro ---


def test_refresh_macro_snapshot_completed_when_everything_succeeds(db):
    from app.domain.macro_series import load_macro_series_registry

    registry = load_macro_series_registry("v1")
    points = {key: _point(series_key=key) for key in registry.series}
    macro_provider = _FakeMacroProvider(points_by_key=points)
    research_provider = _FakeResearchProvider(macro_items=[_item()])

    run = refresh_macro_snapshot(db, macro_provider, research_provider, force=True, settings=_settings())

    assert run.status == ResearchRunStatus.COMPLETED.value
    assert run.type == ResearchRunType.MACRO.value
    assert len(run.items) == 1


def test_refresh_macro_snapshot_partial_when_some_series_fail(db):
    from app.domain.macro_series import load_macro_series_registry

    registry = load_macro_series_registry("v1")
    keys = list(registry.series)
    points = {key: _point(series_key=key) for key in keys[:-1]}
    macro_provider = _FakeMacroProvider(points_by_key=points, fail_keys=[keys[-1]])
    research_provider = _FakeResearchProvider(macro_items=[_item()])

    run = refresh_macro_snapshot(db, macro_provider, research_provider, force=True, settings=_settings())

    assert run.status == ResearchRunStatus.PARTIAL.value
    assert run.error_message is not None


def test_refresh_macro_snapshot_failed_when_everything_fails(db):
    macro_provider = _FakeMacroProvider(points_by_key={})
    research_provider = _FakeResearchProvider(fail_macro=True)

    run = refresh_macro_snapshot(db, macro_provider, research_provider, force=True, settings=_settings())

    assert run.status == ResearchRunStatus.FAILED.value


def test_refresh_macro_snapshot_skips_when_recent_run_not_stale(db):
    settings = _settings()
    existing = ResearchRun(
        type=ResearchRunType.MACRO.value,
        sector=None,
        status=ResearchRunStatus.COMPLETED.value,
        methodology_version="v1",
        completed_at=datetime.now(timezone.utc),
    )
    db.add(existing)
    db.commit()

    macro_provider = _FakeMacroProvider(points_by_key={})

    def _boom(*a, **k):
        raise AssertionError("should not call the provider when the cache is fresh")

    macro_provider.get_latest = _boom  # type: ignore[method-assign]
    research_provider = _FakeResearchProvider()
    research_provider.get_macro_snapshot = lambda: (_ for _ in ()).throw(  # noqa: E731
        AssertionError("should not call research provider either")
    )

    run = refresh_macro_snapshot(db, macro_provider, research_provider, force=False, settings=settings)

    assert run.id == existing.id


def test_refresh_macro_snapshot_force_bypasses_freshness(db):
    settings = _settings()
    existing = ResearchRun(
        type=ResearchRunType.MACRO.value,
        sector=None,
        status=ResearchRunStatus.COMPLETED.value,
        methodology_version="v1",
        completed_at=datetime.now(timezone.utc),
    )
    db.add(existing)
    db.commit()

    from app.domain.macro_series import load_macro_series_registry

    registry = load_macro_series_registry("v1")
    points = {key: _point(series_key=key) for key in registry.series}
    macro_provider = _FakeMacroProvider(points_by_key=points)
    research_provider = _FakeResearchProvider(macro_items=[_item()])

    run = refresh_macro_snapshot(db, macro_provider, research_provider, force=True, settings=settings)

    assert run.id != existing.id


def test_get_latest_macro_snapshot_unavailable_when_nothing_on_record(db):
    snapshot = get_latest_macro_snapshot(db)

    assert snapshot.available is False
    assert snapshot.observations == []


def test_get_latest_macro_snapshot_available_after_refresh(db):
    from app.domain.macro_series import load_macro_series_registry

    registry = load_macro_series_registry("v1")
    points = {key: _point(series_key=key) for key in registry.series}
    macro_provider = _FakeMacroProvider(points_by_key=points)
    research_provider = _FakeResearchProvider(macro_items=[_item()])
    refresh_macro_snapshot(db, macro_provider, research_provider, force=True, settings=_settings())

    snapshot = get_latest_macro_snapshot(db)

    assert snapshot.available is True
    assert len(snapshot.observations) == len(registry.series)
    assert len(snapshot.narrative_items) == 1


def test_grounded_items_are_capped_at_research_max_grounded_items(db):
    from app.domain.macro_series import load_macro_series_registry

    registry = load_macro_series_registry("v1")
    points = {key: _point(series_key=key) for key in registry.series}
    macro_provider = _FakeMacroProvider(points_by_key=points)
    many_items = [_item(url=f"https://example.com/{i}") for i in range(10)]
    research_provider = _FakeResearchProvider(macro_items=many_items)

    run = refresh_macro_snapshot(
        db, macro_provider, research_provider, force=True, settings=_settings(research_max_grounded_items=3)
    )

    assert len(run.items) == 3


# --- sector ---


def test_refresh_sector_research_completed(db):
    research_provider = _FakeResearchProvider(sector_items=[_item(source_type="sector_research")])

    run = refresh_sector_research(db, research_provider, "Energy", force=True, settings=_settings())

    assert run.status == ResearchRunStatus.COMPLETED.value
    assert run.sector == "Energy"
    assert len(run.items) == 1


def test_refresh_sector_research_failed_when_provider_raises(db):
    research_provider = _FakeResearchProvider(fail_sector=True)

    run = refresh_sector_research(db, research_provider, "Energy", force=True, settings=_settings())

    assert run.status == ResearchRunStatus.FAILED.value
    assert run.error_message is not None


def test_refresh_sector_research_skips_when_recent_run_not_stale(db):
    existing = ResearchRun(
        type=ResearchRunType.SECTOR.value,
        sector="Energy",
        status=ResearchRunStatus.COMPLETED.value,
        methodology_version="v1",
        completed_at=datetime.now(timezone.utc),
    )
    db.add(existing)
    db.commit()

    research_provider = _FakeResearchProvider()
    research_provider.get_sector_research = lambda sector: (_ for _ in ()).throw(  # noqa: E731
        AssertionError("should not call the provider when the cache is fresh")
    )

    run = refresh_sector_research(db, research_provider, "Energy", force=False, settings=_settings())

    assert run.id == existing.id


def test_refresh_sector_research_is_scoped_per_sector(db):
    research_provider = _FakeResearchProvider(sector_items=[_item()])
    refresh_sector_research(db, research_provider, "Energy", force=True, settings=_settings())

    # A stale-check for a *different* sector must not be satisfied by
    # Energy's fresh run.
    run = refresh_sector_research(db, research_provider, "Healthcare", force=False, settings=_settings())

    assert run.sector == "Healthcare"


def test_get_latest_sector_research_unavailable_when_nothing_on_record(db):
    view = get_latest_sector_research(db, "Energy")

    assert view.available is False
    assert view.sector == "Energy"


def test_get_latest_sector_research_available_after_refresh(db):
    research_provider = _FakeResearchProvider(sector_items=[_item()])
    refresh_sector_research(db, research_provider, "Energy", force=True, settings=_settings())

    view = get_latest_sector_research(db, "Energy")

    assert view.available is True
    assert len(view.items) == 1


def test_sector_items_are_capped_at_research_max_grounded_items(db):
    many_items = [_item(url=f"https://example.com/{i}") for i in range(10)]
    research_provider = _FakeResearchProvider(sector_items=many_items)

    run = refresh_sector_research(
        db, research_provider, "Energy", force=True, settings=_settings(research_max_grounded_items=4)
    )

    assert len(run.items) == 4


def test_is_stale_treats_completed_run_as_stale_after_max_age(db):
    from app.services.research.common import is_stale

    stale_run = ResearchRun(
        type=ResearchRunType.MACRO.value,
        status=ResearchRunStatus.COMPLETED.value,
        methodology_version="v1",
        completed_at=datetime.now(timezone.utc) - timedelta(hours=48),
    )

    assert is_stale(stale_run, timedelta(hours=24)) is True
    assert is_stale(None, timedelta(hours=24)) is True


# --- company (Phase 11 Sprint 2) ---


def test_refresh_company_research_completed(db):
    holding = _make_holding(db)
    research_provider = _FakeResearchProvider(company_items=[_item(source_type="company_research")])

    run = refresh_company_research(db, research_provider, holding, force=True, settings=_settings())

    assert run.status == ResearchRunStatus.COMPLETED.value
    assert run.type == ResearchRunType.COMPANY.value
    assert run.holding_id == holding.id
    assert len(run.items) == 1


def test_refresh_company_research_failed_when_provider_raises(db):
    holding = _make_holding(db)
    research_provider = _FakeResearchProvider(fail_company=True)

    run = refresh_company_research(db, research_provider, holding, force=True, settings=_settings())

    assert run.status == ResearchRunStatus.FAILED.value
    assert run.error_message is not None


def test_refresh_company_research_skips_when_recent_run_not_stale(db):
    holding = _make_holding(db)
    existing = ResearchRun(
        type=ResearchRunType.COMPANY.value,
        holding_id=holding.id,
        status=ResearchRunStatus.COMPLETED.value,
        methodology_version="v1",
        completed_at=datetime.now(timezone.utc),
    )
    db.add(existing)
    db.commit()

    research_provider = _FakeResearchProvider()
    research_provider.get_company_research = lambda company_name, ticker, sector: (_ for _ in ()).throw(  # noqa: E731
        AssertionError("should not call the provider when the cache is fresh")
    )

    run = refresh_company_research(db, research_provider, holding, force=False, settings=_settings())

    assert run.id == existing.id


def test_refresh_company_research_force_bypasses_freshness(db):
    holding = _make_holding(db)
    existing = ResearchRun(
        type=ResearchRunType.COMPANY.value,
        holding_id=holding.id,
        status=ResearchRunStatus.COMPLETED.value,
        methodology_version="v1",
        completed_at=datetime.now(timezone.utc),
    )
    db.add(existing)
    db.commit()

    research_provider = _FakeResearchProvider(company_items=[_item()])

    run = refresh_company_research(db, research_provider, holding, force=True, settings=_settings())

    assert run.id != existing.id


def test_refresh_company_research_is_scoped_per_holding(db):
    holding_a = _make_holding(db, ticker="VAR.OL", name="Vår Energi")
    holding_b = _make_holding(db, ticker="EQNR.OL", name="Equinor")
    research_provider = _FakeResearchProvider(company_items=[_item()])

    refresh_company_research(db, research_provider, holding_a, force=True, settings=_settings())

    # A stale-check for a *different* holding must not be satisfied by
    # holding_a's fresh run.
    run = refresh_company_research(db, research_provider, holding_b, force=False, settings=_settings())

    assert run.holding_id == holding_b.id


def test_get_latest_company_research_unavailable_when_nothing_on_record(db):
    holding = _make_holding(db)

    view = get_latest_company_research(db, holding.id, holding.ticker)

    assert view.available is False
    assert view.ticker == "VAR.OL"


def test_get_latest_company_research_available_after_refresh(db):
    holding = _make_holding(db)
    research_provider = _FakeResearchProvider(company_items=[_item(source_type="company_research")])
    refresh_company_research(db, research_provider, holding, force=True, settings=_settings())

    view = get_latest_company_research(db, holding.id, holding.ticker)

    assert view.available is True
    assert len(view.items) == 1


def test_company_items_are_capped_at_research_max_grounded_items(db):
    holding = _make_holding(db)
    many_items = [_item(url=f"https://example.com/{i}") for i in range(10)]
    research_provider = _FakeResearchProvider(company_items=many_items)

    run = refresh_company_research(
        db, research_provider, holding, force=True, settings=_settings(research_max_grounded_items=4)
    )

    assert len(run.items) == 4


def test_company_research_calls_provider_with_holding_fields(db):
    holding = _make_holding(db, ticker="VAR.OL", name="Vår Energi", sector="Energy")
    seen = {}

    research_provider = _FakeResearchProvider(company_items=[_item()])

    def _capture(company_name, ticker, sector):
        seen["company_name"] = company_name
        seen["ticker"] = ticker
        seen["sector"] = sector
        return [_item()]

    research_provider.get_company_research = _capture

    refresh_company_research(db, research_provider, holding, force=True, settings=_settings())

    assert seen == {"company_name": "Vår Energi", "ticker": "VAR.OL", "sector": "Energy"}

