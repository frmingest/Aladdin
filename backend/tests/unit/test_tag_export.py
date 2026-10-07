"""Tag review inbox PR 3: building the exported row, the fixture, the patch."""
import ast
import importlib.util
import subprocess
import sys
from dataclasses import astuple
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, Document, FinancialLineItem, Holding
from app.models.tag_mapping_rule import TagMappingRule
from app.services.documents.extraction import accepted_tag_rules as table
from app.services.documents.extraction import extract_ixbrl
from app.services.documents.extraction import ixbrl as ix
from app.services.documents.extraction.accepted_tag_rules import AcceptedTagRule
from app.services.tag_export import (
    BEGIN,
    END,
    NOT_EXPORTABLE,
    _with_block,
    build_fixture,
    build_row,
    check_fixture,
    expected_value,
    export_rule,
    in_code,
    render_block,
)
from app.services.tag_rules import LABEL_TO_METRIC, RuleError

D = Decimal


def _rule(metric="capital_expenditures", concept="ACME:AcquisitionsOfTangibleFixedAssetsInCash",
          value="300000000", unit="NOK", instant=False, note="Acme FY2025"):
    return AcceptedTagRule(metric, concept, value, unit, instant, note)


# --- the fixture reads through the extractor ------------------------------------


def test_the_fixture_is_read_by_a_rule_for_a_flow_in_a_company_currency():
    rule = _rule()
    assert check_fixture(rule) == []


def test_a_balance_sheet_item_uses_a_point_in_time_context():
    rule = _rule(metric="total_debt", concept="ACME:BondsPayableTotal", value="16742000000", instant=True)
    assert check_fixture(rule) == []
    fact = {(f.metric, f.period): f for f in extract_ixbrl(build_fixture(rule), [ix.MappingRule(rule.metric, rule.concept)]).facts}
    assert fact[("total_debt", "FY2025")].value == D("16742000000")


def test_per_share_and_share_count_units():
    eps = _rule(metric="eps_basic", concept="ACME:ResultPerShare", value="12.5", unit="NOK/shares")
    shares = _rule(metric="shares_outstanding", concept="ACME:OrdinarySharesCount", value="500000000", unit="shares", instant=True)
    assert check_fixture(eps) == []
    assert check_fixture(shares) == []


def test_a_negative_value_and_a_positive_magnitude_metric():
    loss = _rule(metric="net_income", concept="ACME:ResultAfterTax", value="-250000000")
    assert check_fixture(loss) == []
    # capex is stored as a positive magnitude whatever the sign tagged
    outflow = _rule(value="-300000000")
    assert check_fixture(outflow) == []


def test_a_standard_prefix_gets_its_real_namespace():
    rule = _rule(metric="depreciation_and_amortization", concept="us-gaap:Depreciation", value="40")
    assert b'xmlns:us-gaap="http://fasb.org/us-gaap/2024"' in build_fixture(rule)


# --- guard: every exportable metric really reads from the concept list -----------


@pytest.mark.parametrize("metric", sorted(set(LABEL_TO_METRIC.values()) - NOT_EXPORTABLE))
def test_every_exportable_metric_reads_a_concept_added_to_its_list(metric, monkeypatch):
    """If this fails for a metric, the extractor reads it with a dedicated
    reader and the metric belongs in NOT_EXPORTABLE."""
    concept = "ZZTEST:AddedByTheExport"
    monkeypatch.setitem(ix.CONCEPT_MAP, metric, (*ix.CONCEPT_MAP.get(metric, ()), concept))
    unit = "NOK/shares" if metric == "eps_basic" else "shares" if metric == "shares_outstanding" else "NOK"
    instant = metric in {"total_assets", "total_equity", "total_liabilities", "total_debt", "cash_and_equivalents", "shares_outstanding"}
    rule = _rule(metric=metric, concept=concept, value="123000000" if unit == "NOK" else "12", unit=unit, instant=instant)
    facts = {(f.metric, f.period): f for f in extract_ixbrl(build_fixture(rule)).facts}
    assert (metric, "FY2025") in facts, f"{metric} does not read a concept appended to its list"


