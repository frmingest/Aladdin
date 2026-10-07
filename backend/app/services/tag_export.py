"""Export an accepted tag rule as a code change (tag review inbox, PR 3).

A rule accepted in the inbox is a database row. Once it has proved itself, it
can be promoted to code: one row in `accepted_tag_rules.py` (concept name, one
value, unit) that the extractor reads like its built-in lists, plus the test
that proves it (`tests/unit/test_accepted_tag_rules.py` builds a tiny filing
from every row with `build_fixture` and requires the figure to come out with no
database rule). This module builds that row, checks it against the real
extractor, and renders a `git apply` patch and a commit message. It changes
nothing: read-only, deterministic, no LLM (CLAUDE.md Rule 1).

Concept names and one value only: no filing text, no statements (CLAUDE.md:
never commit real uploaded documents).
"""
from __future__ import annotations

import difflib
import json
import re
import uuid
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.financial_metrics import POSITIVE_MAGNITUDE_METRICS
from app.models.document import Document
from app.models.financial_line_item import FinancialLineItem
from app.models.tag_mapping_rule import TagMappingRule
from app.services.documents.extraction import MappingRule, extract_ixbrl
from app.services.documents.extraction import accepted_tag_rules as table
from app.services.documents.extraction import ixbrl as ix
from app.services.documents.extraction.accepted_tag_rules import AcceptedTagRule
from app.services.documents.extraction.tag_review import SPECS
from app.services.tag_review import newest_review
from app.services.tag_rules import ACCEPTED, LABEL_TO_METRIC, RuleError

BEGIN = "    # BEGIN accepted-tag-rules"
END = "    # END accepted-tag-rules"
TABLE_PATH = "backend/app/services/documents/extraction/accepted_tag_rules.py"
TEST_PATH = "backend/tests/unit/test_accepted_tag_rules.py"

# Metrics read from their own concept lists by a dedicated reader (owner-view
# outflows); they have no place in the generic list, so they stay database rules.
NOT_EXPORTABLE = frozenset({"lease_payments_financing"})

_UNIT = re.compile(r"^(?:[A-Z]{3}(?:/shares)?|shares)$")
_PREFIX = re.compile(r"^[A-Za-z][\w\-]*$")


# --- the fixture (also used by the permanent test) ----------------------------

_NS = {
    "ifrs-full": "https://xbrl.ifrs.org/taxonomy/2024-03-27/ifrs-full",
    "us-gaap": "http://fasb.org/us-gaap/2024",
}


def _unit_xml(unit: str) -> str:
    if unit == "shares":
        return '<xbrli:unit id="u"><xbrli:measure>xbrli:shares</xbrli:measure></xbrli:unit>'
    if unit.endswith("/shares"):
        currency = unit.split("/", 1)[0]
        return (
            '<xbrli:unit id="u"><xbrli:divide><xbrli:unitNumerator>'
            f"<xbrli:measure>iso4217:{currency}</xbrli:measure></xbrli:unitNumerator>"
            "<xbrli:unitDenominator><xbrli:measure>xbrli:shares</xbrli:measure></xbrli:unitDenominator>"
            "</xbrli:divide></xbrli:unit>"
        )
    return f'<xbrli:unit id="u"><xbrli:measure>iso4217:{unit}</xbrli:measure></xbrli:unit>'


