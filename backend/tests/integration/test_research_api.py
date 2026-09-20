"""
Integration tests for the Phase 4 research endpoints (§26). Uses fake
MacroDataProvider/ResearchProvider dependency overrides — never touches
FRED, Norges Bank, or Gemini, consistent with the Phase 2/3 pattern of
keeping tests independent of external infrastructure (§22).
"""

from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.main import app
from app.providers.base import (
    MacroDataProvider,
    MacroSeriesPoint,
    ResearchItem,
    ResearchProvider,
)
from app.providers.factory import get_macro_data_provider, get_research_provider
from tests.support import make_portfolio_csv


class FakeMacroDataProvider(MacroDataProvider):
    def get_latest(self, series_key):
        return MacroSeriesPoint(
            series_key=series_key,
            value=Decimal("5.33"),
            unit="percent",
            observed_at=datetime(2026, 9, 1, tzinfo=timezone.utc),
            provider="fred",
            region="US",
        )

    def get_series(self, series_key, start, end):
        return [self.get_latest(series_key)]


class FakeResearchProvider(ResearchProvider):
    def get_macro_snapshot(self):
        return [
            ResearchItem(
                source_url="https://example.com/macro",
                source_name="example.com",
                title="Fed holds rates steady",
                summary="The Fed left rates unchanged this month.",
                source_type="macro_news",
                published_at=None,
                retrieved_at=datetime.now(timezone.utc),
            )
        ]

    def get_sector_research(self, sector):
        return [
            ResearchItem(
                source_url="https://example.com/sector",
                source_name="example.com",
                title=f"{sector} sector update",
                summary=f"Something happened in {sector}.",
                source_type="sector_research",
                published_at=None,
                retrieved_at=datetime.now(timezone.utc),
            )
        ]

    def get_company_research(self, company_name, ticker, sector):
        return [
            ResearchItem(
                source_url="https://example.com/company",
                source_name="example.com",
                title=f"{company_name} company update",
                summary=f"Something specific happened at {company_name} ({ticker}).",
                source_type="company_research",
                published_at=None,
                retrieved_at=datetime.now(timezone.utc),
            )
        ]


@pytest.fixture()
def fake_research_providers():
    app.dependency_overrides[get_macro_data_provider] = lambda: FakeMacroDataProvider()
    app.dependency_overrides[get_research_provider] = lambda: FakeResearchProvider()
    yield
    app.dependency_overrides.pop(get_macro_data_provider, None)
    app.dependency_overrides.pop(get_research_provider, None)


def test_macro_snapshot_unavailable_before_any_refresh(client):
    response = client.get("/research/macro/snapshot")

    assert response.status_code == 200
    body = response.json()
    assert body["available"] is False
    assert body["reason"] is not None


def test_macro_refresh_then_snapshot_is_available(client, fake_research_providers):
    refresh = client.post("/research/macro/refresh")
    assert refresh.status_code == 201, refresh.text
    run = refresh.json()
    assert run["type"] == "MACRO"
    assert run["status"] in ("COMPLETED", "PARTIAL")

    snapshot = client.get("/research/macro/snapshot")
    assert snapshot.status_code == 200
    body = snapshot.json()
    assert body["available"] is True
    assert len(body["observations"]) > 0
    assert body["narrative_items"][0]["title"] == "Fed holds rates steady"


def test_macro_refresh_without_force_is_skipped_when_fresh(client, fake_research_providers):
    first = client.post("/research/macro/refresh").json()
    second = client.post("/research/macro/refresh").json()

    assert second["id"] == first["id"]


def test_macro_refresh_with_force_creates_a_new_run(client, fake_research_providers):
    first = client.post("/research/macro/refresh").json()
    second = client.post("/research/macro/refresh?force=true").json()

    assert second["id"] != first["id"]


def _upload_holding_with_sector(client, sector="Energy"):
    csv_bytes = make_portfolio_csv(
        [f"VAR.OL,Vår Energi,Aksje,1200,100,28.40,NOK,{sector},Long-term conviction holding"]
    )
    upload = client.post("/portfolio/upload", files={"file": ("portfolio.csv", csv_bytes, "text/csv")})
    return upload.json()["snapshot"]["positions"][0]["holding_id"]


