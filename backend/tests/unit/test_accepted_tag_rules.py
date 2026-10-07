"""The permanent test for tag rules promoted to code (tag review inbox, PR 3).

Every row in `accepted_tag_rules.py` gets a tiny synthetic filing built from
its concept name and value, and the extractor must read the figure with **no**
database rule. A row cannot be added without this proving it, and a row that
no longer reads (a renamed built-in, a wrong metric) fails here.
"""
from pathlib import Path

import pytest

from app.services.documents.extraction import accepted_tag_rules as table
from app.services.documents.extraction import extract_ixbrl
from app.services.documents.extraction import ixbrl as ix
from app.services.documents.extraction.accepted_tag_rules import ACCEPTED_TAG_RULES
from app.services.tag_export import BEGIN, END, build_fixture, expected_value


@pytest.mark.parametrize("rule", ACCEPTED_TAG_RULES, ids=lambda r: f"{r.metric}:{r.concept}")
def test_each_exported_rule_is_read_without_a_database_rule(rule):
    result = extract_ixbrl(build_fixture(rule))
    facts = {(f.metric, f.period): f for f in result.facts}
    fact = facts.get((rule.metric, "FY2025"))
    assert fact is not None, f"{rule.concept} is not read as {rule.metric}"
    assert fact.value == expected_value(rule)
    # Read through the concept list, not through the rule path.
    details = result.details["ixbrl"]
    assert details["fact_sources"][f"FY2025 {rule.metric}"].endswith(rule.concept)
    assert details["rules_applied"] == []


@pytest.mark.parametrize("rule", ACCEPTED_TAG_RULES, ids=lambda r: f"{r.metric}:{r.concept}")
def test_each_exported_rule_is_in_the_concept_map_and_only_once(rule):
    assert rule.concept in ix.CONCEPT_MAP[rule.metric]
    assert sum(r.metric == rule.metric and r.concept == rule.concept for r in ACCEPTED_TAG_RULES) == 1


def test_the_table_keeps_its_markers_so_the_export_can_rewrite_it():
    lines = Path(table.__file__).read_text(encoding="utf-8").split("\n")
    assert BEGIN in lines and END in lines
    assert lines.index(BEGIN) < lines.index(END)
