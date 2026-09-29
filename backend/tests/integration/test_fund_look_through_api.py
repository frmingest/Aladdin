"""Fund look-through valuation end to end: fetched/imported holdings ->
refresh constituent P/Es (fake provider) -> /valuation/holdings/{id} and the
margin-of-safety board rank the fund, and every failure mode says why."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

from app.main import app
from app.models.fund import FundConstituentMultiple
from app.models.holding import Holding
from app.providers import xtrackers_holdings as xt
from app.providers.base import PricePoint, RiskFreeRate
from app.providers.constituent_multiples import (
    ConstituentMultiple,
    ConstituentUnavailableError,
)
from app.providers.factory import (
    get_constituent_multiples_provider,
    get_market_data_provider,
    get_risk_free_rate_provider,
)

D = Decimal
FIXTURE = json.loads((Path(__file__).parent.parent / "fixtures" / "xtrackers_holdings_xdef.json").read_text())


class _Market:
    name = "fake"

    def get_current_price(self, ticker, *, currency_hint=None):
        return PricePoint(price=D("30"), currency="USD", observed_at=datetime.now(timezone.utc), provider="fake")

    def get_fx_rate(self, a, b):  # pragma: no cover
        raise NotImplementedError

    def get_beta(self, ticker, *, allow_live_fetch=True):
        return D("1.0")


class _Rate:
    def get_risk_free_rate(self, currency):
        return RiskFreeRate(
            currency=currency, rate=D("4.0"), observed_at=datetime.now(timezone.utc), provider="fake",
            source_series_id="X",
        )


class _PE:
    name = "fake_pe"

    def __init__(self, pes: dict[str, str | None]):
        self.pes = pes

    def get_trailing_pe(self, isin):
        value = self.pes.get(isin)
        if value is None:
            raise ConstituentUnavailableError("no trailing P/E on Yahoo")
        return ConstituentMultiple(
            isin=isin, trailing_pe=D(value), resolved_ticker="X.L", provider=self.name,
            observed_at=datetime.now(timezone.utc),
        )


# Weights (%) in the fixture: RR 11.49, Safran 10.98, Airbus 10.73, Kongsberg 4.25, Indra 2.02, Ovzon 0.10
_ALL = {
    "GB00B63H8491": "40", "FR0000073272": "30", "NL0000235190": "25", "NO0013536151": "50",
    "ES0118594417": "20", "SE0010948711": None,
}


def _override(pes):
    app.dependency_overrides[get_market_data_provider] = lambda: _Market()
    app.dependency_overrides[get_risk_free_rate_provider] = lambda: _Rate()
    app.dependency_overrides[get_constituent_multiples_provider] = lambda: _PE(pes)


def _clear():
    for dep in (get_market_data_provider, get_risk_free_rate_provider, get_constituent_multiples_provider):
        app.dependency_overrides.pop(dep, None)


def _fund_with_holdings(client, db_session, monkeypatch) -> str:
    monkeypatch.setattr("app.api.funds.fetch_xtrackers_holdings", lambda isin: xt.parse_holdings(FIXTURE, fund_isin=isin))
    response = client.post("/holdings", json={"ticker": "XDEF.DE", "name": "Xtrackers Defence", "trading_currency": "USD"})
    assert response.status_code == 201, response.text
    holding = db_session.get(Holding, response.json()["id"])
    holding.asset_class_raw = "equity_etf"
    db_session.commit()
    imp = client.post(f"/funds/{holding.id}/holdings/fetch-xtrackers", json={"isin": "LU3061478973"})
    assert imp.status_code == 201, imp.text
    return str(holding.id)


def _own(db_session, holding_id) -> None:
    """Give the fund a current portfolio position (the board lists owned holdings)."""
    from app.models.account import Account
    from app.models.document import Document
    from app.models.portfolio import PortfolioPosition, PortfolioSnapshot

    account = Account(account_number="A-1", name="Test")
    db_session.add(account)
    document = Document(
        type="portfolio_export", original_filename="x.csv", mime_type="text/csv", size_bytes=1,
        storage_path="p/x.csv", sha256="f" * 64, status="processed", quality_flags={},
    )
    db_session.add(document)
    db_session.flush()
    snap = PortfolioSnapshot(
        source_file=document, reporting_currency="NOK", status="processed", account=account,
        uploaded_at=datetime.now(timezone.utc),
    )
    db_session.add(snap)
    db_session.flush()
    db_session.add(PortfolioPosition(snapshot=snap, holding_id=holding_id, market_value_nok=D("100000")))
    db_session.commit()


def test_before_refresh_the_valuation_says_what_is_missing(client, db_session, monkeypatch):
    fund_id = _fund_with_holdings(client, db_session, monkeypatch)
    _override({})
    try:
        body = client.get(f"/valuation/holdings/{fund_id}").json()
    finally:
        _clear()
    assert body["valuation_method"] == "fund_look_through_pe"
    assert body["valuation_status"] == "unavailable"
    assert any("Refresh look-through" in r for r in body["unavailable_reasons"])


def test_refresh_then_valuation_and_board(client, db_session, monkeypatch):
    fund_id = _fund_with_holdings(client, db_session, monkeypatch)
    _override(_ALL)
    try:
        refresh = client.post(f"/funds/{fund_id}/look-through/refresh")
        assert refresh.status_code == 200, refresh.text
        assert refresh.json() == {**refresh.json(), "lines": 6, "priced": 5, "unpriced": 1, "no_isin": 0}
        assert db_session.query(FundConstituentMultiple).count() == 6

        body = client.get(f"/valuation/holdings/{fund_id}").json()
        assert body["valuation_status"] == "ok", body
        look = body["fund_look_through"]
        assert look["constituents_used"] == 5 and look["constituents_total"] == 6
        assert D(look["coverage_pct"]) > D(99)
        scenarios = {s["label"]: D(s["value_per_unit"]) for s in look["scenarios"]}
        assert scenarios["bear"] < scenarios["base"] < scenarios["bull"]
        assert body["dcf"] is None and look["method_note"]

        _own(db_session, fund_id)
        board = client.get("/valuation/board").json()
        row = next(r for r in board["rows"] if r["holding_id"] == fund_id)
        assert row["valuation_method"] == "fund_look_through_pe"
        assert row["zone"] != "unavailable"
        assert row["margin_of_safety_base"] is not None  # ranked: the fund is no longer 'nothing rankable'
    finally:
        _clear()


def test_low_coverage_is_unavailable_with_the_reason(client, db_session, monkeypatch):
    fund_id = _fund_with_holdings(client, db_session, monkeypatch)
    _override({"NO0013536151": "50"})  # Kongsberg (4%) only
    try:
        client.post(f"/funds/{fund_id}/look-through/refresh")
        body = client.get(f"/valuation/holdings/{fund_id}").json()
    finally:
        _clear()
    assert body["valuation_status"] == "unavailable"
    assert any("covers only" in r for r in body["unavailable_reasons"])


def test_absurd_multiples_are_withheld_as_implausible(client, db_session, monkeypatch):
    fund_id = _fund_with_holdings(client, db_session, monkeypatch)
    _override({k: "0.5" if v else None for k, v in _ALL.items()})  # P/E 0.5 -> value >> 3x price
    try:
        client.post(f"/funds/{fund_id}/look-through/refresh")
        body = client.get(f"/valuation/holdings/{fund_id}").json()
    finally:
        _clear()
    assert body["valuation_status"] == "implausible"
    assert body["fund_look_through"] is None and body["rejected_values"]["base"]


def test_refresh_refuses_non_funds_and_funds_without_holdings(client, db_session):
    stock = client.post("/holdings", json={"ticker": "NEM", "name": "Newmont", "trading_currency": "USD"}).json()["id"]
    _override({})
    try:
        assert client.post(f"/funds/{stock}/look-through/refresh").status_code == 422
        holding = db_session.get(Holding, stock)
        holding.asset_class_raw = "equity_etf"
        db_session.commit()
        response = client.post(f"/funds/{stock}/look-through/refresh")
        assert response.status_code == 422 and "no imported holdings" in response.json()["detail"]
    finally:
        _clear()
