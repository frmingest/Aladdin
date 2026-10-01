"""GET /game/state and the account cash field (game mode G1, 2026-10-01)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.models import Document, Holding
from app.models.account import Account
from app.models.analysis import EquityAnalysisRun
from app.models.financial_line_item import FinancialLineItem
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.models.precious_metal import PreciousMetalHolding

D = Decimal
NOW = datetime.now(timezone.utc)
DEMO_TICKERS = {"AAPL", "MSFT", "GOOGL", "JNJ", "PG", "KO", "JPM", "V", "HD", "XOM"}


def _facts(db, doc, holding, **values):
    for metric, value in values.items():
        db.add(FinancialLineItem(
            document=doc, holding=holding, metric=metric, value=D(value), unit="NOK",
            currency="NOK", period="FY2025", confidence=1.0,
        ))


def _run(db, holding, *, days_old, moat, verdict="Buy"):
    when = NOW - timedelta(days=days_old)
    db.add(EquityAnalysisRun(
        holding_id=holding.id, status="COMPLETED", schema_version="v1", blind_prompt_version="v1",
        evidence_packet_version="v1", evidence_packet_json={}, evidence_unavailable_reasons=[],
        started_at=when, completed_at=when,
        blind_pass_json={"verdict": {"rating": verdict}, "moat": {"overall_rating": moat}},
    ))


def _seed(db):
    account = Account(name="ASK", account_number="1")
    doc = Document(type="portfolio_export", original_filename="a.csv", mime_type="text/csv", size_bytes=1,
                   storage_path="a.csv", sha256="a" * 64, status="processed", quality_flags={})
    cash_rich = Holding(ticker="CASH.OL", name="Cash Rich", trading_currency="NOK", asset_class_raw="stock", sector="Technology")
    geared = Holding(ticker="GEAR.OL", name="Geared", trading_currency="NOK", asset_class_raw="stock", sector="Energy")
    bank = Holding(ticker="BANK.OL", name="Some Bank", trading_currency="NOK", asset_class_raw="stock", sector="Financials")
    fund = Holding(ticker="FUND", name="World ETF", trading_currency="NOK", asset_class_raw="equity_etf")
    bare = Holding(ticker="BARE.OL", name="No Filings", trading_currency="NOK", asset_class_raw="stock")
    snap = PortfolioSnapshot(source_file=doc, reporting_currency="NOK", status="processed", account=account)
    db.add_all([account, doc, cash_rich, geared, bank, fund, bare, snap])
    db.add_all([
        PortfolioPosition(snapshot=snap, holding=cash_rich, market_value_nok=D(400)),
        PortfolioPosition(snapshot=snap, holding=geared, market_value_nok=D(300)),
        PortfolioPosition(snapshot=snap, holding=bank, market_value_nok=D(150)),
        PortfolioPosition(snapshot=snap, holding=fund, market_value_nok=D(100)),
        PortfolioPosition(snapshot=snap, holding=bare, market_value_nok=D(50)),
    ])
    _facts(db, doc, cash_rich, total_debt="100", cash_and_equivalents="500", ebitda="200")
    # net debt 3000 / EBITDA 1000 = 3x (timber); EBIT 300 / interest 200 = 1.5x -> one tier weaker
    _facts(db, doc, geared, total_debt="3000", cash_and_equivalents="0", ebitda="1000",
           ebit="300", interest_expense="200")
    _facts(db, doc, bank, total_equity="80", total_assets="1000")
    db.commit()
    _run(db, cash_rich, days_old=10, moat="Wide")
    _run(db, geared, days_old=200, moat="None", verdict="Sell")
    db.commit()
    return account


def _by_ticker(body):
    return {t["ticker"]: t for t in body["towers"]}


def test_empty_database_gives_an_empty_labelled_fortress(client):
    body = client.get("/game/state").json()
    assert body["towers"] == []
    assert body["mapping_version"] == "v1"
    assert body["vault"]["level"] == "unsurveyed"
    assert any("No portfolio snapshot" in n for n in body["notes"])


def test_state_maps_stored_values_to_fortress_properties(client, db_session):
    _seed(db_session)
    body = client.get("/game/state").json()
    towers = _by_ticker(body)

    rich = towers["CASH.OL"]
    assert rich["structure"] == "keep"
    assert rich["moat"] == "wide"
    assert rich["wall"] == "basalt"
    assert rich["freshness"] == "fresh"
    assert rich["size_class"] == "great"          # 400 of 1000 = 40%
    assert rich["verdict_rating"] == "Buy"

    geared = towers["GEAR.OL"]
    assert geared["wall"] == "rotted"              # timber, then one tier weaker for thin cover
    assert "one tier weaker" in geared["wall_reason"]
    assert D(geared["wall_inputs"]["net_debt_to_ebitda"]) == D(3)
    assert geared["moat"] == "none"
    assert geared["freshness"] == "overgrown"
    assert geared["analysis_age_days"] >= 200

    bank = towers["BANK.OL"]
    assert bank["wall"] == "brick"                 # 8% equity / assets: 7% or more
    assert D(bank["wall_inputs"]["equity_to_assets"]) == D("0.08")

    fund = towers["FUND"]
    assert fund["structure"] == "outpost"
    assert fund["wall"] == "not_applicable"


def test_missing_data_is_unsurveyed_and_called_out_in_notes(client, db_session):
    _seed(db_session)
    body = client.get("/game/state").json()
    bare = _by_ticker(body)["BARE.OL"]
    assert bare["wall"] == "unsurveyed"
    assert bare["moat"] == "unsurveyed"
    assert bare["freshness"] == "unsurveyed"
    joined = " ".join(body["notes"])
    assert "no analysis yet" in joined
    assert "no usable balance-sheet facts" in joined


def test_diworsification_counts_shacks_and_exposes_concentration(client, db_session):
    _seed(db_session)
    body = client.get("/game/state").json()["diworsification"]
    assert body["position_count"] == 5
    assert body["shack_count"] == 0                 # smallest position is 5%
    assert body["shantytown"] == "none"
    assert D(body["hhi"]) == D(40 ** 2 + 30 ** 2 + 15 ** 2 + 10 ** 2 + 5 ** 2)


def test_vault_reads_account_cash_and_coin_ounces(client, db_session):
    account = _seed(db_session)
    db_session.add_all([
        PreciousMetalHolding(coin_series="Maple Leaf", metal="gold", quantity=D("2")),
        PreciousMetalHolding(coin_series="Philharmonic", metal="silver", quantity=D("10")),
    ])
    db_session.commit()

    before = client.get("/game/state").json()["vault"]
    assert before["level"] == "unsurveyed" and before["cash_nok"] is None
    assert D(before["gold_oz"]) == 2 and D(before["silver_oz"]) == 10

    r = client.patch(f"/accounts/{account.id}", json={"cash_nok": "250"})
    assert r.status_code == 200
    assert D(r.json()["cash_nok"]) == 250 and r.json()["cash_as_of"] is not None

    vault = client.get("/game/state").json()["vault"]
    assert D(vault["cash_nok"]) == 250
    assert D(vault["cash_share_pct"]) == 20          # 250 / (250 + 1000)
    assert vault["level"] == "deep"
    assert vault["accounts_with_cash"] == 1 and vault["accounts_total"] == 1


def test_cash_can_be_zero_and_cleared_and_never_negative(client, db_session):
    account = _seed(db_session)
    url = f"/accounts/{account.id}"
    zero = client.patch(url, json={"cash_nok": "0"}).json()
    assert D(zero["cash_nok"]) == 0 and zero["cash_as_of"] is not None
    assert client.get("/game/state").json()["vault"]["level"] == "empty"

    cleared = client.patch(url, json={"cash_nok": None}).json()
    assert cleared["cash_nok"] is None and cleared["cash_as_of"] is None
    assert client.get("/game/state").json()["vault"]["level"] == "unsurveyed"

    assert client.patch(url, json={"cash_nok": "-1"}).status_code == 422


def test_patching_other_fields_leaves_cash_alone(client, db_session):
    account = _seed(db_session)
    url = f"/accounts/{account.id}"
    client.patch(url, json={"cash_nok": "10"})
    stamp = client.get(url).json()["cash_as_of"]
    client.patch(url, json={"name": "Renamed"})
    after = client.get(url).json()
    assert after["name"] == "Renamed" and D(after["cash_nok"]) == 10 and after["cash_as_of"] == stamp


def test_demo_mode_returns_fabricated_state_and_never_the_real_database(client, db_session):
    _seed(db_session)
    assert client.put("/settings/demo-mode", json={"enabled": True}).status_code == 200
    body = client.get("/game/state").json()
    assert body["demo"] is True
    tickers = {t["ticker"] for t in body["towers"]}
    assert tickers == DEMO_TICKERS
    assert not tickers & {"CASH.OL", "GEAR.OL", "BANK.OL", "FUND", "BARE.OL"}
    # every wall material the demo is meant to show comes from invented figures
    assert {t["wall"] for t in body["towers"]} == {"basalt", "granite", "brick", "timber", "rotted"}
    assert D(body["vault"]["cash_nok"]) == 180000
    assert D(body["vault"]["gold_oz"]) == 12


def test_game_state_is_read_only(client, db_session):
    _seed(db_session)
    before = {
        "accounts": db_session.query(Account).count(),
        "runs": db_session.query(EquityAnalysisRun).count(),
        "items": db_session.query(FinancialLineItem).count(),
    }
    client.get("/game/state")
    db_session.expire_all()
    assert before == {
        "accounts": db_session.query(Account).count(),
        "runs": db_session.query(EquityAnalysisRun).count(),
        "items": db_session.query(FinancialLineItem).count(),
    }
