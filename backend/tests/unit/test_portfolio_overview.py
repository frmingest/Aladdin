"""Unit tests for app.services.portfolio_overview (Sprint 5 dashboard)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, Document, Holding
from app.models.account import Account
from app.models.analysis import EquityAnalysisRun
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.services.analysis.latest import latest_runs_by_holding
from app.services.portfolio_overview import (
    NOT_ANALYZED,
    UNCLASSIFIED,
    build_overview,
    executive_summary,
)

D = Decimal
NOW = datetime(2026, 9, 23, 12, tzinfo=timezone.utc)


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def _holding(db, ticker, *, kind="stock", sector="Energy", currency="NOK"):
    h = Holding(ticker=ticker, name=f"{ticker} ASA", trading_currency=currency, asset_class_raw=kind, sector=sector)
    db.add(h)
    db.flush()
    return h


def _account(db, number, name=None):
    a = Account(name=name or f"Account {number}", account_number=number)
    db.add(a)
    db.flush()
    return a


def _snapshot(db, account, *, age_days=0):
    doc = Document(
        type="portfolio_export", original_filename="x.csv", mime_type="text/csv", size_bytes=1,
        storage_path=f"p/{account.account_number}-{age_days}.csv",
        sha256=f"{account.account_number}{age_days}".ljust(64, "0"), status="processed", quality_flags={},
    )
    db.add(doc)
    db.flush()
    snap = PortfolioSnapshot(source_file=doc, reporting_currency="NOK", status="processed", account=account,
                             uploaded_at=NOW - timedelta(days=age_days))
    db.add(snap)
    db.flush()
    return snap


def _position(db, snapshot, holding, value):
    db.add(PortfolioPosition(snapshot=snapshot, holding=holding,
                             market_value_nok=None if value is None else D(value)))
    db.flush()


def _run(db, holding, *, verdict="Buy", moat="Wide", age_days=1, reconciled=None, failed=False):
    started = NOW - timedelta(days=age_days)
    run = EquityAnalysisRun(
        holding_id=holding.id, status="FAILED" if failed else "COMPLETED", schema_version="v1",
        blind_prompt_version="v1", evidence_packet_version="v3", evidence_packet_json=[],
        evidence_unavailable_reasons=[], started_at=started,
        completed_at=None if failed else started,
        blind_pass_json=None if failed else {"verdict": {"rating": verdict}, "moat": {"overall_rating": moat}},
        reconciliation_json={"verdict": {"rating": reconciled}} if reconciled else None,
    )
    db.add(run)
    db.flush()
    return run


def test_empty_database_returns_empty_overview(db):
    o = build_overview(db, now=NOW)
    assert o.as_of is None
    assert o.total_value_nok == 0
    assert o.positions == []
    assert o.summary == []


def test_totals_allocation_and_only_latest_snapshot_per_account(db):
    acc1, acc2 = _account(db, "1", "ASK"), _account(db, "2", "Pension")
    eqnr, var, fund = _holding(db, "EQNR.OL"), _holding(db, "VAR.OL"), _holding(
        db, "BOND", kind="bond_fund", sector=None, currency="NOK")
    old = _snapshot(db, acc1, age_days=10)
    _position(db, old, eqnr, "999999")  # superseded, must be ignored
    s1 = _snapshot(db, acc1)
    _position(db, s1, eqnr, "600")
    _position(db, s1, var, "200")
    s2 = _snapshot(db, acc2)
    _position(db, s2, eqnr, "100")
    _position(db, s2, fund, "100")

    o = build_overview(db, now=NOW)
    assert o.total_value_nok == D(1000)
    assert o.holding_count == 3
    assert o.position_count == 4
    assert o.equity_value_nok == D(900)
    assert [a.name for a in o.accounts] == ["ASK", "Pension"]
    assert o.accounts[0].value_nok == D(800)

    types = {s.key: s for s in o.by_instrument_type}
    assert types["stock"].weight_pct == D(90)
    assert types["bond_fund"].label == "Bond fund"
    sectors = {s.key: s for s in o.by_sector}
    assert sectors["Energy"].value_nok == D(900)
    assert sectors[UNCLASSIFIED].holding_count == 1

    top = o.positions[0]
    assert top.ticker == "EQNR.OL"
    assert top.value_nok == D(700)
    assert top.account_count == 2
    assert top.weight_pct == D(70)


def test_concentration_hhi_and_effective_holdings(db):
    acc = _account(db, "1")
    snap = _snapshot(db, acc)
    for i in range(4):
        _position(db, snap, _holding(db, f"H{i}.OL"), "250")
    c = build_overview(db, now=NOW).concentration
    assert c.hhi == D(2500)  # 4 x 25^2
    assert c.effective_holdings == D(4)
    assert c.top1_pct == D(25)
    assert c.top5_pct == D(100)


def test_verdict_and_moat_rollup_is_value_weighted(db):
    acc = _account(db, "1")
    snap = _snapshot(db, acc)
    a, b, c = _holding(db, "A.OL"), _holding(db, "B.OL"), _holding(db, "C.OL")
    _position(db, snap, a, "500")
    _position(db, snap, b, "300")
    _position(db, snap, c, "200")
    _run(db, a, verdict="Buy", moat="Wide", reconciled="Hold")  # reconciliation wins
    _run(db, b, verdict="Avoid", moat="None")

    o = build_overview(db, now=NOW)
    verdicts = {v.rating: v for v in o.verdicts}
    assert verdicts["Hold"].value_nok == D(500)
    assert verdicts["Avoid"].weight_pct == D(30)
    assert verdicts[NOT_ANALYZED].holding_count == 1
    assert "Buy" not in verdicts
    moats = {m.rating: m for m in o.moats}
    assert moats["Wide"].weight_pct == D(50)
    assert o.analyzed_equity_count == 2
    assert o.analyzed_equity_value_pct == D(80)


def test_failed_newer_run_does_not_hide_older_result(db):
    h = _holding(db, "A.OL")
    _run(db, h, verdict="Buy", age_days=5)
    _run(db, h, age_days=0, failed=True)
    runs = latest_runs_by_holding(db, [h.id])
    assert runs[h.id].blind_pass_json["verdict"]["rating"] == "Buy"


def test_non_equity_is_excluded_from_verdict_rollup(db):
    acc = _account(db, "1")
    snap = _snapshot(db, acc)
    _position(db, snap, _holding(db, "MM", kind="money_market_fund"), "100")
    o = build_overview(db, now=NOW)
    assert o.equity_count == 0
    assert o.verdicts == []


def test_stale_analysis_and_stale_snapshot_flags(db):
    acc = _account(db, "1", "Old account")
    snap = _snapshot(db, acc, age_days=60)
    h = _holding(db, "A.OL")
    _position(db, snap, h, "100")
    _run(db, h, age_days=200)
    o = build_overview(db, now=NOW)
    assert o.stale_analysis_count == 1
    assert o.positions[0].analysis_stale is True
    assert o.accounts[0].stale is True
    texts = " ".join(p.text for p in o.summary)
    assert "older than 180 days" in texts
    assert "Old account" in texts


def test_missing_values_count_as_zero_and_are_reported(db):
    acc = _account(db, "1")
    snap = _snapshot(db, acc)
    _position(db, snap, _holding(db, "A.OL"), "100")
    _position(db, snap, _holding(db, "B.OL"), None)
    o = build_overview(db, now=NOW)
    assert o.total_value_nok == D(100)
    assert o.positions_missing_value == 1
    assert any("no market value" in p.text for p in o.summary)


def test_summary_flags_large_position_sector_and_sell_ratings(db):
    acc = _account(db, "1")
    snap = _snapshot(db, acc)
    big = _holding(db, "BIG.OL", sector="Energy")
    small = _holding(db, "SMALL.OL", sector="Industrials")
    usd = _holding(db, "KO", sector="Consumer Staples", currency="USD")
    _position(db, snap, big, "800")
    _position(db, snap, small, "100")
    _position(db, snap, usd, "100")
    _run(db, small, verdict="Sell", moat="Narrow")

    points = build_overview(db, now=NOW).summary
    warn = [p.text for p in points if p.tone == "warn"]
    assert any("BIG.OL ASA at 80.0%" in t for t in warn)
    assert any(t.startswith("Energy is 80.0%") for t in warn)
    assert any("Sell or Avoid" in t and "SMALL.OL ASA" in t for t in warn)
    assert any("10.0% of the portfolio trades in currencies other than NOK" in p.text for p in points)
    assert any("1 of 3 stocks/equity ETFs have an analysis" in p.text for p in points)
    # Deterministic: same input, same sentences.
    assert executive_summary(build_overview(db, now=NOW)) == points
