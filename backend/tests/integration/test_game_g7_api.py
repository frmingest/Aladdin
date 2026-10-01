"""GET /game/state, G7b layer: the two advisors (docs/game-mode-fortress-2026-10-01.md).
They are a pure view over the state the endpoint has already derived, so the
tests check that the lines come through the API, name the right holding, carry
their facts, respect demo mode, and write nothing."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from app.models import Document, Holding
from app.models.account import Account
from app.models.market import MarketObservation
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.models.snapshot import ComputedSnapshot
from app.schemas.risk import CorrelationOut, PortfolioRiskOut, RegimeOut, StressOut
from app.services.snapshots import RISK_KEY

D = Decimal
NOW = datetime.now(timezone.utc)


def _seed(db):
    account = Account(name="ASK", account_number="1")
    doc = Document(type="portfolio_export", original_filename="a.csv", mime_type="text/csv", size_bytes=1,
                   storage_path="a.csv", sha256="c" * 64, status="processed", quality_flags={})
    alpha = Holding(ticker="AAA.OL", name="Alpha", trading_currency="NOK", asset_class_raw="stock")
    beta = Holding(ticker="BBB.OL", name="Beta", trading_currency="NOK", asset_class_raw="stock")
    snap = PortfolioSnapshot(source_file=doc, reporting_currency="NOK", status="processed", account=account)
    db.add_all([account, doc, snap, alpha, beta])
    db.add(PortfolioPosition(snapshot=snap, holding=alpha, market_value_nok=D(700)))
    db.add(PortfolioPosition(snapshot=snap, holding=beta, market_value_nok=D(300)))
    db.commit()
    return alpha, beta


def test_an_empty_portfolio_has_advisors_with_nothing_to_say(client, db_session):
    body = client.get("/game/state").json()
    assert body["advisors"]["lines"] == [] and body["advisors"]["hidden_count"] == 0
    assert body["advisors"]["lines_version"] == "v1"


def test_the_advisors_say_what_the_stored_state_shows_and_nothing_more(client, db_session):
    alpha, _ = _seed(db_session)
    assert client.post(
        f"/thesis/holdings/{alpha.id}/tripwires",
        json={"metric": "share_price", "operator": "below", "threshold": "100", "label": "too cheap"},
    ).status_code == 201
    db_session.add(MarketObservation(holding_id=alpha.id, observed_at=NOW, price=50, currency="NOK", provider="fake"))
    db_session.commit()

    body = client.get("/game/state").json()
    advisors = body["advisors"]
    by_rule = {line["rule"]: line for line in advisors["lines"]}

    breach = by_rule["tripwire_fired"]
    assert breach["advisor"] == "partner" and breach["tone"] == "warning"
    assert breach["holding_name"] == "Alpha" and breach["holding_id"] == str(alpha.id)
    assert breach["facts"] and "1 of the conditions" in breach["text"]
    # the warning comes first, and there is no cheerful "all quiet" while a tripwire is firing
    assert advisors["lines"][0]["rule"] == "tripwire_fired"
    assert "all_quiet" not in by_rule
    # no cash entered: the Oracle says he cannot judge the vault
    assert by_rule["vault_unknown"]["advisor"] == "oracle"
    assert "not quotations" in advisors["disclaimer"]


def _calm_risk() -> PortfolioRiskOut:
    return PortfolioRiskOut(
        as_of=None, equity_value_nok=D(1000), lookback_days=252, cluster_threshold=D("0.8"),
        correlation=CorrelationOut(lookback_days=252, tickers=[], ticker_names={}, pairs=[], excluded=[]),
        clusters=[],
        stress=StressOut(std_devs=D(2), horizon_note="", portfolio_shock_pct=D("-0.05"),
                         portfolio_drawdown_nok=D(-50), total_value_considered_nok=D(1000), holdings=[]),
        regime=RegimeOut(regime="baseline", home_market_series_included=True, curve_and_credit_are_us_only=True,
                         explanation="Invented test explanation.", method_note="", inputs=[],
                         data_complete=True, missing=[]),
        price_history_notes=[],
    )


def test_unknown_weather_never_gets_the_calm_line(client, db_session):
    # Cash is entered, nothing is flagged, but no risk snapshot was ever stored:
    # the weather is "unsurveyed", and an advisor must not call that quiet.
    _seed(db_session)
    account = db_session.query(Account).one()
    assert client.patch(f"/accounts/{account.id}", json={"cash_nok": "250000"}).status_code == 200
    body = client.get("/game/state").json()
    assert body["siege"]["level"] == "unsurveyed"
    assert [line["rule"] for line in body["advisors"]["lines"]] == []


def test_a_quiet_realm_gets_the_calm_line_only_with_a_stored_calm_reading(client, db_session):
    _seed(db_session)
    account = db_session.query(Account).one()
    assert client.patch(f"/accounts/{account.id}", json={"cash_nok": "250000"}).status_code == 200
    db_session.add(ComputedSnapshot(key=RISK_KEY, payload=_calm_risk().model_dump_json(),
                                    fingerprint="not-the-current-fingerprint", computed_at=NOW))
    db_session.commit()
    body = client.get("/game/state").json()
    assert body["siege"]["level"] == "calm"
    rules = [line["rule"] for line in body["advisors"]["lines"]]
    assert rules == ["all_quiet"]
    (quiet,) = body["advisors"]["lines"]
    assert quiet["advisor"] == "oracle" and quiet["tone"] == "calm" and quiet["facts"]


def test_advisors_are_read_only(client, db_session):
    _seed(db_session)
    from app.models.journal import DecisionJournalEntry
    from app.models.thesis import ThesisTripwire

    before = (db_session.query(ThesisTripwire).count(), db_session.query(DecisionJournalEntry).count(),
              db_session.query(Account).one().cash_as_of)
    client.get("/game/state")
    db_session.expire_all()
    after = (db_session.query(ThesisTripwire).count(), db_session.query(DecisionJournalEntry).count(),
             db_session.query(Account).one().cash_as_of)
    assert before == after


def test_demo_mode_advisors_come_from_the_invented_state_only(client, db_session):
    _seed(db_session)
    assert client.put("/settings/demo-mode", json={"enabled": True}).status_code == 200
    body = client.get("/game/state").json()
    assert body["demo"] is True
    names = {line["holding_name"] for line in body["advisors"]["lines"] if line["holding_name"]}
    assert not names & {"Alpha", "Beta"}
    assert body["advisors"]["lines"], "the demo should show the advisors speaking"
