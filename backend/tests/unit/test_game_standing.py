"""Standing 1 (3D courtyard levels, 2026-10-31): pure rules, no database.

Properties that matter: unknown never counts, weaker data never raises a level, the sample
fortress is level 0 and labelled, the level can go down, named gaps are honest labels."""
from __future__ import annotations

import uuid

import pytest

from app.domain.game_mapping.standing_v1 import (
    STANDING_V1,
    LevelRule,
    NamedGap,
    StandingRules,
    get_standing_rules,
)
from app.services.game.standing import (
    JournalFact,
    StandingInputs,
    TowerFact,
    build_standing,
)

RULES = STANDING_V1


def _tower(ticker="AAA.OL", surveyed=True):
    return TowerFact(holding_id=uuid.uuid4(), ticker=ticker, surveyed=surveyed)


def _written(t: TowerFact, thesis="Cheap for a reason", invalidation="Margins fall below 10%"):
    return JournalFact(t.holding_id, thesis, invalidation)


def _inputs(towers, journal=(), wires=0, demo=False):
    return StandingInputs(demo=demo, towers=towers, journal=journal, active_tripwires=wires)


def test_empty_fortress_is_level_zero_with_a_first_step():
    s = build_standing(_inputs([]), RULES)
    assert s.level == 0 and s.title is None
    assert s.next_step == "Bring in your holdings."
    assert s.gates[0].fact == "No holdings yet"


def test_sample_fortress_never_counts_and_is_labelled():
    ts = [_tower(), _tower("BBB.OL")]
    s = build_standing(_inputs(ts, [_written(t) for t in ts], wires=3, demo=True), RULES)
    assert s.demo is True and s.level == 0
    assert all(not g.met and g.fact == "Sample fortress, not yours" for g in s.gates)
    assert all(g.done is None and g.total is None for g in s.gates)


def test_level_one_when_a_real_holding_stands():
    s = build_standing(_inputs([_tower(surveyed=False)]), RULES)
    assert s.level == 1 and s.title == "Bare Ground"
    assert s.next_step.startswith("Lift the fog")


def test_level_two_needs_every_tower_surveyed():
    a, b = _tower(), _tower("BBB.OL", surveyed=False)
    assert build_standing(_inputs([a, b]), RULES).level == 1
    s = build_standing(_inputs([a, _tower("BBB.OL")]), RULES)
    assert s.level == 2 and s.title == "The Survey"
    assert s.gates[1].done == 2 and s.gates[1].total == 2 and s.gates[1].fact == "2 of 2 surveyed"


def test_a_named_gap_counts_as_covered_but_the_tower_stays_unsurveyed():
    jaeren = _tower("JAREN.OL", surveyed=False)
    s = build_standing(_inputs([_tower(), jaeren]), RULES)
    assert s.level == 2
    assert [(g.ticker, g.label) for g in s.gaps] == [("JAREN.OL", "no tagged filing")]


def test_a_named_gap_goes_away_when_the_tower_is_really_surveyed():
    s = build_standing(_inputs([_tower("JAREN.OL", surveyed=True)]), RULES)
    assert s.gaps == []


def test_a_gap_on_a_ticker_you_do_not_hold_is_not_shown():
    assert build_standing(_inputs([_tower()]), RULES).gaps == []


def test_level_three_needs_reason_wrong_if_and_an_armed_wire_for_every_holding():
    a, b = _tower(), _tower("BBB.OL")
    both = [_written(a), _written(b)]
    assert build_standing(_inputs([a, b], both, wires=0), RULES).level == 2
    assert build_standing(_inputs([a, b], both[:1], wires=1), RULES).level == 2
    s = build_standing(_inputs([a, b], both, wires=1), RULES)
    assert s.level == 3 and s.title == "Reasons"
    assert s.next_step is None  # every built level is held; "more to build" is the page's words
    assert s.gates[2].fact == "2 of 2 written up, 1 wire armed"


@pytest.mark.parametrize("thesis,invalidation", [("", "x"), ("  ", "x"), ("x", ""), ("x", None), ("x", "   ")])
def test_a_blank_reason_or_blank_wrong_if_does_not_count(thesis, invalidation):
    a = _tower()
    s = build_standing(_inputs([a], [JournalFact(a.holding_id, thesis, invalidation)], wires=2), RULES)
    assert s.level == 2


def test_an_entry_without_a_holding_does_not_count():
    a = _tower()
    s = build_standing(_inputs([a], [JournalFact(None, "x", "y")], wires=1), RULES)
    assert s.level == 2


def test_the_level_goes_back_down_when_a_gate_is_lost():
    a, b = _tower(), _tower("BBB.OL")
    journal = [_written(a), _written(b)]
    assert build_standing(_inputs([a, b], journal, wires=1), RULES).level == 3
    assert build_standing(_inputs([a, b], journal, wires=0), RULES).level == 2  # wire switched off
    stale = TowerFact(b.holding_id, b.ticker, surveyed=False)
    assert build_standing(_inputs([a, stale], journal, wires=1), RULES).level == 1  # fog came back
    assert build_standing(_inputs([], journal, wires=1), RULES).level == 0  # holdings gone


def test_weaker_data_never_raises_the_level():
    """Take a full level-3 fortress and weaken one thing at a time: the level never goes up."""
    a, b = _tower(), _tower("BBB.OL")
    journal = [_written(a), _written(b)]
    base = build_standing(_inputs([a, b], journal, wires=2), RULES).level
    weaker = [
        _inputs([a, b], journal[:1], wires=2),
        _inputs([a, b], journal, wires=0),
        _inputs([a, TowerFact(b.holding_id, b.ticker, False)], journal, wires=2),
        _inputs([a, b], [JournalFact(a.holding_id, "", ""), journal[1]], wires=2),
        _inputs([a, b], journal, wires=2, demo=True),
    ]
    assert all(build_standing(i, RULES).level <= base for i in weaker)


def test_levels_above_max_are_never_reached_even_if_a_future_rule_lists_them():
    capped = StandingRules(
        version="t", max_level=1, min_active_tripwires=1,
        levels=(LevelRule(1, "One", "go"), LevelRule(2, "Two", "later")), named_gaps=(),
    )
    s = build_standing(_inputs([_tower()]), capped)
    assert s.level == 1 and s.next_step is None and len(s.gates) == 1


def test_a_custom_gap_list_is_honoured():
    rules = StandingRules("t", 3, 1, STANDING_V1.levels, (NamedGap("ZZZ.OL", "no filing"),))
    s = build_standing(_inputs([_tower("ZZZ.OL", surveyed=False)]), rules)
    assert s.level == 2 and s.gaps[0].label == "no filing"


def test_unknown_version_is_refused():
    with pytest.raises(ValueError):
        get_standing_rules("v99")
    assert get_standing_rules("v1") is STANDING_V1
