"""app/services/market_data/shares.py — the share count behind every
market multiple and the DCF (2026-09-25)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, Holding, ShareCountObservation
from app.providers.base import MarketDataUnavailableError
from app.services.market_data.shares import (
    add_manual_share_count,
    clear_manual_share_counts,
    eps_implied_range,
    record_sec_cover_shares,
    resolve_share_count,
)

D = Decimal
NOW = datetime.now(timezone.utc)


class _Yahoo:
    name = "yfinance"

    def __init__(self, shares: Decimal | None) -> None:
        self.shares = shares
        self.calls = 0

    def get_shares_outstanding(self, ticker: str) -> Decimal:
        self.calls += 1
        if self.shares is None:
            raise MarketDataUnavailableError("Yahoo blocked this IP")
        return self.shares


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture
def holding(db):
    h = Holding(ticker="SALME.OL", name="Salmon Evolution ASA", trading_currency="NOK")
    db.add(h)
    db.commit()
    return h


SALMON_FACTS = {"net_income": D("-47400000"), "eps_basic": D("-0.11")}


def test_eps_implied_range_reflects_rounding():
    low, high = eps_implied_range(SALMON_FACTS)
    assert D("412000000") < low < D("413000000")
    assert D("451000000") < high < D("452000000")
    assert eps_implied_range({"net_income": D(10), "eps_basic": D("0.004")}) is None


def test_yahoo_count_is_used_and_cached(db, holding):
    yahoo = _Yahoo(D("430000000"))
    first = resolve_share_count(db, holding, yahoo, latest_facts=SALMON_FACTS, latest_period="FY2024")
    second = resolve_share_count(db, holding, yahoo, latest_facts=SALMON_FACTS, latest_period="FY2024")
    assert first.shares == D("430000000")
    assert first.source == "yfinance"
    assert first.warnings == []
    assert second.shares == first.shares
    assert yahoo.calls == 1  # the 24 h cache served the second call


def test_count_far_from_eps_implied_is_flagged(db, holding):
    result = resolve_share_count(
        db, holding, _Yahoo(D("600000000")), latest_facts=SALMON_FACTS, latest_period="FY2024"
    )
    assert result.shares == D("600000000")
    assert "more than 10%" in result.warnings[0]
    assert "FY2024" in result.warnings[0]


def test_manual_count_wins_and_can_be_removed(db, holding):
    add_manual_share_count(
        db, holding, shares=D("500000000"), as_of=NOW, reference="https://newsweb.oslobors.no/x", note="rights issue"
    )
    yahoo = _Yahoo(D("430000000"))
    result = resolve_share_count(db, holding, yahoo)
    assert result.source == "manual"
    assert result.override_id is not None
    assert yahoo.calls == 0
    assert clear_manual_share_counts(db, holding) == 1
    assert resolve_share_count(db, holding, yahoo).source == "yfinance"


def test_recent_sec_cover_count_beats_yahoo_but_old_one_does_not(db, holding):
    record_sec_cover_shares(db, holding, shares=D(1000), as_of=NOW - timedelta(days=30), reference="sec")
    db.commit()
    yahoo = _Yahoo(D(2000))
    assert resolve_share_count(db, holding, yahoo).shares == D(1000)

    db.query(ShareCountObservation).delete()
    record_sec_cover_shares(db, holding, shares=D(1000), as_of=NOW - timedelta(days=800), reference="sec")
    db.commit()
    assert resolve_share_count(db, holding, yahoo).shares == D(2000)


def test_sec_cover_count_is_not_duplicated(db, holding):
    assert record_sec_cover_shares(db, holding, shares=D(5), as_of=NOW, reference="a") is not None
    assert record_sec_cover_shares(db, holding, shares=D(5), as_of=NOW, reference="a") is None


def test_filing_fact_is_last_resort_and_reasons_are_listed(db, holding):
    yahoo = _Yahoo(None)
    result = resolve_share_count(
        db, holding, yahoo, latest_facts={"shares_outstanding": D(777)}, latest_period="FY2025"
    )
    assert result.source == "filing"
    assert result.shares == D(777)

    nothing = resolve_share_count(db, holding, yahoo, latest_facts={})
    assert nothing.shares is None
    assert "Yahoo blocked this IP" in nothing.unavailable_reason


def test_provider_without_share_counts_is_tolerated(db, holding):
    class _Old:
        name = "old"

    result = resolve_share_count(db, holding, _Old(), latest_facts={"shares_outstanding": D(1)})
    assert result.source == "filing"


def test_manual_count_must_be_positive(db, holding):
    with pytest.raises(ValueError):
        add_manual_share_count(db, holding, shares=D(0), as_of=NOW, reference=None, note=None)
