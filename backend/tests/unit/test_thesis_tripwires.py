"""Unit tests for app.services.thesis.tripwires — Sprint 11: strict-
crossing firing in both directions, the "no data never clears a firing"
rule, edit/pause clearing state, and the regex-only "make a tripwire"
parser."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, Holding
from app.models.market import MarketObservation
from app.services.thesis.tripwires import (
    UNSET,
    acknowledge_tripwire,
    create_tripwire,
    evaluate_and_update,
    evaluate_holding_tripwires,
    parse_tripwire_from_text,
    update_tripwire,
)

D = Decimal
NOW = datetime.now(timezone.utc)


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def _holding(db) -> Holding:
    holding = Holding(ticker="AAPL", name="Apple Inc.", trading_currency="USD")
    db.add(holding)
    db.flush()
    return holding


def _price(db, holding, price, *, currency="USD", observed_at=NOW):
    db.add(MarketObservation(holding_id=holding.id, observed_at=observed_at, price=D(price), currency=currency, provider="fake"))
    db.flush()


@pytest.fixture()
def setup():
    db = _session()
    holding = _holding(db)
    db.commit()
    return db, holding


def test_below_tripwire_fires_when_price_drops_under_threshold(setup):
    db, holding = setup
    tripwire = create_tripwire(db, holding, metric="share_price", operator="below", threshold=D("100"))
    _price(db, holding, "120")

    evaluation = evaluate_and_update(db, tripwire, holding, now=NOW)
    assert not evaluation.firing

    _price(db, holding, "90", observed_at=NOW)
    evaluation = evaluate_and_update(db, tripwire, holding, now=NOW)
    assert evaluation.firing
    assert tripwire.fired_at == NOW


def test_above_tripwire_fires_when_value_exceeds_threshold(setup):
    db, holding = setup
    tripwire = create_tripwire(db, holding, metric="share_price", operator="above", threshold=D("100"))
    _price(db, holding, "150")

    evaluation = evaluate_and_update(db, tripwire, holding, now=NOW)
    assert evaluation.firing
    assert evaluation.current_value == D("150")


def test_fired_at_set_only_once_and_cleared_when_back_on_right_side(setup):
    db, holding = setup
    tripwire = create_tripwire(db, holding, metric="share_price", operator="below", threshold=D("100"))
    _price(db, holding, "90")
    first = evaluate_and_update(db, tripwire, holding, now=NOW)
    assert first.firing
    fired_at = tripwire.fired_at

    # Fires again later — fired_at does not move.
    later = evaluate_and_update(db, tripwire, holding, now=NOW.replace(microsecond=0))
    assert later.firing
    assert tripwire.fired_at == fired_at

    # Back above the threshold clears it.
    _price(db, holding, "110")
    back = evaluate_and_update(db, tripwire, holding, now=NOW)
    assert not back.firing
    assert tripwire.fired_at is None


def test_no_data_does_not_clear_an_existing_firing(setup):
    db, holding = setup
    tripwire = create_tripwire(db, holding, metric="roic", operator="below", threshold=D("0.05"))
    tripwire.fired_at = NOW
    db.commit()

    # No financial line items at all -> "no data".
    evaluation = evaluate_and_update(db, tripwire, holding, now=NOW)
    assert evaluation.current_value is None
    assert evaluation.unavailable_reason is not None
    assert evaluation.firing is True
    assert tripwire.fired_at is not None


def test_editing_threshold_clears_firing_state(setup):
    db, holding = setup
    tripwire = create_tripwire(db, holding, metric="share_price", operator="below", threshold=D("100"))
    tripwire.fired_at = NOW
    tripwire.seen_at = NOW
    db.commit()

    update_tripwire(db, tripwire, threshold=D("50"))
    assert tripwire.fired_at is None
    assert tripwire.seen_at is None
    assert tripwire.threshold == D("50")


def test_pausing_clears_firing_state_and_paused_tripwires_are_not_evaluated(setup):
    db, holding = setup
    tripwire = create_tripwire(db, holding, metric="share_price", operator="below", threshold=D("100"))
    _price(db, holding, "50")
    evaluate_and_update(db, tripwire, holding, now=NOW)
    assert tripwire.fired_at is not None

    update_tripwire(db, tripwire, active=False)
    assert tripwire.fired_at is None
    assert tripwire.active is False

    evaluations = evaluate_holding_tripwires(db, holding, now=NOW)
    assert evaluations[0].firing is False
    assert evaluations[0].unavailable_reason == "paused"


def test_update_tripwire_label_can_be_cleared_with_none_but_left_alone_when_unset(setup):
    db, holding = setup
    tripwire = create_tripwire(db, holding, metric="share_price", operator="below", threshold=D("100"), label="watch this")

    update_tripwire(db, tripwire, threshold=D("90"))  # label not passed
    assert tripwire.label == "watch this"

    update_tripwire(db, tripwire, label=None)
    assert tripwire.label is None
    assert tripwire.label is not UNSET


def test_acknowledge_requires_the_tripwire_to_be_firing(setup):
    db, holding = setup
    tripwire = create_tripwire(db, holding, metric="share_price", operator="below", threshold=D("100"))
    with pytest.raises(ValueError):
        acknowledge_tripwire(db, tripwire)

    tripwire.fired_at = NOW
    db.commit()
    acknowledge_tripwire(db, tripwire)
    assert tripwire.seen_at is not None


def test_create_tripwire_rejects_unknown_metric_or_operator(setup):
    db, holding = setup
    with pytest.raises(ValueError):
        create_tripwire(db, holding, metric="not_a_real_metric", operator="below", threshold=D("1"))
    with pytest.raises(ValueError):
        create_tripwire(db, holding, metric="share_price", operator="sideways", threshold=D("1"))


@pytest.mark.parametrize(
    ("text", "metric", "operator", "threshold"),
    [
        ("Net debt/EBITDA rises above 2.5x", "net_debt_to_ebitda", "above", D("2.5")),
        ("Gross margin falls below 30%", "gross_margin", "below", D("0.30")),
        ("Share price drops below 50", "share_price", "below", D("50")),
        ("ROIC below 8%", "roic", "below", D("0.08")),
    ],
)
def test_parse_tripwire_from_text_handles_common_phrasings(text, metric, operator, threshold):
    parsed = parse_tripwire_from_text(text)
    assert parsed is not None
    assert parsed.metric == metric
    assert parsed.operator == operator
    assert parsed.threshold == threshold


def test_parse_tripwire_from_text_returns_none_when_it_cant_confidently_parse():
    assert parse_tripwire_from_text("Management quality deteriorates") is None
    assert parse_tripwire_from_text("Something about margins") is None
