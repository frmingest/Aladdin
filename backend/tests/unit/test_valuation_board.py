"""Unit tests for app.services.valuation.board (feature F3).

The valuation itself is Sprint 3's and already tested; here it's replaced
with a controlled fake so these tests cover only what the board adds:
which holdings are included, position values/weights, zone placement,
verdict attachment and ranking."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, Document, Holding
from app.models.account import Account
from app.models.analysis import EquityAnalysisRun
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.services.valuation import board as board_module
from app.services.valuation.board import (
    ABOVE_BULL,
    BASE_TO_BULL,
    BEAR_TO_BASE,
    BELOW_BEAR,
    UNAVAILABLE,
    build_board,
    current_positions,
)

D = Decimal
NOW = datetime.now(timezone.utc)


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def _holding(db, ticker, asset_class_raw="stock"):
    h = Holding(ticker=ticker, name=f"{ticker} Corp", trading_currency="NOK", asset_class_raw=asset_class_raw)
    db.add(h)
    db.flush()
    return h


def _snapshot(db, account, *, age_days=0):
    document = Document(
        type="portfolio_export", original_filename="x.csv", mime_type="text/csv", size_bytes=1,
        storage_path=f"p/{account.account_number}-{age_days}.csv", sha256=f"{account.account_number}{age_days}".ljust(64, "0"),
        status="processed", quality_flags={},
    )
    db.add(document)
    db.flush()
    snap = PortfolioSnapshot(
        source_file=document, reporting_currency="NOK", status="processed", account=account,
        uploaded_at=NOW - timedelta(days=age_days),
    )
    db.add(snap)
    db.flush()
    return snap


def _position(db, snapshot, holding, value):
    db.add(PortfolioPosition(
        snapshot=snapshot, holding=holding, market_value_nok=None if value is None else D(value),
    ))
    db.flush()


def _fake_valuation(values: dict[str, tuple]):
    """values[ticker] = (price, bear, base, bull) or None for no DCF."""

    def fake(db, holding, market, rate):
        spec = values.get(holding.ticker)
        if spec is None:
            return SimpleNamespace(
                valuation_currency="NOK", current_price_per_share=None, as_of=None, dcf=None,
                unavailable_reasons=["DCF unavailable: fewer than two periods"],
            )
        price, bear, base, bull = (None if v is None else D(v) for v in spec)
        scenarios = [
            SimpleNamespace(label="bear", intrinsic_value_per_share=bear),
            SimpleNamespace(label="base", intrinsic_value_per_share=base),
            SimpleNamespace(label="bull", intrinsic_value_per_share=bull),
        ]
        by_label = {s.label: s.intrinsic_value_per_share for s in scenarios}

        def mos(label):
            return None if price is None else (by_label[label] - price) / by_label[label]

        return SimpleNamespace(
            valuation_currency="NOK", current_price_per_share=price, as_of=NOW,
            dcf=SimpleNamespace(scenarios=scenarios, margin_of_safety=mos),
            unavailable_reasons=[] if price is not None else ["current price unavailable"],
        )

    return fake


@pytest.fixture()
def setup(monkeypatch):
    db = _session()
    account = Account(name="ASK", account_number="111")
    other = Account(name="AF", account_number="222")
    db.add_all([account, other])
    db.flush()

    old = _snapshot(db, account, age_days=10)
    latest = _snapshot(db, account, age_days=0)
    other_latest = _snapshot(db, other, age_days=1)

    cheap, fair, rich, nodcf, bond, sold = (
        _holding(db, "CHEAP"), _holding(db, "FAIR"), _holding(db, "RICH"),
        _holding(db, "NODCF"), _holding(db, "BOND", "bond_fund"), _holding(db, "SOLD"),
    )
    _position(db, old, sold, "999")  # only in an older snapshot -> not current
    _position(db, latest, cheap, "3000")
    _position(db, latest, fair, "1000")
    _position(db, other_latest, fair, "1000")  # same holding in two accounts -> summed
    _position(db, latest, rich, "2000")
    _position(db, latest, nodcf, "2000")
    _position(db, latest, bond, "5000")
    db.commit()

    monkeypatch.setattr(board_module, "compute_holding_valuation", _fake_valuation({
        "CHEAP": ("50", "60", "100", "140"),   # below bear, MoS 50%
        "FAIR": ("90", "60", "100", "140"),    # bear..base, MoS 10%
        "RICH": ("160", "60", "100", "140"),   # above bull, MoS -60%
    }))
    return db, {"cheap": cheap, "fair": fair, "rich": rich, "nodcf": nodcf}


def test_current_positions_use_latest_snapshot_per_account(setup):
    db, _ = setup
    tickers = {p.holding.ticker for p in current_positions(db)}
    assert "SOLD" not in tickers
    assert {"CHEAP", "FAIR", "RICH", "NODCF", "BOND"} <= tickers


def test_board_ranks_by_margin_of_safety_and_excludes_non_equity(setup):
    db, _ = setup
    board = build_board(db, market_data_provider=None, risk_free_rate_provider=None)
    assert [r.ticker for r in board.rows] == ["CHEAP", "FAIR", "RICH", "NODCF"]
    assert board.rows[0].zone == BELOW_BEAR
    assert board.rows[1].zone == BEAR_TO_BASE
    assert board.rows[2].zone == ABOVE_BULL
    assert board.rows[3].zone == UNAVAILABLE
    assert "fewer than two periods" in board.rows[3].unavailable_reason
    assert board.rows[0].margin_of_safety_base == D("0.5")


def test_values_are_summed_across_accounts_and_weighted_on_equities_only(setup):
    db, _ = setup
    board = build_board(db, market_data_provider=None, risk_free_rate_provider=None)
    by_ticker = {r.ticker: r for r in board.rows}
    assert by_ticker["FAIR"].market_value_nok == D("2000")
    assert board.total_equity_value_nok == D("9000")  # bond fund's 5000 excluded
    assert by_ticker["CHEAP"].weight_pct == D("3000") / D("9000")


def test_zone_counts(setup):
    db, _ = setup
    counts = build_board(db, market_data_provider=None, risk_free_rate_provider=None).zone_counts()
    assert counts == {BELOW_BEAR: 1, BEAR_TO_BASE: 1, BASE_TO_BULL: 0, ABOVE_BULL: 1, UNAVAILABLE: 1}


def test_base_to_bull_zone(monkeypatch, setup):
    db, _ = setup
    monkeypatch.setattr(board_module, "compute_holding_valuation", _fake_valuation({"CHEAP": ("120", "60", "100", "140")}))
    row = next(r for r in build_board(db, market_data_provider=None, risk_free_rate_provider=None).rows if r.ticker == "CHEAP")
    assert row.zone == BASE_TO_BULL


def test_latest_verdict_and_moat_attached(setup):
    db, holdings = setup
    for started, rating in ((NOW - timedelta(days=5), "Sell"), (NOW, "Buy")):
        db.add(EquityAnalysisRun(
            holding_id=holdings["cheap"].id, status="COMPLETED", schema_version="v1", blind_prompt_version="v1",
            evidence_packet_version="v2", evidence_packet_json={}, evidence_unavailable_reasons=[],
            started_at=started,
            blind_pass_json={"moat": {"overall_rating": "Wide"}, "verdict": {"rating": "Hold"}},
            reconciliation_json={"verdict": {"rating": rating}},
        ))
    db.commit()
    row = next(r for r in build_board(db, market_data_provider=None, risk_free_rate_provider=None).rows if r.ticker == "CHEAP")
    assert row.verdict_rating == "Buy"  # reconciled verdict of the latest run
    assert row.moat_rating == "Wide"


def test_empty_portfolio_gives_empty_board():
    db = _session()
    board = build_board(db, market_data_provider=None, risk_free_rate_provider=None)
    assert board.rows == [] and board.total_equity_value_nok == 0
