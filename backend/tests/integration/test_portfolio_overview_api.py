"""GET /portfolio/overview (Sprint 5 dashboard) through the real API."""
from __future__ import annotations

from decimal import Decimal

from app.models import Document, Holding
from app.models.account import Account
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot


def test_overview_empty(client):
    body = client.get("/portfolio/overview").json()
    assert body["as_of"] is None
    assert body["positions"] == []
    assert body["summary"] == []


def test_overview_with_positions(client, db_session):
    account = Account(name="ASK", account_number="123")
    doc = Document(type="portfolio_export", original_filename="a.csv", mime_type="text/csv", size_bytes=1,
                   storage_path="a.csv", sha256="a" * 64, status="processed", quality_flags={})
    h1 = Holding(ticker="EQNR.OL", name="Equinor", trading_currency="NOK", asset_class_raw="stock", sector="Energy")
    h2 = Holding(ticker="KO", name="Coca-Cola", trading_currency="USD", asset_class_raw="stock")
    snap = PortfolioSnapshot(source_file=doc, reporting_currency="NOK", status="processed", account=account)
    db_session.add_all([account, doc, h1, h2, snap])
    db_session.add_all([
        PortfolioPosition(snapshot=snap, holding=h1, market_value_nok=Decimal("750")),
        PortfolioPosition(snapshot=snap, holding=h2, market_value_nok=Decimal("250")),
    ])
    db_session.commit()

    body = client.get("/portfolio/overview").json()
    assert Decimal(body["total_value_nok"]) == 1000
    assert body["holding_count"] == 2
    assert body["positions"][0]["ticker"] == "EQNR.OL"
    assert Decimal(body["positions"][0]["weight_pct"]) == 75
    assert Decimal(body["concentration"]["hhi"]) == Decimal(75 * 75 + 25 * 25)
    assert {s["key"] for s in body["by_currency"]} == {"NOK", "USD"}
    assert body["verdicts"][0]["rating"] == "Not analyzed"
    assert any(p["tone"] == "warn" for p in body["summary"])