def build_fixture(rule: AcceptedTagRule) -> bytes:
    """A minimal synthetic ESEF-style filing (same structure as a real
    .xhtml) carrying exactly one tagged number: the rule's concept and value.
    Invented surroundings, nothing from the real report but the tag name."""
    prefix = rule.concept.split(":", 1)[0]
    namespaces = {"ifrs-full": _NS["ifrs-full"]}
    namespaces[prefix] = _NS.get(prefix, f"http://example.invalid/{prefix}")
    declared = " ".join(f'xmlns:{p}="{uri}"' for p, uri in namespaces.items())
    value = Decimal(rule.value)
    negative = value < 0
    entity = '<xbrli:entity><xbrli:identifier scheme="lei">X</xbrli:identifier></xbrli:entity>'
    context = "i25" if rule.instant else "fy25"
    sign = ' sign="-"' if negative else ""
    shown = format(abs(value), "f")
    return (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:ix="http://www.xbrl.org/2013/inlineXBRL"'
        ' xmlns:ixt="http://www.xbrl.org/inlineXBRL/transformation/2022-02-16"'
        f' xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:iso4217="http://www.xbrl.org/2003/iso4217" {declared}>\n'
        "<head><title>Fixture</title></head>\n<body>\n"
        '<div style="display:none"><ix:header><ix:resources>\n'
        f'<xbrli:context id="fy25">{entity}<xbrli:period><xbrli:startDate>2025-01-01</xbrli:startDate>'
        "<xbrli:endDate>2025-12-31</xbrli:endDate></xbrli:period></xbrli:context>\n"
        f'<xbrli:context id="i25">{entity}<xbrli:period><xbrli:instant>2025-12-31</xbrli:instant>'
        "</xbrli:period></xbrli:context>\n"
        f"{_unit_xml(rule.unit)}\n"
        "</ix:resources></ix:header></div>\n"
        '<div class="pages"><div><p>Fixture statement</p><table><tr><td>Line</td><td>'
        f'<ix:nonFraction name="{rule.concept}" contextRef="{context}" unitRef="u" scale="0" decimals="0"'
        f' format="ixt:num-dot-decimal"{sign}>{shown}</ix:nonFraction></td></tr></table></div></div>\n'
        "</body></html>\n"
    ).encode()


def expected_value(rule: AcceptedTagRule) -> Decimal:
    value = Decimal(rule.value)
    return abs(value) if rule.metric in POSITIVE_MAGNITUDE_METRICS else value


def check_fixture(rule: AcceptedTagRule) -> list[str]:
    """What the extractor does with the rule's fixture. Empty list = it reads
    the figure. Uses a database-style `MappingRule` so nothing global is
    touched: it proves the concept resolves to the metric with the value."""
    problems: list[str] = []
    content = build_fixture(rule)
    with_rule = {
        (f.metric, f.period): f
        for f in extract_ixbrl(content, [MappingRule(rule.metric, rule.concept)]).facts
    }
    fact = with_rule.get((rule.metric, "FY2025"))
    if fact is None:
        problems.append(f"the extractor does not read {rule.concept} as {rule.metric} from this fixture")
    elif fact.value != expected_value(rule):
        problems.append(f"read {fact.value} instead of {expected_value(rule)}")
    return problems


# --- building the row from a saved rule ----------------------------------------


def _decimal(text: str) -> Decimal | None:
    try:
        return Decimal(re.sub(r"[\s  ]", "", text))
    except InvalidOperation:
        return None


def _is_instant(label: str, concept: str) -> bool:
    kind = SPECS[label][1] if label in SPECS else "duration"
    if kind == "either":  # share count: a year-end count is a point in time, an average is a flow
        return "WeightedAverage" not in concept
    return kind == "instant"


def _sample(db: Session, rule: TagMappingRule) -> tuple[str, str] | None:
    """(value as tagged in full units, unit) for the rule's figure: from the
    inbox's own suggestion while it is still listed, else from the figure the
    rule filled in that report."""
    if rule.holding_id is not None:
        found = newest_review(db, rule.holding_id)
        if found is not None:
            _, review = found
            for gap in review["gaps"]:
                if gap["metric"] != rule.metric_label:
                    continue
                for candidate in gap["candidates"]:
                    if candidate["concept"] == rule.concept and _decimal(candidate["value"]) is not None:
                        return str(_decimal(candidate["value"])), candidate["unit"]
        rows = db.execute(
            select(FinancialLineItem, Document.original_filename)
            .join(Document, Document.id == FinancialLineItem.document_id)
            .where(
                FinancialLineItem.holding_id == rule.holding_id,
                FinancialLineItem.metric == rule.metric,
                FinancialLineItem.period == (rule.fiscal_year or ""),
            )
        ).all()
        for item, filename in rows:
            if filename == rule.source_filename:
                return format(item.value.normalize(), "f"), item.unit
    return None


