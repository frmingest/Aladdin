"""GET /catalogue (Sal's shop, 2026-11-11): read only, database only, public market data."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from app.models.app_setting import AppSetting
from app.models.ticker_catalogue import TickerCatalogueEntry

NOW = datetime(2026, 11, 11, 12, tzinfo=timezone.utc)


def _add(db, ticker, name, *, sector="Energy", cap=None, currency="NOK", active=True, seen=NOW):
    db.add(
        TickerCatalogueEntry(
            ticker=ticker, name=name, exchange="OSL", currency=currency, yahoo_sector="x", sector=sector,
            market_cap=Decimal(cap) if cap is not None else None,
            market_cap_currency=currency if cap is not None else None,
            active=active, first_seen_at=seen, last_seen_at=seen,
        )
    )


def test_an_empty_catalogue_says_so(client):
    body = client.get("/catalogue").json()
    assert body["status"] == "empty" and body["items"] == [] and body["total"] == 0 and body["as_of"] is None


def test_the_catalogue_lists_active_companies_biggest_first_with_size_bands(client, db_session):
    _add(db_session, "EQNR.OL", "Equinor ASA", cap=700_000_000_000)
    _add(db_session, "AKRBP.OL", "Aker BP ASA", cap=120_000_000_000)
    _add(db_session, "NEL.OL", "Nel ASA", sector="Industrials", cap=3_000_000_000)
    _add(db_session, "TINY.OL", "Tiny AS", sector=None, cap=200_000_000)
    _add(db_session, "FOG.OL", "Fog AS", cap=None)
    _add(db_session, "USD.OL", "Dollar Co", cap=900_000_000_000, currency="USD")  # no FX guess: size unknown
    _add(db_session, "GONE.OL", "Retired ASA", cap=900_000_000_000, active=False)
    db_session.commit()

    body = client.get("/catalogue").json()
    assert body["status"] == "ready" and body["total"] == 6
    assert body["rules_version"] == "catalogue-v1"
    assert body["as_of"] is not None
    tickers = [i["ticker"] for i in body["items"]]
    assert "GONE.OL" not in tickers  # retired companies are not on the shelves
    assert tickers[:4] == ["USD.OL", "EQNR.OL", "AKRBP.OL", "NEL.OL"]  # biggest first; unknown values last
    bands = {i["ticker"]: i["size_band"] for i in body["items"]}
    assert bands == {
        "EQNR.OL": "giant", "AKRBP.OL": "giant", "NEL.OL": "small", "TINY.OL": "tiny", "FOG.OL": "unknown", "USD.OL": "unknown",
    }
    tiny = next(i for i in body["items"] if i["ticker"] == "TINY.OL")
    assert tiny["sector"] is None and tiny["currency"] == "NOK"


def test_the_catalogue_is_served_in_demo_mode_too(client, db_session):
    _add(db_session, "EQNR.OL", "Equinor ASA", cap=700_000_000_000)
    db_session.add(AppSetting(key="demo_mode", value="true"))
    db_session.commit()
    body = client.get("/catalogue").json()
    assert body["status"] == "ready" and body["items"][0]["ticker"] == "EQNR.OL"


def test_the_catalogue_endpoint_only_reads(client):
    assert client.post("/catalogue").status_code == 405
    assert client.delete("/catalogue").status_code == 405