def test_a_metric_with_its_own_reader_is_not_exportable():
    assert "lease_payments_financing" in NOT_EXPORTABLE


# --- the patch --------------------------------------------------------------------


def test_render_block_is_one_row_per_line_between_the_markers():
    lines = render_block((_rule(), _rule(metric="total_debt", concept="ACME:Bonds", value="5", instant=True)))
    assert lines[0] == BEGIN and lines[-1] == END and len(lines) == 4
    assert lines[1].startswith('    AcceptedTagRule("capital_expenditures", "ACME:AcquisitionsOfTangibleFixedAssetsInCash"')
    assert lines[2].endswith('True, "Acme FY2025"),')


def test_the_rendered_block_parses_back_into_the_same_rows():
    rows = (_rule(), _rule(metric="total_debt", concept="ACME:Bonds", value="5", instant=True))
    tree = ast.parse("(\n" + "\n".join(render_block(rows)[1:-1]) + "\n)")
    parsed = tuple(AcceptedTagRule(*[ast.literal_eval(a) for a in call.args]) for call in tree.body[0].value.elts)
    assert parsed == rows


ROUND_TRIP = [
    _rule(),
    _rule(metric="total_debt", concept="ACME:BondsPayableTotal", value="16742000000", instant=True),
    _rule(metric="eps_basic", concept="ACME:ResultPerShare", value="12.5", unit="NOK/shares"),
    _rule(metric="shares_outstanding", concept="ACME:OrdinarySharesCount", value="500000000", unit="shares", instant=True),
    _rule(metric="net_income", concept="ACME:ResultAfterTax", value="-250000000"),
]


@pytest.mark.parametrize("row", ROUND_TRIP, ids=lambda r: r.metric)
def test_round_trip_an_exported_row_is_read_with_no_database_rule(row, monkeypatch, tmp_path):
    """The loop the permanent test closes: render the block, load it as the
    table, rebuild the extractor's concept lists, and read the figure."""
    source = Path(table.__file__).read_text(encoding="utf-8")
    patched = tmp_path / "patched_table.py"
    patched.write_text(_with_block(source, (*table.ACCEPTED_TAG_RULES, row)), encoding="utf-8")
    spec = importlib.util.spec_from_file_location("patched_table", patched)
    module = importlib.util.module_from_spec(spec)
    sys.modules["patched_table"] = module  # dataclasses look the module up by name
    spec.loader.exec_module(module)
    assert astuple(module.ACCEPTED_TAG_RULES[-1]) == astuple(row)  # the patched file has its own class

    monkeypatch.setattr(table, "ACCEPTED_TAG_RULES", module.ACCEPTED_TAG_RULES)
    monkeypatch.setattr(ix, "CONCEPT_MAP", ix._concept_map())
    result = extract_ixbrl(build_fixture(row))
    fact = {(f.metric, f.period): f for f in result.facts}[(row.metric, "FY2025")]
    assert fact.value == expected_value(row)
    details = result.details["ixbrl"]
    assert details["fact_sources"][f"FY2025 {row.metric}"].endswith(row.concept)  # read from the list...
    assert details["rules_applied"] == []  # ...not through a database rule


# --- from a saved rule ---------------------------------------------------------------


def _db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    return Session(engine)