def build_row(db: Session, rule: TagMappingRule) -> AcceptedTagRule:
    if rule.status != ACCEPTED:
        raise RuleError(409, "only an accepted rule can be exported")
    if rule.metric in NOT_EXPORTABLE or rule.metric not in LABEL_TO_METRIC.values():
        raise RuleError(
            422,
            f"'{rule.metric_label}' is read by a dedicated reader, so a rule for it stays a database rule",
        )
    if not _PREFIX.match(rule.concept.split(":", 1)[0]) or ":" not in rule.concept:
        raise RuleError(422, "the tag name is not in prefix:Name form")
    if rule.concept in ix.CONCEPT_MAP.get(rule.metric, ()):
        raise RuleError(409, "this tag is already built into the extractor, nothing to export")
    sample = _sample(db, rule)
    if sample is None:
        raise RuleError(
            409,
            "the tagged value is no longer available (re-fetch the company's reports, then export again)",
        )
    value, unit = sample
    if not _UNIT.match(unit or ""):
        raise RuleError(422, f"unit '{unit}' cannot be used in a fixture")
    where = f"{rule.ticker or 'company'} {rule.fiscal_year or ''}".strip()
    return AcceptedTagRule(
        metric=rule.metric,
        concept=rule.concept,
        value=value,
        unit=unit,
        instant=_is_instant(rule.metric_label, rule.concept),
        note=where,
    )


# --- rendering the patch ---------------------------------------------------------


def _line(rule: AcceptedTagRule) -> str:
    fields = (
        json.dumps(rule.metric),
        json.dumps(rule.concept),
        json.dumps(rule.value),
        json.dumps(rule.unit),
        "True" if rule.instant else "False",
        json.dumps(rule.note),
    )
    return f"    AcceptedTagRule({', '.join(fields)}),"


def render_block(rules: tuple[AcceptedTagRule, ...]) -> list[str]:
    return [BEGIN, *(_line(r) for r in rules), END]


def _with_block(source: str, rules: tuple[AcceptedTagRule, ...]) -> str:
    lines = source.split("\n")
    try:
        start = lines.index(BEGIN)
        stop = lines.index(END)
    except ValueError as err:
        raise RuleError(500, "the rule table has lost its BEGIN/END markers") from err
    return "\n".join([*lines[:start], *render_block(rules), *lines[stop + 1:]])


def _table_source() -> str | None:
    try:
        return Path(table.__file__).read_text(encoding="utf-8")
    except OSError:
        return None


@dataclass
class RuleExport:
    rule_id: uuid.UUID
    ticker: str | None
    metric_label: str
    scope: str
    row: AcceptedTagRule
    verified: bool
    problems: list[str]
    patch: str | None
    row_line: str
    commit_message: str
    test_path: str
    table_path: str
    notes: list[str]


def export_rule(db: Session, rule_id: uuid.UUID) -> RuleExport:
    rule = db.get(TagMappingRule, rule_id)
    if rule is None:
        raise RuleError(404, "rule not found")
    row = build_row(db, rule)
    problems = check_fixture(row)
    current = table.ACCEPTED_TAG_RULES
    new_rules = (*current, row)
    source = _table_source()
    patch: str | None = None
    if source is not None:
        updated = _with_block(source, new_rules)
        patch = "".join(
            difflib.unified_diff(
                source.splitlines(keepends=True),
                updated.splitlines(keepends=True),
                fromfile=f"a/{TABLE_PATH}",
                tofile=f"b/{TABLE_PATH}",
                n=3,
            )
        )
    scope = "all companies" if rule.scope == "all" else f"{rule.ticker or 'this company'} only (its own tag)"
    subject = f"Read {rule.concept} as {rule.metric_label} ({scope})"
    message = (
        f"{subject}\n\n"
        f"Promotes a tag mapping rule accepted in the tag review inbox to code: one row in "
        f"accepted_tag_rules.py ({row.note}). The permanent test in {TEST_PATH.split('/', 1)[1]} builds a "
        f"fixture from the row and requires the extractor to read it with no database rule."
    )
    notes = [
        "Apply with `git apply --ignore-whitespace` from the repo root, then run `pytest -q tests/unit/test_accepted_tag_rules.py`.",
        "Once merged and deployed, the database rule is redundant: press Remove on it (figures it filled stay until the next re-extract).",
    ]
    if rule.metric_label in SPECS and SPECS[rule.metric_label][1] == "either":
        notes.append("The point-in-time / year choice for this tag was inferred from its name; check it against the filing.")
    return RuleExport(
        rule_id=rule.id,
        ticker=rule.ticker,
        metric_label=rule.metric_label,
        scope=rule.scope,
        row=row,
        verified=not problems,
        problems=problems,
        patch=patch,
        row_line=_line(row),
        commit_message=message,
        test_path=TEST_PATH,
        table_path=TABLE_PATH,
        notes=notes,
    )


def in_code(rule: Any) -> bool:
    """True when the extractor's own lists already read this tag for this metric."""
    return rule.concept in ix.CONCEPT_MAP.get(rule.metric, ())
