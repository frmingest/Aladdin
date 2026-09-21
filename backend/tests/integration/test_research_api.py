"""Integration tests for /research/* — full FastAPI TestClient stack, with
the ResearchProvider dependency overridden by a fake (no real Gemini call;
see tests/integration/conftest.py for the shared client fixture)."""
from datetime import datetime, timezone
from uuid import uuid4

from app.main import app
from app.providers.base import ResearchItem, ResearchUnavailableError
from app.providers.factory import get_research_provider


class _FakeProvider:
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


def _item() -> ResearchItem:
    return ResearchItem(
        source_url="https://example.com/1",
        source_name="example.com",
        title="A finding",
        summary="Rates are rising.",
        source_type="macro_news",
        retrieved_at=datetime.now(timezone.utc),
    )


def _override(client, provider) -> None:
    app.dependency_overrides[get_research_provider] = lambda: provider
    client._fake_provider_override = provider  # not used, just a marker for readability


def test_get_macro_returns_grounded_items(client):
    _override(client, _FakeProvider(items=[_item()]))
    response = client.get("/research/macro")
    assert response.status_code == 200
    body = response.json()
    assert body["available"] is True
    assert len(body["items"]) == 1
    assert body["items"][0]["source_url"] == "https://example.com/1"
    app.dependency_overrides.pop(get_research_provider, None)


def test_macro_second_get_is_served_from_cache(client):
    provider = _FakeProvider(items=[_item()])
    _override(client, provider)

    client.get("/research/macro")
    client.get("/research/macro")
    assert provider.calls == 1
    app.dependency_overrides.pop(get_research_provider, None)


def test_macro_refresh_forces_a_new_provider_call(client):
    provider = _FakeProvider(items=[_item()])
    _override(client, provider)

    client.get("/research/macro")
    response = client.post("/research/macro/refresh")
    assert response.status_code == 200
    assert provider.calls == 2
    app.dependency_overrides.pop(get_research_provider, None)


def test_provider_failure_returns_200_with_available_false_not_a_500(client):
    _override(client, _FakeProvider(error=ResearchUnavailableError("quota exhausted")))
    response = client.get("/research/macro")
    assert response.status_code == 200
    body = response.json()
    assert body["available"] is False
    assert "quota exhausted" in body["reason"]
    app.dependency_overrides.pop(get_research_provider, None)


def test_get_sector_research(client):
    _override(client, _FakeProvider(items=[_item()]))
    response = client.get("/research/sectors/Energy")
    assert response.status_code == 200
    body = response.json()
    assert body["sector"] == "Energy"
    assert len(body["items"]) == 1
    app.dependency_overrides.pop(get_research_provider, None)


def test_get_company_research_for_real_holding(client):
    _override(client, _FakeProvider(items=[_item()]))
    create = client.post(
        "/holdings",
        json={"ticker": "EQNR.OL", "name": "Equinor ASA", "trading_currency": "NOK", "sector": "Energy"},
    )
    assert create.status_code == 201
    holding_id = create.json()["id"]

    response = client.get(f"/research/holdings/{holding_id}")
    assert response.status_code == 200
    body = response.json()
    assert body["holding_id"] == holding_id
    assert body["ticker"] == "EQNR.OL"
    assert len(body["items"]) == 1
    app.dependency_overrides.pop(get_research_provider, None)


def test_get_company_research_for_unknown_holding_is_404(client):
    _override(client, _FakeProvider(items=[_item()]))
    response = client.get(f"/research/holdings/{uuid4()}")
    assert response.status_code == 404
    app.dependency_overrides.pop(get_research_provider, None)
