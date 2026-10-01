"""GET /game/state, G6 layer: the journal-driven temperament meter
(docs/game-mode-fortress-2026-10-01.md). Reads the decision journal, the
thesis tripwires and stored portfolio snapshots; writes nothing."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.models import Document, Holding
from app.models.account import Account
from app.models.journal import DecisionJournalEntry
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.models.thesis import ThesisTripwire

D = Decimal
NOW = datetime.now(timezone.utc)
TODAY = NOW.date()


def _doc(n):
    return Document(type="portfolio_export", original_filename=f"{n}.csv", mime_type="text/csv", size_bytes=1,
                    storage_path=f"{n}.csv", sha256=str(n) * 64, status="processed", quality_flags={})


def _seed(db):
    account = Account(name="ASK", account_number="1")
    alpha = Holding(ticker="AAA.OL", name="Alpha", trading_currency="NOK", asset_class_raw="stock")
    beta = Holding(ticker="BBB.OL", name="Beta", trading_currency="NOK", asset_class_raw="stock")
    gamma = Holding(ticker="CCC.OL", name="Gamma", trading_currency="NOK", asset_class_raw="stock")
    old = PortfolioSnapshot(source_file=_doc(1), reporting_currency="NOK", status="processed", account=account,
                            uploaded_at=NOW - timedelta(days=60))
    new = PortfolioSnapshot(source_file=_doc(2), reporting_currency="NOK", status="processed", account=account,
                            uploaded_at=NOW - timedelta(days=3))
    db.add_all([account, alpha, beta, gamma, old, new])
    # Alpha: kept 10 shares while 200 -> 160 (-20%): held through a drop.
    db.add(PortfolioPosition(snapshot=old, holding=alpha, quantity=D(10), last_price=D(200),
                             cost_basis_currency="NOK", market_value_nok=D(2000)))
    db.add(PortfolioPosition(snapshot=new, holding=alpha, quantity=D(10), last_price=D(160),
                             cost_basis_currency="NOK", market_value_nok=D(1600)))
    # Beta: sold out between the snapshots. Gamma: new.
    db.add(PortfolioPosition(snapshot=old, holding=beta, quantity=D(5), last_price=D(100),
                             cost_basis_currency="NOK", market_value_nok=D(500)))
    db.add(PortfolioPosition(snapshot=new, holding=gamma, quantity=D(5), last_price=D(100),
                             cost_basis_currency="NOK", market_value_nok=D(500)))
    db.commit()
    return alpha, beta, gamma


def _entry(holding, action, days_ago, **kw):
    return DecisionJournalEntry(
        holding_id=holding.id, ticker=holding.ticker, company_name=holding.name, action=action,
        decided_on=TODAY - timedelta(days=days_ago), thesis="test", **kw,
    )


def test_empty_journal_reads_the_snapshots_and_says_how_thin_it_is(client, db_session):
    _seed(db_session)
    body = client.get("/game/state").json()
    temp = body["temperament"]
    assert temp["decisions_logged"] == 0 and temp["low_confidence"] is True
    assert temp["snapshot_comparisons"] == 1
    assert [e["rule"] for e in temp["events"]] == ["held_through_drop"]
    assert temp["level"] == "composed" and D(temp["needle_pct"]) == 100
    assert "low-confidence" in temp["summary"]
    assert any("No decisions logged" in n for n in body["notes"])
    (turnover,) = temp["turnover"]
    assert (turnover["added"], turnover["removed"], turnover["resized"]) == (1, 1, 0)
    assert D(turnover["turnover_pct"]) == D("66.7")            # 2 changed of 3 seen


def test_journal_rules_and_tripwires_feed_the_meter(client, db_session):
    alpha, beta, gamma = _seed(db_session)
    db_session.add(ThesisTripwire(holding_id=beta.id, metric="roic", operator="below", threshold=D("0.1"),
                                  fired_at=NOW - timedelta(days=40)))
    db_session.add_all([
        _entry(beta, "sell", 30, verdict_at_decision="Buy", invalidation="x"),     # acted on tripwire
        _entry(gamma, "buy", 3, verdict_at_decision="Avoid", invalidation=None),   # 2 drains
        _entry(alpha, "hold", 200, review_6m="looked again"),                       # review restore
    ])
    db_session.commit()
    temp = client.get("/game/state").json()["temperament"]
    rules = sorted((e["kind"], e["rule"]) for e in temp["events"])
    assert rules == [
        ("drain", "bought_against_verdict"), ("drain", "no_invalidation"),
        ("restore", "acted_on_tripwire"), ("restore", "held_through_drop"), ("restore", "review_6m_done"),
    ]
    assert (temp["restores"], temp["drains"]) == (3, 2)
    assert D(temp["needle_pct"]) == D(60) and temp["level"] == "steady"
    assert temp["decisions_logged"] == 3


def test_the_meter_is_read_only(client, db_session):
    alpha, *_ = _seed(db_session)
    db_session.add(_entry(alpha, "buy", 5, invalidation=None))
    db_session.commit()
    before = [(e.id, e.review_6m, e.updated_at) for e in db_session.query(DecisionJournalEntry)]
    client.get("/game/state")
    db_session.expire_all()
    assert [(e.id, e.review_6m, e.updated_at) for e in db_session.query(DecisionJournalEntry)] == before


def test_demo_mode_shows_invented_temperament_only(client, db_session):
    alpha, *_ = _seed(db_session)
    db_session.add(_entry(alpha, "buy", 5, invalidation=None))
    db_session.commit()
    client.put("/settings/demo-mode", json={"enabled": True})
    body = client.get("/game/state").json()
    assert body["demo"] is True
    names = {e["holding_name"] for e in body["temperament"]["events"]}
    assert "Alpha" not in names and names
