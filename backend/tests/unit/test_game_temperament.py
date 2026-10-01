"""Boundary tests for the temperament meter (app/services/game/temperament.py, G6).

The meter judges Faiz's own decisions, so every rule is pinned on both sides
of its edge, and the "never reward trading / never call a trim a panic" rules
are tested explicitly.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from app.domain.game_mapping import get_game_mapping
from app.services.game import temperament as t
from app.services.game.temperament import (
    DecisionFact,
    PositionStep,
    TemperamentInputs,
    TurnoverFact,
)

D = Decimal
M = get_game_mapping("v1")
NOW = datetime(2026, 10, 1, 12, tzinfo=timezone.utc)
TODAY = NOW.date()
HID = uuid.uuid4()


def _d(action="buy", days_ago=10, *, verdict=None, invalidation=True, r6=False, r12=False, holding=HID):
    return DecisionFact(
        entry_id=uuid.uuid4(), holding_id=holding, ticker="AAA.OL", name="Alpha", action=action,
        decided_on=TODAY - timedelta(days=days_ago), verdict_at_decision=verdict,
        has_invalidation=invalidation, review_6m_written=r6, review_12m_written=r12,
    )


def _rules(events):
    return sorted((e.kind, e.rule) for e in events)


def _events(d, fired=None):
    return _rules(t.decision_events(d, fired or {}, today=TODAY))


# --- single-entry rules ---------------------------------------------------


def test_a_well_documented_buy_is_neutral():
    assert _events(_d("buy", verdict="Buy")) == []


def test_buying_against_a_sell_or_avoid_verdict_drains():
    assert ("drain", "bought_against_verdict") in _events(_d("buy", verdict="Sell"))
    assert ("drain", "bought_against_verdict") in _events(_d("add", verdict="Avoid"))
    assert ("drain", "bought_against_verdict") not in _events(_d("add", verdict="Hold"))


def test_buy_without_invalidation_drains_but_sell_without_one_does_not():
    assert ("drain", "no_invalidation") in _events(_d("buy", invalidation=False))
    assert _events(_d("sell", invalidation=False)) == []


def test_selling_a_buy_rated_holding_with_no_tripwire_is_a_panic_sell():
    assert _events(_d("sell", verdict="Strong Buy")) == [("drain", "sold_intact_thesis")]


def test_a_trim_or_a_sell_after_hold_is_never_called_a_panic_sell():
    assert _events(_d("trim", verdict="Buy")) == []
    assert _events(_d("sell", verdict="Hold")) == []
    assert _events(_d("sell", verdict=None)) == []


def test_selling_after_a_tripwire_fired_restores_and_is_not_a_panic_sell():
    fired = {HID: [NOW - timedelta(days=20)]}
    assert _events(_d("sell", days_ago=10, verdict="Buy"), fired) == [("restore", "acted_on_tripwire")]
    assert _events(_d("trim", days_ago=10), fired) == [("restore", "acted_on_tripwire")]


def test_a_tripwire_firing_on_the_same_day_counts_but_one_after_does_not():
    same_day = {HID: [datetime.combine(TODAY - timedelta(days=10), datetime.min.time(), timezone.utc)]}
    assert _events(_d("sell", days_ago=10), same_day) == [("restore", "acted_on_tripwire")]
    later = {HID: [NOW - timedelta(days=5)]}
    assert _events(_d("sell", days_ago=10, verdict="Buy"), later) == [("drain", "sold_intact_thesis")]


def test_buying_after_a_tripwire_is_not_rewarded():
    fired = {HID: [NOW - timedelta(days=20)]}
    assert _events(_d("buy", days_ago=10, verdict="Buy"), fired) == []


def test_reviews_restore_only_once_they_are_due_and_written():
    assert _events(_d("hold", days_ago=181, r6=True)) == []
    assert _events(_d("hold", days_ago=182, r6=True)) == [("restore", "review_6m_done")]
    assert _events(_d("hold", days_ago=182, r6=False)) == []
    assert _events(_d("hold", days_ago=365, r6=True, r12=True)) == [
        ("restore", "review_12m_done"), ("restore", "review_6m_done"),
    ]


# --- churn ---------------------------------------------------------------


def test_three_trades_inside_ninety_days_is_one_churn_line():
    trades = [_d("buy", 90), _d("add", 45), _d("trim", 0)]
    events = t.churn_events(trades, M)
    assert len(events) == 1 and events[0].rule == "churn" and "3 trades" in events[0].explanation


def test_three_trades_just_over_ninety_days_is_not_churn():
    assert t.churn_events([_d("buy", 91), _d("add", 45), _d("trim", 0)], M) == []


def test_a_burst_counts_once_and_hold_or_pass_entries_are_not_trades():
    burst = [_d("buy", 30 - i) for i in range(5)]
    assert len(t.churn_events(burst, M)) == 1
    assert t.churn_events([_d("hold", 3), _d("pass", 2), _d("buy", 1)], M) == []


def test_churn_is_judged_per_holding():
    other = uuid.uuid4()
    mixed = [_d("buy", 3), _d("add", 2), _d("buy", 1, holding=other)]
    assert t.churn_events(mixed, M) == []


# --- held through a drop ----------------------------------------------------


def _step(before="100", after="85", qb="10", qa="10", *, same=True):
    return PositionStep(
        holding_id=HID, name="Alpha", from_at=NOW - timedelta(days=60), to_at=NOW - timedelta(days=5),
        quantity_before=D(qb), quantity_after=D(qa), price_before=D(before), price_after=D(after),
        same_currency=same,
    )


def test_holding_through_a_fifteen_percent_fall_restores():
    event = t.held_through_drop(_step("100", "85"), {}, M)
    assert event is not None and event.rule == "held_through_drop" and "15.0%" in event.explanation


def test_a_smaller_fall_is_noise():
    assert t.held_through_drop(_step("100", "85.01"), {}, M) is None


def test_selling_some_during_the_fall_is_not_holding_but_adding_is():
    assert t.held_through_drop(_step(qa="9"), {}, M) is None
    assert t.held_through_drop(_step(qa="12"), {}, M) is not None


def test_holding_after_a_tripwire_fired_is_neither_rewarded_nor_punished():
    assert t.held_through_drop(_step(), {HID: [NOW - timedelta(days=30)]}, M) is None


def test_prices_in_different_currencies_or_missing_are_not_compared():
    assert t.held_through_drop(_step(same=False), {}, M) is None
    step = _step()
    step.price_before = None
    assert t.held_through_drop(step, {}, M) is None


# --- the meter --------------------------------------------------------------


def test_nothing_logged_is_unsurveyed_and_low_confidence():
    result = t.temperament(TemperamentInputs(), M, now=NOW)
    assert result.level == "unsurveyed" and result.needle_pct is None and result.low_confidence
    assert "No logged decisions" in result.summary


def test_decisions_that_meet_no_rule_are_unsurveyed_not_composed():
    result = t.temperament(TemperamentInputs(decisions=[_d("buy", verdict="Buy")]), M, now=NOW)
    assert result.level == "unsurveyed" and result.decisions_logged == 1
    assert "none met a temperament rule" in result.summary


def test_needle_is_restores_over_judged_events_and_levels_have_edges():
    assert t.level_for(D(70), M) == "composed" and t.level_for(D("69.9"), M) == "steady"
    assert t.level_for(D(40), M) == "steady" and t.level_for(D("39.9"), M) == "restless"
    assert t.level_for(D(20), M) == "restless" and t.level_for(D("19.9"), M) == "rash"
    decisions = [
        _d("buy", 50, invalidation=False),                # drain
        _d("hold", 200, r6=True),                          # restore (review due 18 days ago)
        _d("hold", 250, r6=True),                          # restore
        _d("hold", 260, r6=True),                          # restore
        _d("buy", 5, verdict="Buy"),                       # neutral
    ]
    result = t.temperament(TemperamentInputs(decisions=decisions), M, now=NOW)
    assert (result.restores, result.drains) == (3, 1)
    assert result.needle_pct == D("75.0") and result.level == "composed"
    assert result.low_confidence is False and result.decisions_logged == 5


def test_fewer_than_five_decisions_is_low_confidence_but_still_read():
    result = t.temperament(TemperamentInputs(decisions=[_d("buy", 5, verdict="Sell")]), M, now=NOW)
    assert result.level == "rash" and result.needle_pct == D(0) and result.low_confidence
    assert "low-confidence" in result.summary


def test_only_events_inside_the_window_count():
    old = _d("buy", 366, invalidation=False)
    edge = _d("buy", 365, invalidation=False)
    result = t.temperament(TemperamentInputs(decisions=[old, edge]), M, now=NOW)
    assert result.drains == 1 and result.decisions_logged == 1


def test_a_review_falling_due_inside_the_window_counts_for_an_older_decision():
    result = t.temperament(TemperamentInputs(decisions=[_d("buy", 500, verdict="Buy", r12=True)]), M, now=NOW)
    assert [e.rule for e in result.events] == ["review_12m_done"]
    assert result.decisions_logged == 0           # the decision itself is older than the window


def test_events_are_newest_first_and_carry_their_evidence():
    result = t.temperament(
        TemperamentInputs(decisions=[_d("buy", 30, invalidation=False), _d("sell", 2, verdict="Buy")],
                          steps=[_step()]),
        M, now=NOW,
    )
    assert [e.on for e in result.events] == sorted((e.on for e in result.events), reverse=True)
    assert {e.source for e in result.events} == {"journal", "snapshots"}
    assert all(e.explanation for e in result.events)
    assert result.snapshot_comparisons == 1


def test_turnover_pct_counts_changed_positions_over_all_seen():
    fact = TurnoverFact(account_name="ASK", from_at=NOW, to_at=NOW, positions_before=8, positions_after=9,
                        added=2, removed=1, resized=1)
    assert t.turnover_pct(fact) == D("40.0")      # 4 changed of 10 seen
    empty = TurnoverFact(account_name="ASK", from_at=NOW, to_at=NOW, positions_before=0, positions_after=0,
                         added=0, removed=0, resized=0)
    assert t.turnover_pct(empty) is None


def test_date_type_is_plain_date():
    assert isinstance(t.temperament(TemperamentInputs(decisions=[_d("buy", 1, invalidation=False)]), M,
                                    now=NOW).events[0].on, date)
