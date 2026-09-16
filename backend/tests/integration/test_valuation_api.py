"""Integration tests for the Phase 2 endpoints: PATCH holdings market_ticker
and POST snapshot valuation. Uses a FakeMarketDataProvider dependency
override — never touches yfinance/network, consistent with the Phase 1
approach of keeping tests independent of external infrastructure (§22)."""

from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import pytest

from app.main import app
from app.providers.base import (
    DividendObservation,
    FxRate,
    MarketDataProvider,
    MarketDataUnavailableError,
    MarketMetadata,
    PriceObservation,
)
from app.providers.factory import get_market_data_provider
from tests.support import make_portfolio_csv

VALID_CSV = make_portfolio_csv(
    [
        "VAR.OL,Vår Energi,Aksje,1200,60,28.40,NOK,Energy,BlueNord merger thesis",
        "EQNR.OL,Equinor,Aksje,500,40,300,NOK,Energy,",
    ]
)

# The same real Nordnet export used by tests/unit/test_portfolio_parser_nordnet.py
# (see docs/decisions/0003-nordnet-export-support.md) — no ticker column, so
# every resulting holding starts with market_ticker=None.
NORDNET_FIXTURE = (
    Path(__file__).resolve().parents[1] / "fixtures" / "nordnet_beholdningstabell.csv"
).read_bytes()


class FakePrice:
    """Canned per-ticker responses for the fake provider below."""

    def __init__(self, price: Decimal, currency: str):
        self.price = price
        self.currency = currency


class FakeMarketDataProvider(MarketDataProvider):
    def __init__(self, prices: dict[str, FakePrice], fx: dict[tuple[str, str], Decimal]):
        self._prices = prices
        self._fx = fx

    def get_latest_price(self, ticker: str) -> PriceObservation:
        if ticker not in self._prices:
            raise MarketDataUnavailableError(ticker, "no price configured in fake provider")
        p = self._prices[ticker]
        return PriceObservation(
            ticker=ticker,
            price=p.price,
            currency=p.currency,
            observed_at=datetime(2026, 9, 12, 16, 30, tzinfo=timezone.utc),
            provider="fake",
            status="delayed",
        )

    def get_historical_prices(self, ticker, start, end):
        raise NotImplementedError

    def get_fx_rate(self, from_currency: str, to_currency: str) -> FxRate:
        from_currency, to_currency = from_currency.upper(), to_currency.upper()
        if from_currency == to_currency:
            return FxRate(from_currency, to_currency, Decimal("1"), datetime.now(timezone.utc), "fake")
        key = (from_currency, to_currency)
        if key not in self._fx:
            raise MarketDataUnavailableError(f"{from_currency}{to_currency}=X", "no FX rate configured")
        return FxRate(from_currency, to_currency, self._fx[key], datetime.now(timezone.utc), "fake")

    def get_dividends(self, ticker: str) -> list[DividendObservation]:
        return []

    def get_market_metadata(self, ticker: str) -> MarketMetadata:
        raise NotImplementedError


@pytest.fixture()
def fake_provider():
    provider = FakeMarketDataProvider(
        prices={
            "VAR.OL": FakePrice(Decimal("30.00"), "NOK"),
            "EQNR.OL": FakePrice(Decimal("310.00"), "NOK"),
        },
        fx={},  # NOK -> NOK never needs a lookup; nothing else configured
    )
    app.dependency_overrides[get_market_data_provider] = lambda: provider
    yield provider
    app.dependency_overrides.pop(get_market_data_provider, None)


def _upload(client, content=VALID_CSV, filename="portfolio.csv"):
    return client.post("/portfolio/upload", files={"file": (filename, content, "text/csv")})


