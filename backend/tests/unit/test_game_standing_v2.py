"""Standing 3 (The Watch, level 4, 2026-10-31): pure rules, no database.

Properties that matter: level 4 needs levels 1 to 3, an unknown watch never counts, an unseen fired
wire drops the level, the sample fortress stays level 0, and v1 still means what it meant."""
from __future__ import annotations

import uuid

import pytest

from app.domain.game_mapping.standing_v1 import STANDING_V1, get_standing_rules
from app.domain.game_mapping.standing_v2 import STANDING_V2
from app.services.game.standing import (
    JournalFact,
    StandingInputs,
    TowerFact,
    build_standing,
)

V2 = STANDING_V2


def _fortress(**over):
    """One surveyed tower with a reason, a wrong-if line and an armed wire: level 3 before the watch."""
    t = TowerFact(holding_id=uuid.uuid4(), ticker="AAA.OL", surveyed=True)
    base = {
        "demo": False, "towers": [t], "journal": [JournalFact(t.holding_id, "Cheap for a reason", "Margins fall")],
        "active_tripwires": 1, "watch_state": "ok", "unseen_wires": 0,
    }
    base.update(over)
    return StandingInputs(**base)


def test_the_registry_knows_both_versions_and_v1_is_unchanged():
    assert get_standing_rules("v2") is V2 and get_standing_rules("v1") is STANDING_V1
    assert STANDING_V1.max_level == 3 and len(STANDING_V1.levels) == 3
    assert V2.max_level == 4 and [r.title for r in V2.levels] == ["Bare Ground", "The Survey", "Reasons", "The Watch"]
    assert V2.levels[:3] == STANDING_V1.levels


def test_a_watch_that_reported_in_with_every_wire_looked_at_is_level_four():
    s = build_standing(_fortress(), V2)
    assert s.level == 4 and s.title == "The Watch" and s.max_level == 4 and s.version == "v2"
    assert s.next_step is None
    assert s.gates[3].met is True and s.gates[3].fact == "The watch reports in. Every wire looked at"


def test_a_watch_that_never_ran_is_unknown_and_never_counts():
    s = build_standing(_fortress(watch_state="never"), V2)
    assert s.level == 3 and s.gates[3].met is False
    assert s.gates[3].fact == "The watch has not reported. Nothing is known."
    assert s.next_step == V2.levels[3].goal


def test_a_quiet_watch_drops_the_level_with_plain_words():
    s = build_standing(_fortress(watch_state="old"), V2)
    assert s.level == 3
    assert s.gates[3].fact == "The watch is not walking the walls"


@pytest.mark.parametrize("unseen,words", [(1, "1 wire fired, not yet looked at"), (3, "3 wires fired, not yet looked at")])
def test_a_fired_wire_nobody_looked_at_holds_the_level_at_three(unseen, words):
    s = build_standing(_fortress(unseen_wires=unseen), V2)
    assert s.level == 3 and s.gates[3].fact == words


def test_level_four_needs_levels_one_to_three():
    s = build_standing(_fortress(active_tripwires=0), V2)  # no wire armed: level 3 fails
    assert s.level == 2 and s.gates[3].met is False
    fog = TowerFact(holding_id=uuid.uuid4(), ticker="BBB.OL", surveyed=False)
    s = build_standing(_fortress(towers=[fog], journal=[]), V2)
    assert s.level == 1 and s.gates[3].met is False


def test_the_sample_fortress_is_level_zero_and_cannot_reach_four():
    s = build_standing(_fortress(demo=True), V2)
    assert s.level == 0 and s.demo is True
    assert all(not g.met for g in s.gates)
    assert s.gates[3].fact == "Sample fortress, not yours"


def test_an_empty_fortress_has_nothing_to_watch():
    s = build_standing(_fortress(towers=[], journal=[], active_tripwires=0), V2)
    assert s.level == 0 and s.gates[3].fact == "Nothing to watch yet"


def test_level_four_goes_down_when_the_facts_go_stale():
    assert build_standing(_fortress(), V2).level == 4
    assert build_standing(_fortress(watch_state="old"), V2).level == 3
    assert build_standing(_fortress(unseen_wires=1), V2).level == 3
    assert build_standing(_fortress(journal=[]), V2).level == 2


def test_v1_ignores_the_watch_entirely():
    s = build_standing(_fortress(watch_state="never", unseen_wires=5), STANDING_V1)
    assert s.level == 3 and s.max_level == 3 and len(s.gates) == 3