def test_list_known_sectors_reflects_holdings(client):
    _upload_holding_with_sector(client, sector="Energy")

    response = client.get("/research/sectors")

    assert response.status_code == 200
    assert "Energy" in response.json()


def test_sector_items_unavailable_before_any_refresh(client):
    response = client.get("/research/sectors/Energy/items")

    assert response.status_code == 200
    body = response.json()
    assert body["available"] is False
    assert body["sector"] == "Energy"


def test_sector_refresh_then_items_available(client, fake_research_providers):
    refresh = client.post("/research/sectors/Energy/refresh")
    assert refresh.status_code == 201, refresh.text
    assert refresh.json()["status"] == "COMPLETED"

    items = client.get("/research/sectors/Energy/items")
    body = items.json()
    assert body["available"] is True
    assert body["items"][0]["title"] == "Energy sector update"


def test_get_research_run_by_id(client, fake_research_providers):
    run = client.post("/research/macro/refresh").json()

    response = client.get(f"/research/runs/{run['id']}")

    assert response.status_code == 200
    assert response.json()["id"] == run["id"]


def test_get_research_run_404_for_unknown_id(client):
    response = client.get("/research/runs/00000000-0000-0000-0000-000000000000")

    assert response.status_code == 404


# --- company (Phase 11 Sprint 2) ---


def test_company_items_unavailable_before_any_refresh(client):
    holding_id = _upload_holding_with_sector(client, sector="Energy")

    response = client.get(f"/research/holdings/{holding_id}/company/items")

    assert response.status_code == 200
    body = response.json()
    assert body["available"] is False
    assert body["holding_id"] == holding_id


def test_company_refresh_then_items_available(client, fake_research_providers):
    holding_id = _upload_holding_with_sector(client, sector="Energy")

    refresh = client.post(f"/research/holdings/{holding_id}/company/refresh")
    assert refresh.status_code == 201, refresh.text
    assert refresh.json()["status"] == "COMPLETED"
    assert refresh.json()["type"] == "COMPANY"

    items = client.get(f"/research/holdings/{holding_id}/company/items")
    body = items.json()
    assert body["available"] is True
    assert "company update" in body["items"][0]["title"]


def test_company_refresh_without_force_is_skipped_when_fresh(client, fake_research_providers):
    holding_id = _upload_holding_with_sector(client, sector="Energy")

    first = client.post(f"/research/holdings/{holding_id}/company/refresh").json()
    second = client.post(f"/research/holdings/{holding_id}/company/refresh").json()

    assert second["id"] == first["id"]


def test_company_refresh_with_force_creates_a_new_run(client, fake_research_providers):
    holding_id = _upload_holding_with_sector(client, sector="Energy")

    first = client.post(f"/research/holdings/{holding_id}/company/refresh").json()
    second = client.post(f"/research/holdings/{holding_id}/company/refresh?force=true").json()

    assert second["id"] != first["id"]


def test_company_refresh_404_for_unknown_holding(client, fake_research_providers):
    response = client.post("/research/holdings/00000000-0000-0000-0000-000000000000/company/refresh")

    assert response.status_code == 404


def test_company_items_404_for_unknown_holding(client):
    response = client.get("/research/holdings/00000000-0000-0000-0000-000000000000/company/items")

    assert response.status_code == 404


def test_company_research_is_scoped_per_holding(client, fake_research_providers):
    holding_a = _upload_holding_with_sector(client, sector="Energy")

    # A second, different holding must start with no research of its own,
    # even though holding_a's refresh has already run.
    client.post(f"/research/holdings/{holding_a}/company/refresh")

    csv_bytes = make_portfolio_csv(
        ["EQNR.OL,Equinor,Aksje,500,50,300.00,NOK,Energy,Core energy holding"]
    )
    upload = client.post("/portfolio/upload", files={"file": ("portfolio2.csv", csv_bytes, "text/csv")})
    # Uploads merge into the running portfolio (holding_a/VAR.OL carries
    # forward), so the new holding isn't necessarily positions[0] — find it
    # by ticker instead of assuming order.
    positions = upload.json()["snapshot"]["positions"]
    holding_b = next(p["holding_id"] for p in positions if p["ticker"] == "EQNR.OL")

    response = client.get(f"/research/holdings/{holding_b}/company/items")
    body = response.json()
    assert body["available"] is False