def test_valuation_computes_market_value_pnl_and_concentration(client, fake_provider):
    upload = _upload(client)
    snapshot_id = upload.json()["snapshot"]["id"]

    response = client.post(f"/portfolio/snapshots/{snapshot_id}/valuation")
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["reporting_currency"] == "NOK"
    by_ticker = {h["ticker"]: h for h in body["holdings"]}

    var = by_ticker["VAR.OL"]
    assert var["price"] == "30.00"
    assert Decimal(var["market_value_reporting_ccy"]) == Decimal("36000.00")  # 1200 * 30.00, fx=1
    # cost basis 1200 * 28.40 = 34080; pnl = 36000 - 34080 = 1920
    assert Decimal(var["unrealized_pnl"]) == Decimal("1920.00")
    assert var["data_warning"] is None

    eqnr = by_ticker["EQNR.OL"]
    assert Decimal(eqnr["market_value_reporting_ccy"]) == Decimal("155000.00")  # 500 * 310.00

    expected_total = Decimal("36000.00") + Decimal("155000.00")
    assert Decimal(body["total_market_value"]) == expected_total

    # Weights recomputed from live market value, not the uploaded 60/40 split.
    assert Decimal(var["computed_weight_pct"]).quantize(Decimal("0.01")) == (
        Decimal("36000.00") / expected_total * 100
    ).quantize(Decimal("0.01"))

    concentration = body["concentration"]
    assert set(concentration["single_name_weights"].keys()) == {"VAR.OL", "EQNR.OL"}
    assert concentration["single_name_hhi"] is not None
    assert Decimal(concentration["sector_weights"]["Energy"]) == Decimal("100")
    # Both holdings are EQUITY (Nordnet's "Aksje") — asset_class_values is the
    # absolute-currency counterpart to asset_class_weights, so it should carry
    # the full portfolio total under the one asset class present.
    assert Decimal(concentration["asset_class_values"]["EQUITY"]) == expected_total


def test_valuation_marks_holding_unavailable_without_failing_whole_request(client, fake_provider):
    # EQNR.OL has no configured price in the fake provider's dict — simulate
    # by uploading only a holding the fake provider doesn't know about.
    csv = make_portfolio_csv(["UNKNOWN.OL,Mystery Co,Aksje,100,100,10,NOK,Energy,"])
    upload = _upload(client, content=csv)
    snapshot_id = upload.json()["snapshot"]["id"]

    response = client.post(f"/portfolio/snapshots/{snapshot_id}/valuation")
    assert response.status_code == 200
    body = response.json()

    holding = body["holdings"][0]
    assert holding["price_status"] == "unavailable"
    assert holding["market_value_reporting_ccy"] is None
    assert "no price configured" in holding["data_warning"]
    assert Decimal(body["total_market_value"]) == Decimal("0")
    assert any("excluded from totals" in w for w in body["warnings"])


def test_valuation_flags_nordnet_holdings_with_no_market_ticker(client, fake_provider):
    upload = _upload(client, content=NORDNET_FIXTURE, filename="beholdning.csv")
    snapshot_id = upload.json()["snapshot"]["id"]

    response = client.post(f"/portfolio/snapshots/{snapshot_id}/valuation")
    assert response.status_code == 200
    holdings = response.json()["holdings"]

    assert len(holdings) == 3
    for holding in holdings:
        assert holding["market_ticker"] is None
        assert holding["price_status"] == "unavailable"
        assert "no market_ticker set" in holding["data_warning"]


_WHISKYBASE_HEADER = (
    'ID,CollectionID,Brand,Name,"Bottling serie","Bottle Status","Stated Age",Size,'
    'Strength,"Strength Unit","Cask Type",List,Rating,"My Rating","Price Paid",Currency,'
    '"Average Shop Price","Currency Whisky",Distilleries,Vintage,"Added on",Photo'
)


def _whiskybase_csv(*rows: str) -> bytes:
    return ("\n".join([_WHISKYBASE_HEADER, *rows]) + "\n").encode("utf-8")