def _saved(db, *, metric="capital_expenditures", label="capital expenditure", concept="ACME:Capex", status="accepted",
           scope="company", with_fact=True, value="300000000", unit="NOK"):
    holding = Holding(name="Acme ASA", ticker="ACM.OL", trading_currency="NOK")
    db.add(holding)
    db.flush()
    document = Document(holding_id=holding.id, type="annual_report", original_filename="acme-2025.xhtml",
                        mime_type="application/xhtml+xml", size_bytes=1, storage_path="x", sha256="a" * 64,
                        status="processed")
    db.add(document)
    db.flush()
    if with_fact:
        db.add(FinancialLineItem(document_id=document.id, holding_id=holding.id, metric=metric,
                                 value=D(value), unit=unit, currency=unit[:3], period="FY2025", confidence=0.9))
    rule = TagMappingRule(holding_id=holding.id, ticker="ACM.OL", metric=metric, metric_label=label, concept=concept,
                          scope=scope, status=status, check_status="plausible", check_detail="", check_overridden=False,
                          fiscal_year="FY2025", source_filename="acme-2025.xhtml")
    db.add(rule)
    db.commit()
    return rule


def test_the_row_takes_its_value_from_the_figure_the_rule_filled():
    db = _db()
    rule = _saved(db)
    row = build_row(db, rule)
    assert (row.metric, row.concept, row.value, row.unit, row.instant) == (
        "capital_expenditures", "ACME:Capex", "300000000", "NOK", False,
    )
    assert row.note == "ACM.OL FY2025"


def test_a_balance_sheet_label_is_a_point_in_time_row():
    db = _db()
    rule = _saved(db, metric="total_debt", label="total debt", concept="ACME:Bonds", value="16742000000")
    assert build_row(db, rule).instant is True


@pytest.mark.parametrize(
    ("kwargs", "status"),
    [
        ({"status": "rejected"}, 409),
        ({"metric": "lease_payments_financing", "label": "lease payments"}, 422),
        ({"with_fact": False}, 409),
        ({"unit": "NOK per barrel"}, 422),
    ],
)
def test_a_row_that_cannot_be_built_says_why(kwargs, status):
    db = _db()
    rule = _saved(db, **kwargs)
    with pytest.raises(RuleError) as caught:
        build_row(db, rule)
    assert caught.value.status == status


def test_a_tag_already_in_the_code_is_refused_and_flagged(monkeypatch):
    db = _db()
    rule = _saved(db)
    assert in_code(rule) is False
    monkeypatch.setitem(ix.CONCEPT_MAP, "capital_expenditures", (*ix.CONCEPT_MAP["capital_expenditures"], "ACME:Capex"))
    assert in_code(rule) is True
    with pytest.raises(RuleError) as caught:
        build_row(db, rule)
    assert caught.value.status == 409 and "already built" in caught.value.message


def test_export_gives_a_patch_git_can_apply(tmp_path):
    db = _db()
    rule = _saved(db)
    exported = export_rule(db, rule.id)
    assert exported.verified is True and exported.problems == []
    assert exported.patch and exported.row_line in exported.patch
    assert "Read ACME:Capex as capital expenditure (ACM.OL only (its own tag))" in exported.commit_message

    # Apply it to a copy of the real file in a scratch repo.
    target = tmp_path / exported.table_path
    target.parent.mkdir(parents=True)
    target.write_text(Path(table.__file__).read_text(encoding="utf-8"), encoding="utf-8")
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    patch_file = tmp_path / "rule.patch"
    patch_file.write_text(exported.patch, encoding="utf-8")
    subprocess.run(["git", "apply", "--check", "--ignore-whitespace", "rule.patch"], cwd=tmp_path, check=True)
    subprocess.run(["git", "apply", "--ignore-whitespace", "rule.patch"], cwd=tmp_path, check=True)
    assert exported.row_line in target.read_text(encoding="utf-8")


def test_export_is_read_only():
    db = _db()
    rule = _saved(db)
    before = (db.query(TagMappingRule).count(), db.query(FinancialLineItem).count())
    export_rule(db, rule.id)
    assert (db.query(TagMappingRule).count(), db.query(FinancialLineItem).count()) == before


def test_an_unknown_rule_is_404():
    with pytest.raises(RuleError) as caught:
        export_rule(_db(), uuid4())
    assert caught.value.status == 404
