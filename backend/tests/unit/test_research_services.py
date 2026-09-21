"""Unit tests for app/services/research/{common,macro,sector,company}.py's
staleness-check/caching/refresh logic, against an in-memory SQLite DB and a
fake ResearchProvider (no real network/Gemini calls)."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, Holding
from app.models.research import ResearchRun, ResearchRunStatus, ResearchRunType
from app.providers.base import ResearchItem, ResearchUnavailableError
from app.services.research.company import get_company_research
from app.services.research.macro import get_macro_research
from app.services.research.sector import get_sector_research


class _FakeProvider:
    """Returns canned items, or raises, per test — never touches a network."""

    def __init__(self, items=None, error: Exception | None = None):
        self._items = items if items is not None else []
        self._error = error
        self.calls = 0

    def _respond(self):
        self.calls += 1
        if self._error is not None:
            raise self._error
        return self._items

    def get_macro_research(self):
        return self._respond()

    def get_sector_research(self, sector: str):
        return self._respond()

    def get_company_research(self, *, company_name, ticker, sector):
        return self._respond()


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def _item(url="https://example.com/1", summary="finding") -> ResearchItem:
    return ResearchItem(
        source_url=url,
        source_name="example.com",
        title="A finding",
        summary=summary,
        source_type="macro_news",
        retrieved_at=datetime.now(timezone.utc),
    )


def test_macro_research_calls_provider_and_persists_a_completed_run_when_no_cache_exists():
    with _session() as db:
        provider = _FakeProvider(items=[_item()])
        snapshot = get_macro_research(db, provider)

        assert provider.calls == 1
        assert snapshot.available is True
        assert len(snapshot.items) == 1
        assert snapshot.items[0].source_url == "https://example.com/1"

        run = db.query(ResearchRun).one()
        assert run.type == ResearchRunType.MACRO.value
        assert run.status == ResearchRunStatus.COMPLETED.value


def test_macro_research_serves_cache_without_calling_provider_when_fresh():
    with _session() as db:
        provider = _FakeProvider(items=[_item()])
        get_macro_research(db, provider)  # first call populates the cache
        assert provider.calls == 1

        snapshot = get_macro_research(db, provider)  # second call: still fresh
        assert provider.calls == 1  # provider NOT called again
        assert snapshot.available is True
        assert len(snapshot.items) == 1


def test_macro_research_refreshes_when_stale():
    with _session() as db:
        provider = _FakeProvider(items=[_item()])
        get_macro_research(db, provider)

        # Backdate the run's completed_at well past the staleness window.
        run = db.query(ResearchRun).one()
        run.completed_at = datetime.now(timezone.utc) - timedelta(hours=999)
        db.commit()

        snapshot = get_macro_research(db, provider)
        assert provider.calls == 2
        assert snapshot.available is True


def test_force_refresh_bypasses_a_fresh_cache():
    with _session() as db:
        provider = _FakeProvider(items=[_item()])
        get_macro_research(db, provider)
        assert provider.calls == 1

        get_macro_research(db, provider, force=True)
        assert provider.calls == 2


def test_provider_failure_with_no_prior_cache_returns_unavailable_and_persists_failed_run():
    with _session() as db:
        provider = _FakeProvider(error=ResearchUnavailableError("quota exhausted"))
        snapshot = get_macro_research(db, provider)

        assert snapshot.available is False
        assert snapshot.items == []
        assert "quota exhausted" in (snapshot.reason or "")

        run = db.query(ResearchRun).one()
        assert run.status == ResearchRunStatus.FAILED.value
        assert "quota exhausted" in run.error_message


def test_provider_failure_falls_back_to_stale_cache_instead_of_losing_data():
    with _session() as db:
        good_provider = _FakeProvider(items=[_item(url="https://example.com/good")])
        get_macro_research(db, good_provider)
        run = db.query(ResearchRun).filter_by(status=ResearchRunStatus.COMPLETED.value).one()
        run.completed_at = datetime.now(timezone.utc) - timedelta(hours=999)
        db.commit()

        failing_provider = _FakeProvider(error=ResearchUnavailableError("Gemini is down"))
        snapshot = get_macro_research(db, failing_provider)

        assert snapshot.available is True  # still returns the cached data
        assert len(snapshot.items) == 1
        assert snapshot.items[0].source_url == "https://example.com/good"
        assert snapshot.reason is not None and "Gemini is down" in snapshot.reason

        # And a real FAILED run was still persisted -- CLAUDE.md: fail visibly.
        failed_runs = db.query(ResearchRun).filter_by(status=ResearchRunStatus.FAILED.value).all()
        assert len(failed_runs) == 1


def test_sector_research_is_scoped_per_sector_independently():
    with _session() as db:
        provider = _FakeProvider(items=[_item()])
        get_sector_research(db, provider, sector="Energy")
        get_sector_research(db, provider, sector="Technology")
        assert provider.calls == 2  # two distinct sectors, no shared cache

        get_sector_research(db, provider, sector="Energy")  # still fresh
        assert provider.calls == 2

        runs = db.query(ResearchRun).all()
        assert {r.sector for r in runs} == {"Energy", "Technology"}


def test_company_research_is_scoped_per_holding_and_tags_items_with_holding_id():
    with _session() as db:
        holding = Holding(ticker="EQNR.OL", name="Equinor ASA", trading_currency="NOK", sector="Energy")
        db.add(holding)
        db.commit()

        provider = _FakeProvider(items=[_item()])
        snapshot = get_company_research(db, provider, holding=holding)

        assert snapshot.available is True
        run = db.query(ResearchRun).filter_by(type=ResearchRunType.COMPANY.value).one()
        assert run.holding_id == holding.id
        assert run.items[0].holding_id == holding.id


def test_zero_items_from_provider_is_still_a_completed_run_not_a_failure():
    """A grounded call that legitimately found nothing (see the provider's
    own empty-supports-vs-no-grounding distinction) must not be treated as
    an error -- it's still a real, successful research pass."""
    with _session() as db:
        provider = _FakeProvider(items=[])
        snapshot = get_macro_research(db, provider)
        assert snapshot.available is True
        assert snapshot.items == []
        run = db.query(ResearchRun).one()
        assert run.status == ResearchRunStatus.COMPLETED.value
