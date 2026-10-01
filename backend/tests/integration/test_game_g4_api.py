"""GET /game/state, G4 layers: sieges, land for sale, tripwire breaches
(docs/game-mode-fortress-2026-10-01.md). Every layer reads *stored* data
(risk snapshot, margin-of-safety snapshot, thesis monitor) and must never
rebuild one or invent a value that was not stored."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.models import Document, Holding
from app.models.account import Account
from app.models.market import MarketObservation
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.models.snapshot import ComputedSnapshot
from app.schemas.risk import (
    ClusterFlagOut,
    CorrelationOut,
    HoldingStressOut,
    PortfolioRiskOut,
    RegimeOut,
    StressOut,
)
from app.schemas.valuation import BoardRowOut, MarginOfSafetyBoardOut
from app.services.snapshots import BOARD_KEY, RISK_KEY

D = Decimal
NOW = datetime.now(timezone.utc)


def _seed(db):
    account = Account(name="ASK", account_number="1")
    doc = Document(type="portfolio_export", original_filename="a.csv", mime_type="text/csv", size_bytes=1,
                   storage_path="a.csv", sha256="b" * 64, status="processed", quality_flags={})
    holdings = {
        "AAA.OL": Holding(ticker="AAA.OL", name="Alpha", trading_currency="NOK", asset_class_raw="stock"),
        "BBB.OL": Holding(ticker="BBB.OL", name="Beta", trading_currency="NOK", asset_class_raw="stock"),
        "CCC.OL": Holding(ticker="CCC.OL", name="Gamma", trading_currency="NOK", asset_class_raw="stock"),
        "DDD.OL": Holding(ticker="DDD.OL", name="Delta", trading_currency="NOK", asset_class_raw="stock"),
    }
    snap = PortfolioSnapshot(source_file=doc, reporting_currency="NOK", status="processed", account=account)
    db.add_all([account, doc, snap, *holdings.values()])
    for value, h in zip((400, 300, 200, 100), holdings.values(), strict=True):
        db.add(PortfolioPosition(snapshot=snap, holding=h, market_value_nok=D(value)))
    db.commit()
    return holdings


def _risk_payload(holdings, *, regime="baseline", shock="-0.30", complete=True):
    ids = {t: str(h.id) for t, h in holdings.items()}
    return PortfolioRiskOut(
        as_of=None, equity_value_nok=D(1000), lookback_days=252, cluster_threshold=D("0.8"),
        correlation=CorrelationOut(lookback_days=252, tickers=[], ticker_names={}, pairs=[], excluded=[]),
        clusters=[ClusterFlagOut(tickers=["AAA.OL", "BBB.OL"], names=["Alpha", "Beta"],
                                 correlation=D("0.85"), combined_weight_pct=D(70))],
        stress=StressOut(
            std_devs=D(2), horizon_note="", portfolio_shock_pct=D(shock) if shock is not None else None,
            portfolio_drawdown_nok=D(-300), total_value_considered_nok=D(1000),
            holdings=[
                HoldingStressOut(holding_id=ids["AAA.OL"], ticker="AAA.OL", name="Alpha", method="volatility",
                                 value_nok=D(400), weight_pct=D(40), shock_pct=D("-0.45"),
                                 contribution_nok=D(-180), reason=None),
                HoldingStressOut(holding_id=ids["BBB.OL"], ticker="BBB.OL", name="Beta", method="dcf_bear",
                                 value_nok=D(300), weight_pct=D(30), shock_pct=D("-0.25"),
                                 contribution_nok=D(-75), reason=None),
                HoldingStressOut(holding_id=ids["CCC.OL"], ticker="CCC.OL", name="Gamma", method="volatility",
                                 value_nok=D(200), weight_pct=D(20), shock_pct=D("-0.05"),
                                 contribution_nok=D(-10), reason=None),
                HoldingStressOut(holding_id=ids["DDD.OL"], ticker="DDD.OL", name="Delta", method="unavailable",
                                 value_nok=D(100), weight_pct=D(10), shock_pct=None,
                                 contribution_nok=None, reason="no price history"),
            ],
        ),
        regime=RegimeOut(regime=regime, home_market_series_included=True, curve_and_credit_are_us_only=True,
                         explanation="Invented test explanation.", method_note="", inputs=[],
                         data_complete=complete, missing=[]),
        price_history_notes=[],
    )


def _board_row(holding, *, zone, mos, status="ok", reason=None):
    return BoardRowOut(
        holding_id=holding.id, ticker=holding.ticker, name=holding.name, sector=None,
        market_value_nok=None, weight_pct=None, valuation_currency="NOK", price=None, price_as_of=None,
        bear=None, base=None, bull=None, margin_of_safety_base=mos, margin_of_safety_bear=None, zone=zone,
        unavailable_reason=reason, verdict_rating=None, moat_rating=None, analyzed_at=None,
        valuation_status=status,
    )


def _board_payload(holdings):
    rows = [
        _board_row(holdings["AAA.OL"], zone="below_bear", mos=D("0.55")),
        _board_row(holdings["BBB.OL"], zone="bear_to_base", mos=D("0.18")),
        _board_row(holdings["CCC.OL"], zone="above_bull", mos=D("-0.40")),
        # the board still carries a zone for a withheld valuation; the game must not show it
        _board_row(holdings["DDD.OL"], zone="below_bear", mos=D("0.93"), status="implausible",
                   reason="valuation withheld as implausible"),
    ]
    return MarginOfSafetyBoardOut(rows=rows, total_equity_value_nok=D(1000), zone_counts={})


def _store(db, key, model, *, days_old=0, fingerprint="not-the-current-fingerprint"):
    db.add(ComputedSnapshot(key=key, payload=model.model_dump_json(), fingerprint=fingerprint,
                            computed_at=NOW - timedelta(days=days_old)))
    db.commit()


def _by_ticker(body):
    return {t["ticker"]: t for t in body["towers"]}


def test_nothing_stored_means_fog_and_notes_that_say_how_to_fix_it(client, db_session):
    _seed(db_session)
    body = client.get("/game/state").json()
    assert body["siege"]["level"] == "unsurveyed"
    assert body["siege"]["risk_snapshot_at"] is None and body["siege"]["land_snapshot_at"] is None
    for tower in body["towers"]:
        assert tower["land"] == "fog"
        assert tower["siege_exposure"] == "unsurveyed" and tower["siege_shock_pct"] is None
        assert tower["shared_wall_with"] == [] and tower["margin_of_safety_pct"] is None
    joined = " ".join(body["notes"])
    assert "No stored portfolio-risk snapshot" in joined
    assert "No stored margin-of-safety snapshot" in joined


def test_stored_risk_gives_weather_exposure_and_shared_walls(client, db_session):
    holdings = _seed(db_session)
    _store(db_session, RISK_KEY, _risk_payload(holdings, regime="stagflation", shock="-0.30"), days_old=1)
    body = client.get("/game/state").json()

    siege = body["siege"]
    assert siege["level"] == "gathering"            # stagflation, and -30% is past the -25% edge
    assert siege["regime"] == "stagflation"
    assert D(siege["portfolio_shock_pct"]) == D("-0.30")
    assert siege["risk_snapshot_age_days"] == 1 and siege["risk_snapshot_stale"] is False
    assert siege["shared_walls"] == [
        {"names": ["Alpha", "Beta"], "tickers": ["AAA.OL", "BBB.OL"],
         "correlation": "0.85", "combined_weight_pct": "70"}
    ] or siege["shared_walls"][0]["names"] == ["Alpha", "Beta"]

    towers = _by_ticker(body)
    assert towers["AAA.OL"]["siege_exposure"] == "breach_risk"     # -45%
    assert D(towers["AAA.OL"]["siege_shock_pct"]) == D("-0.45")
    assert towers["AAA.OL"]["siege_method"] == "volatility"
    assert towers["BBB.OL"]["siege_exposure"] == "exposed"         # -25%
    assert towers["BBB.OL"]["siege_method"] == "dcf_bear"
    assert towers["CCC.OL"]["siege_exposure"] == "sheltered"       # -5%
    assert towers["DDD.OL"]["siege_exposure"] == "unsurveyed"      # no stress result stored
    assert towers["DDD.OL"]["siege_method"] is None
    assert towers["AAA.OL"]["shared_wall_with"] == ["Beta"]
    assert towers["BBB.OL"]["shared_wall_with"] == ["Alpha"]
    assert towers["CCC.OL"]["shared_wall_with"] == []


def test_a_crisis_regime_is_a_siege_even_with_a_mild_stress_result(client, db_session):
    holdings = _seed(db_session)
    _store(db_session, RISK_KEY, _risk_payload(holdings, regime="crisis", shock="-0.05"))
    assert client.get("/game/state").json()["siege"]["level"] == "besieged"


def test_land_for_sale_reads_the_stored_zone_and_fogs_withheld_valuations(client, db_session):
    holdings = _seed(db_session)
    _store(db_session, BOARD_KEY, _board_payload(holdings), days_old=2)
    body = client.get("/game/state").json()
    towers = _by_ticker(body)
    assert towers["AAA.OL"]["land"] == "bargain" and D(towers["AAA.OL"]["margin_of_safety_pct"]) == 55
    assert towers["BBB.OL"]["land"] == "discount" and D(towers["BBB.OL"]["margin_of_safety_pct"]) == 18
    assert towers["CCC.OL"]["land"] == "overpriced"
    delta = towers["DDD.OL"]
    assert delta["land"] == "fog"
    assert delta["margin_of_safety_pct"] is None          # the implausible 93% is never shown
    assert "implausible" in delta["land_reason"]
    assert body["siege"]["land_snapshot_age_days"] == 2 and body["siege"]["land_snapshot_stale"] is False


def test_old_snapshots_are_shown_but_labelled_stale(client, db_session):
    holdings = _seed(db_session)
    _store(db_session, RISK_KEY, _risk_payload(holdings), days_old=10)
    _store(db_session, BOARD_KEY, _board_payload(holdings), days_old=8)
    body = client.get("/game/state").json()
    assert body["siege"]["risk_snapshot_stale"] is True and body["siege"]["land_snapshot_stale"] is True
    joined = " ".join(body["notes"])
    assert "risk snapshot is 10 days old" in joined
    assert "margin-of-safety prices are 8 days old" in joined
    assert _by_ticker(body)["AAA.OL"]["land"] == "bargain"      # still shown, not hidden


def test_snapshot_exactly_at_the_stale_limit_is_not_stale(client, db_session):
    holdings = _seed(db_session)
    _store(db_session, RISK_KEY, _risk_payload(holdings), days_old=7)
    assert client.get("/game/state").json()["siege"]["risk_snapshot_stale"] is False


def test_a_corrupt_stored_snapshot_degrades_to_fog_not_an_error(client, db_session):
    _seed(db_session)
    db_session.add(ComputedSnapshot(key=RISK_KEY, payload="{not json", fingerprint="x", computed_at=NOW))
    db_session.commit()
    response = client.get("/game/state")
    assert response.status_code == 200
    assert response.json()["siege"]["level"] == "unsurveyed"


def test_a_fired_tripwire_breaches_the_tower(client, db_session):
    holdings = _seed(db_session)
    alpha = holdings["AAA.OL"]
    created = client.post(
        f"/thesis/holdings/{alpha.id}/tripwires",
        json={"metric": "share_price", "operator": "below", "threshold": "100", "label": "too cheap"},
    )
    assert created.status_code == 201, created.text
    db_session.add(MarketObservation(holding_id=alpha.id, observed_at=NOW, price=50, currency="NOK",
                                     provider="fake"))
    db_session.commit()

    body = client.get("/game/state").json()
    towers = _by_ticker(body)
    assert towers["AAA.OL"]["thesis"] == "breached" and towers["AAA.OL"]["tripwires_fired"] == 1
    assert towers["BBB.OL"]["thesis"] == "not_analyzed"            # no analysis run stored
    assert body["siege"]["breached_count"] == 1
    assert any("tripwire that has fired" in n for n in body["notes"])


def test_g4_layers_are_read_only_and_never_rebuild_a_snapshot(client, db_session):
    holdings = _seed(db_session)
    _store(db_session, RISK_KEY, _risk_payload(holdings), days_old=1)
    before = {r.key: (r.payload, r.computed_at, r.fingerprint) for r in db_session.query(ComputedSnapshot)}
    client.get("/game/state")
    db_session.expire_all()
    after = {r.key: (r.payload, r.computed_at, r.fingerprint) for r in db_session.query(ComputedSnapshot)}
    assert before == after
    assert set(after) == {RISK_KEY}         # the board was never built behind the player's back


def test_demo_mode_shows_every_g4_state_from_invented_data(client, db_session):
    holdings = _seed(db_session)
    _store(db_session, RISK_KEY, _risk_payload(holdings, regime="crisis"))   # real-looking data must not leak
    assert client.put("/settings/demo-mode", json={"enabled": True}).status_code == 200
    body = client.get("/game/state").json()
    assert body["demo"] is True
    towers = _by_ticker(body)
    assert not set(towers) & {"AAA.OL", "BBB.OL", "CCC.OL", "DDD.OL"}
    assert body["siege"]["level"] == "gathering"            # invented -27% scenario, baseline regime
    assert body["siege"]["regime"] == "baseline"
    assert body["siege"]["breached_count"] == 1 and towers["HD"]["thesis"] == "breached"
    assert towers["PG"]["thesis"] == "review"
    assert {t["siege_exposure"] for t in towers.values()} >= {"sheltered", "exposed", "breach_risk"}
    assert {t["land"] for t in towers.values()} == {"bargain", "discount", "full_price", "overpriced", "fog"}
    assert towers["XOM"]["margin_of_safety_pct"] is None            # fog never carries a number
    assert towers["AAPL"]["shared_wall_with"] and "Apple Inc." not in towers["AAPL"]["shared_wall_with"]
    assert uuid.UUID(towers["AAPL"]["holding_id"])