def test_collectible_with_no_market_ticker_is_valued_at_cost_not_excluded(client, fake_provider):
    """Phase 8 (ADR 0011): a whisky bottle imported via the Whiskybase
    format has no live pricing feed by design and never gets a
    market_ticker — unlike the Nordnet no-market-ticker case above
    (excluded from totals), a COLLECTIBLE should still count toward
    Composition/Risk totals at cost basis, clearly tagged
    price_status="at_cost" so it's never read as a live price."""
    csv_bytes = _whiskybase_csv(
        '195396,7642206,"Port Dundas","2000 DL",,closed,,700,51.50,%vol,,,82.82,,79.90,EUR,'
        '79.9,EUR,"Port Dundas",,"2023-04-30 20:35:43",'
    )
    upload = client.post(
        "/portfolio/upload",
        data={"reporting_currency": "EUR"},
        files={"file": ("whisky.csv", csv_bytes, "text/csv")},
    )
    snapshot_id = upload.json()["snapshot"]["id"]

    response = client.post(f"/portfolio/snapshots/{snapshot_id}/valuation")
    assert response.status_code == 200, response.text
    body = response.json()
    holding = body["holdings"][0]

    assert holding["market_ticker"] is None
    assert holding["price_status"] == "at_cost"
    assert Decimal(holding["market_value_reporting_ccy"]) == Decimal("79.90")
    assert Decimal(holding["unrealized_pnl"]) == Decimal("0")
    assert "carried at cost basis" in holding["data_warning"]

    # Counts toward totals/concentration rather than being excluded.
    assert body["total_market_value"] != "0"
    assert holding["ticker"] in body["concentration"]["single_name_weights"]
    assert "Port Dundas" in body["concentration"]["sector_weights"]
    assert holding["ticker"] not in body["concentration"]["holdings_excluded_from_concentration"]
    # At-cost collectibles count toward asset_class_values under COLLECTIBLE
    # too (the dashboard's "Whisky collection" total), not just the weights.
    assert Decimal(body["concentration"]["asset_class_values"]["COLLECTIBLE"]) == Decimal("79.90")


def test_collectible_with_no_market_ticker_and_no_cost_basis_is_still_excluded(client, fake_provider):
    """No cost_basis at all (Price Paid and Average Shop Price both blank,
    only a bare Currency present) — nothing to carry the holding at, so
    it's excluded exactly like any other unpriceable holding, not
    defaulted to zero (§21)."""
    csv_bytes = _whiskybase_csv(
        '999,1,"Mystery","Bottle",,closed,,700,40,%vol,,,,,,EUR,,,,,"2024-01-01 00:00:00",'
    )
    upload = _upload(client, content=csv_bytes, filename="whisky.csv")
    snapshot_id = upload.json()["snapshot"]["id"]

    response = client.post(f"/portfolio/snapshots/{snapshot_id}/valuation")
    holding = response.json()["holdings"][0]

    assert holding["price_status"] == "unavailable"
    assert holding["market_value_reporting_ccy"] is None


def _nordnet_csv_with_cash(*rows: str) -> bytes:
    header = "Handel\tValuta\tAntall\tGAV\tVerdi NOK"
    return ("\n".join([header, *rows]) + "\n").encode("utf-16")


def test_cash_holding_with_no_market_ticker_is_valued_at_par_not_excluded(client, fake_provider):
    """A Nordnet "Kontanter" row has no market_ticker (same as every
    Nordnet row) and no live price to look up — unlike an ordinary
    no-ticker security (excluded from totals, see
    test_valuation_flags_nordnet_holdings_with_no_market_ticker above), a
    CASH holding should still count toward Composition/Risk totals at par
    (quantity == balance in trading_currency), tagged price_status="cash"
    so it's never mistaken for a live-priced security. Root cause of the
    real portfolio's cash balance silently vanishing from every total."""
    csv_bytes = _nordnet_csv_with_cash("Kontanter\tNOK\t51071\t1\t51071")
    upload = _upload(client, content=csv_bytes, filename="beholdning.csv")
    snapshot_id = upload.json()["snapshot"]["id"]

    response = client.post(f"/portfolio/snapshots/{snapshot_id}/valuation")
    assert response.status_code == 200, response.text
    body = response.json()
    holding = body["holdings"][0]

    assert holding["market_ticker"] is None
    assert holding["price_status"] == "cash"
    assert Decimal(holding["market_value_reporting_ccy"]) == Decimal("51071.00")
    assert Decimal(holding["unrealized_pnl"]) == Decimal("0")

    assert Decimal(body["total_market_value"]) == Decimal("51071.00")
    assert holding["ticker"] not in body["concentration"]["holdings_excluded_from_concentration"]
    assert Decimal(body["concentration"]["asset_class_values"]["CASH"]) == Decimal("51071.00")


