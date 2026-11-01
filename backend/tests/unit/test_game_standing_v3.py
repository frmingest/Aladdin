"""Standing 4 (The Ledger, level 5, 2026-11-01): pure rules, no database.

Properties that matter: level 5 needs levels 1 to 4, a due look-back drops it, a young journal can't
reach it, the sample fortress stays level 0, v1 and v2 still mean what they meant, and the rule's day
counts are the journal's own."""
from __future__ import annotations

import uuid

import pytest

from app.domain.game_mapping.standing_v1 import STANDING_V1, get_standing_rules
from app.domain.game_mapping.standing_v2 import STANDING_V2
from app.domain.game_mapping.standing_v3 import STANDING_V3
from app.services import journal as journal_service
from app.services.game.standing import (
    JournalFact,
    StandingInputs,
    TowerFact,
    build_standing,
)

V3 = STANDING_V3


def _entry(hid, *, days=200, looked=True, due=False):
    return JournalFact(hid, "Cheap for a reason", "Margins fall", days_since=days, looked_back=looked, look_back_due=due)


def _fortress(journal=None, **over):
    """One surveyed tower, written up, a wire armed, the watch reporting in: level 4 before the ledger."""
    t = TowerFact(holding_id=uuid.uuid4(), ticker="AAA.OL", surveyed=True)
    base = {
        "demo": False, "towers": [t],
        "journal": journal(t.holding_id) if journal else [_entry(t.holding_id)],
        "active_tripwires": 1, "watch_state": "ok", "unseen_wires": 0,
    }
    base.update(over)
    return StandingInputs(**base)


def test_the_registry_knows_three_versions_and_older_ones_are_unchanged():
    assert get_standing_rules("v3") is V3
    assert get_standing_rules("v2") is STANDING_V2 and get_standing_rules("v1") is STANDING_V1
    assert STANDING_V2.max_level == 4 and len(STANDING_V2.levels) == 4
    assert V3.max_level == 5 and V3.levels[:4] == STANDING_V2.levels
    assert [r.title for r in V3.levels][-1] == "The Ledger"


def test_the_day_counts_are_the_journals_own():
    assert V3.look_back_days == journal_service.REVIEW_6M_DAYS
    assert V3.second_look_back_days == journal_service.REVIEW_12M_DAYS


def test_a_written_look_back_and_nothing_due_is_level_five():
    s = build_standing(_fortress(), V3)
    assert s.level == 5 and s.title == "The Ledger" and s.max_level == 5 and s.version == "v3"
    assert s.next_step is None
    g5 = s.gates[4]
    assert g5.met is True and g5.fact == "1 look-back written, none due" and (g5.done, g5.total) == (1, 1)


@pytest.mark.parametrize("due,words", [(1, "1 look-back due"), (2, "2 look-backs due")])
def test_a_due_look_back_holds_the_level_at_four(due, words):
    def journal(hid):
        return [_entry(hid)] + [_entry(hid, days=190, looked=False, due=True) for _ in range(due)]

    s = build_standing(_fortress(journal), V3)
    assert s.level == 4 and s.gates[4].met is False and s.gates[4].fact == words
    assert (s.gates[4].done, s.gates[4].total) == (1, 1 + due)
    assert s.next_step == V3.levels[4].goal


def test_a_young_journal_cannot_reach_five_and_says_when_the_first_look_back_opens():
    s = build_standing(_fortress(lambda hid: [_entry(hid, days=90, looked=False)]), V3)
    assert s.level == 4 and s.gates[4].fact == "Too soon to look back: the first opens in 92 days"
    assert (s.gates[4].done, s.gates[4].total) == (None, None)
    s = build_standing(_fortress(lambda hid: [_entry(hid, days=181, looked=False)]), V3)
    assert s.gates[4].fact == "Too soon to look back: the first opens in 1 day"


def test_an_entry_on_a_sold_holding_still_counts():
    """A decision on a holding no longer in the fortress is still a decision to look back on."""
    def journal(hid):
        return [_entry(hid), _entry(None, days=400, looked=False, due=True)]

    assert build_standing(_fortress(journal), V3).level == 4


def test_level_five_needs_levels_one_to_four():
    s = build_standing(_fortress(watch_state="never"), V3)
    assert s.level == 3 and s.gates[4].met is False
    s = build_standing(_fortress(unseen_wires=1), V3)
    assert s.level == 3 and s.gates[4].met is False


def test_v2_rules_never_light_a_fifth_level_on_the_same_facts():
    s = build_standing(_fortress(), STANDING_V2)
    assert s.level == 4 and s.max_level == 4 and len(s.gates) == 4


def test_the_sample_fortress_is_level_zero_and_cannot_reach_five():
    s = build_standing(_fortress(demo=True), V3)
    assert s.level == 0 and s.demo is True
    assert all(not g.met for g in s.gates)
    assert s.gates[4].fact == "Sample fortress, not yours"


def test_an_empty_journal_says_so():
    t = TowerFact(holding_id=uuid.uuid4(), ticker="AAA.OL", surveyed=True)
    s = build_standing(StandingInputs(demo=False, towers=[t], journal=[], active_tripwires=1, watch_state="ok"), V3)
    assert s.level == 2 and s.gates[4].fact == "No journal entries yet. Nothing to look back on"
