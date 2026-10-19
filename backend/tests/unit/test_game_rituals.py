"""Sprint 25 rules (G18 Records, G20 holding lines),
tested without a database. The rituals read the user's real money records, so
the voice rules are tested too: no trade instruction, no score, no padding."""
from __future__ import annotations

import re
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest

from app.domain.game_mapping.rituals_v1 import RITUALS_V1, get_rituals
from app.schemas.game import GameStateOut, RecordOut
from app.schemas.journal import JournalEntryOut, JournalOutcomeOut
from app.services.game import rituals as rit
from tests.unit.test_game_advisors import diw, siege, tower, vault

D = Decimal
NOW = datetime(2026, 10, 4, 12, tzinfo=timezone.utc)
FORBIDDEN = re.compile(r"\b(buy|sell|add|trim|invest|purchase)\b", re.IGNORECASE)


def make_state(towers, *, vault_level="stocked", stale=False, level="calm") -> GameStateOut:
    return GameStateOut(
        mapping_version="v1", as_of=NOW, total_value_nok=D(1000), towers=towers,
        diworsification=diw(), vault=vault(vault_level, stale), siege=siege(level), notes=[],
    )


def entry(i=1, **kw) -> JournalEntryOut:
    outcome = kw.pop("outcome", {})
    base_outcome = {
        "days_since": 100, "latest_price": D(120), "latest_price_at": NOW, "return_pct": D(20), "in_favour": True,
        "price_6m": None, "return_6m_pct": None, "price_12m": None, "return_12m_pct": None,
        "review_6m_due": False, "review_12m_due": False, "note": None,
    }
    base_outcome.update(outcome)
    base = {
        "id": uuid.uuid4(), "holding_id": uuid.uuid4(), "ticker": "AAA.OL", "company_name": "Alpha", "action": "buy",
        "decided_on": date(2026, 1, i), "price": D(100), "currency": "NOK", "quantity": D(10), "thesis": "a reason",
        "invalidation": "when X", "confidence": 3, "verdict_at_decision": "Buy", "review_6m": None, "review_12m": None,
        "created_at": NOW, "updated_at": NOW, "outcome": JournalOutcomeOut(**base_outcome),
    }
    base.update(kw)
    return JournalEntryOut(**base)


# --- rules file --------------------------------------------------------------


def test_rules_file_is_versioned_and_complete():
    assert get_rituals("v1") is RITUALS_V1
    assert RITUALS_V1.version == "v1"
    with pytest.raises(ValueError):
        get_rituals("v9")


# --- G20 ----------------------------------------------------------------------


def test_holding_lines_are_only_about_that_holding_and_not_cut():
    a = tower("Alpha", wall="rotted", moat="none", thesis="breached", tripwires_fired=1)
    b = tower("Beta")
    state = make_state([a, b])
    lines = rit.holding_advisor_lines(state, a.holding_id).lines
    assert {line.rule for line in lines} >= {"tripwire_fired", "weak_walls_big_tower", "no_moat_big_tower"}
    assert all(line.holding_id == a.holding_id for line in lines)
    assert lines[0].tone == "warning"
    assert rit.holding_advisor_lines(state, b.holding_id).lines == []
    assert rit.holding_advisor_lines(state, uuid.uuid4()).lines == []


# --- G18 ----------------------------------------------------------------------


def test_records_newest_first_with_review_states_and_no_score():
    old = entry(1, review_6m="I was early", outcome={"review_6m_due": False})
    due = entry(2, outcome={"review_6m_due": True})
    fresh = entry(3, outcome={"days_since": 10})
    out = rit.build_records([old, due, fresh], None, RITUALS_V1)
    assert [r.decided_on.day for r in out.records] == [3, 2, 1]
    states = {r.decided_on.day: r.review_6m for r in out.records}
    assert states == {1: "written", 2: "due", 3: "not_due"}
    assert out.reviews_due == 1
    assert "not its outcome" in out.caption and "not a score" in out.caption
    assert not {"score", "hit_rate", "rank"} & set(RecordOut.model_fields)


def test_records_say_when_no_price_is_stored_and_show_the_verdict_now():
    t = tower("Alpha", verdict_rating="Hold")
    e = entry(holding_id=t.holding_id, outcome={"latest_price": None, "latest_price_at": None, "return_pct": None})
    (r,) = rit.build_records([e], make_state([t]), RITUALS_V1).records
    assert r.price_now is None and r.price_change_pct is None
    assert r.price_note == "no stored price since the decision"
    assert (r.verdict_then, r.verdict_now) == ("Buy", "Hold")


def test_records_unlinked_entry_has_no_verdict_now():
    e = entry(holding_id=None)
    (r,) = rit.build_records([e], make_state([tower("Alpha")]), RITUALS_V1).records
    assert r.verdict_now is None


# --- wording ------------------------------------------------------------------


def test_no_text_says_buy_sell_add_trim_or_invest():
    texts = [rit.HINDSIGHT_CAPTION]
    for text in texts:
        assert not FORBIDDEN.search(text), text