def test_unknown_snapshot_returns_404_for_valuation(client, fake_provider):
    response = client.post(
        "/portfolio/snapshots/00000000-0000-0000-0000-000000000000/valuation"
    )
    assert response.status_code == 404


def _find_position(upload_response, name: str) -> dict:
    return next(p for p in upload_response.json()["snapshot"]["positions"] if p["name"] == name)


def test_patch_holding_sets_market_ticker_and_unblocks_valuation(client, fake_provider):
    upload = _upload(client, content=NORDNET_FIXTURE, filename="beholdning.csv")
    snapshot_id = upload.json()["snapshot"]["id"]
    holding_id = _find_position(upload, "Vår Energi")["holding_id"]

    patch = client.patch(f"/portfolio/holdings/{holding_id}", json={"market_ticker": "VAR.OL"})
    assert patch.status_code == 200
    assert patch.json()["market_ticker"] == "VAR.OL"

    response = client.post(f"/portfolio/snapshots/{snapshot_id}/valuation")
    by_ticker = {h["ticker"]: h for h in response.json()["holdings"]}
    holding = by_ticker["Vår Energi"]
    assert holding["price_status"] == "delayed"
    assert holding["market_value_reporting_ccy"] is not None


def test_patch_unknown_holding_returns_404(client, fake_provider):
    response = client.patch(
        "/portfolio/holdings/00000000-0000-0000-0000-000000000000",
        json={"market_ticker": "VAR.OL"},
    )
    assert response.status_code == 404


# --- Accounts (§26 accounts feature) — valuation scoped to a subset -------


def _create_account(client, name: str, account_number: str) -> str:
    response = client.post("/accounts", json={"name": name, "account_number": account_number})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_valuation_can_be_scoped_to_one_account(client, fake_provider):
    account_a = _create_account(client, "Aksje & fonds konto", "70541644")
    account_b = _create_account(client, "ASK konto", "24175564")

    client.post(
        "/portfolio/upload",
        files={"file": ("a.csv", make_portfolio_csv(["VAR.OL,Vår Energi,Aksje,1200,100,28.40,NOK,Energy,"]), "text/csv")},
        data={"account_id": account_a},
    )
    upload_b = client.post(
        "/portfolio/upload",
        files={"file": ("b.csv", make_portfolio_csv(["EQNR.OL,Equinor,Aksje,500,100,300,NOK,Energy,"]), "text/csv")},
        data={"account_id": account_b},
    )
    snapshot_id = upload_b.json()["snapshot"]["id"]  # merged snapshot has both accounts' positions

    scoped = client.post(f"/portfolio/snapshots/{snapshot_id}/valuation?account_id={account_a}")
    assert scoped.status_code == 200, scoped.text
    scoped_body = scoped.json()
    assert scoped_body["account_ids"] == [account_a]
    assert [h["ticker"] for h in scoped_body["holdings"]] == ["VAR.OL"]
    assert Decimal(scoped_body["total_market_value"]) == Decimal("36000.00")  # 1200 * 30.00

    unscoped = client.post(f"/portfolio/snapshots/{snapshot_id}/valuation")
    assert unscoped.status_code == 200
    unscoped_body = unscoped.json()
    assert unscoped_body["account_ids"] is None
    assert {h["ticker"] for h in unscoped_body["holdings"]} == {"VAR.OL", "EQNR.OL"}


def test_reupload_does_not_clobber_manually_set_market_ticker(client, fake_provider):
    upload = _upload(client, content=NORDNET_FIXTURE, filename="beholdning.csv")
    holding_id = _find_position(upload, "Vår Energi")["holding_id"]
    client.patch(f"/portfolio/holdings/{holding_id}", json={"market_ticker": "VAR.OL"})

    # Re-uploading the same Nordnet export (which never carries a ticker)
    # must not silently wipe the manually-set market_ticker back to None.
    _upload(client, content=NORDNET_FIXTURE, filename="beholdning.csv")

    holdings = client.get("/portfolio/holdings").json()
    holding = next(h for h in holdings if h["id"] == holding_id)
    assert holding["market_ticker"] == "VAR.OL"
