"""Sprint 25 rules (G17 Council, G18 Records, G19 Circle, G20 holding lines),
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
from app.services.game import competence as comp
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
    assert set(RITUALS_V1.agenda_order) == {
        "tripwire", "thesis_review", "review_due", "weak_walls", "no_moat", "stale_analysis", "outside_circle", "cash"
    }
    assert RITUALS_V1.competence_levels == ("know", "partly", "outside")
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


# --- G19 ----------------------------------------------------------------------


MARKS = {"Energy": ("outside", None, NOW), "Industrials": ("know", "my trade", NOW), "Materials": ("partly", None, NOW)}


def test_competence_statuses_and_weights():
    t_in = tower("In", sector="Industrials", weight_pct=D(30))
    t_edge = tower("Edge", sector="Materials", weight_pct=D(10))
    t_out = tower("Out", sector="Energy", weight_pct=D(20))
    t_un = tower("Un", sector="Utilities", weight_pct=D(15))
    t_none = tower("None", sector=None, weight_pct=D(5))
    t_fund = tower("Fund", instrument_type="equity_fund", sector="Energy", weight_pct=D(20), structure="outpost")
    out = comp.build_competence([t_in, t_edge, t_out, t_un, t_none, t_fund], MARKS, RITUALS_V1)
    status = {r.name: r.status for r in out.towers}
    assert status == {
        "In": "inside", "Edge": "edge", "Out": "outside", "Un": "unmarked", "None": "unclassified",
        "Fund": "not_applicable",
    }
    assert (out.inside_weight_pct, out.edge_weight_pct, out.outside_weight_pct) == (D(30), D(10), D(20))
    assert (out.unmarked_weight_pct, out.unclassified_weight_pct) == (D(15), D(5))
    energy = next(s for s in out.sectors if s.sector == "Energy")
    assert energy.level == "outside" and [h.name for h in energy.holdings] == ["Out"]  # the fund is not counted
    assert len(out.sectors) == 11


def test_competence_never_infers_a_mark():
    t = tower("Alpha", sector="Industrials", weight_pct=D(50))
    out = comp.build_competence([t], {}, RITUALS_V1)
    assert out.towers[0].status == "unmarked"
    assert out.inside_weight_pct == 0
    assert "unmarked is not the same as inside" in out.summary
    assert all(s.level is None for s in out.sectors)


def test_competence_with_no_stocks_says_so():
    out = comp.build_competence([], MARKS, RITUALS_V1)
    assert "no stock holdings" in out.summary


# --- G17 ----------------------------------------------------------------------


def _council(towers, entries=(), marks=None, **state_kw):
    state = make_state(towers, **state_kw)
    records = rit.build_records(list(entries), state, RITUALS_V1)
    circle = comp.build_competence(towers, marks or {}, RITUALS_V1)
    return rit.build_council(state, records, circle, RITUALS_V1, now=NOW)


def test_agenda_order_is_fixed_and_warnings_come_from_the_named_rules():
    bad = tower("Bad", wall="rotted", moat="none", thesis="breached", tripwires_fired=1, freshness="overgrown",
                analysis_age_days=300, sector="Energy")
    out = _council([bad], marks=MARKS, vault_level="unsurveyed")
    kinds = [i.kind for i in out.items]
    assert kinds == ["tripwire", "weak_walls", "no_moat", "stale_analysis", "outside_circle", "cash"]
    assert [i.tone for i in out.items][:3] == ["warning"] * 3
    assert out.items[0].holdings[0].name == "Bad"


def test_empty_agenda_is_said_plainly_and_not_called_all_well():
    out = _council([tower("Fine")])
    assert out.items == []
    assert "not that all is well" in out.summary
    assert "not that all is well" in out.disclaimer


def test_names_are_capped_and_the_rest_counted():
    towers = [tower(f"T{i}", moat="none", weight_pct=D(20 - i)) for i in range(7)]
    out = _council(towers)
    item = next(i for i in out.items if i.kind == "no_moat")
    assert len(item.holdings) == RITUALS_V1.council_max_names_per_item
    assert item.more == 3
    assert [h.name for h in item.holdings] == ["T0", "T1", "T2", "T3"]  # largest first


def test_reviews_due_come_from_the_journal_once_per_holding():
    t = tower("Alpha")
    es = [
        entry(1, holding_id=t.holding_id, company_name="Alpha", outcome={"review_6m_due": True}),
        entry(2, holding_id=t.holding_id, company_name="Alpha", outcome={"review_12m_due": True}),
    ]
    out = _council([t], es)
    item = next(i for i in out.items if i.kind == "review_due")
    assert [h.name for h in item.holdings] == ["Alpha"]
    assert "2 written review(s)" in item.text


def test_stale_cash_and_unknowns_are_listed_not_hidden():
    out = _council([tower("A")], vault_level="stocked", stale=True, level="unsurveyed")
    assert any(i.kind == "cash" for i in out.items)
    assert any("weather is unknown" in u for u in out.unknowns)
    assert any("No sector is marked" in u for u in out.unknowns)


def test_funds_never_raise_the_stale_analysis_item():
    fund = tower("Fund", instrument_type="equity_fund", structure="outpost", freshness="unsurveyed")
    assert not any(i.kind == "stale_analysis" for i in _council([fund]).items)


def test_no_text_says_buy_sell_add_trim_or_invest():
    bad = tower("Bad", wall="rotted", moat="none", thesis="breached", tripwires_fired=1, sector="Energy",
                freshness="overgrown", analysis_age_days=300)
    out = _council([bad], marks=MARKS, vault_level="unsurveyed")
    texts = [out.summary, out.disclaimer, rit.HINDSIGHT_CAPTION, comp.build_competence([bad], MARKS, RITUALS_V1).summary]
    for item in out.items:
        texts += [item.title, item.text]
    texts += out.unknowns
    for text in texts:
        # the disclaimer says "not advice to trade": 'trade' is allowed, the verbs are not
        assert not FORBIDDEN.search(text), text
