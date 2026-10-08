"""Which filing owns which fiscal year (found 2026-10-08).

Reports were imported newest-first, so each older report's own year was already
taken by the next report's comparative column and the FY2021 report ended up
holding FY2020/FY2019. The rule is now independent of import order: a filing's
own year beats a later filing's comparative; between comparatives the nearest
later filing wins; untagged files (CSV/PDF) keep "first source wins".

Filings here are tiny synthetic iXBRL files with invented numbers."""
from itertools import permutations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, Holding
from app.models.document import Document
from app.models.financial_line_item import FinancialLineItem
from app.providers.object_storage import LocalObjectStorageProvider
from app.services.documents.ingestion import (
    _source_rank,
    ingest_holding_document,
    own_year_from_details,
    refresh_document_facts,
)


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture()
def storage(tmp_path):
    return LocalObjectStorageProvider(str(tmp_path))


@pytest.fixture()
def holding(db):
    h = Holding(ticker="DNO.OL", name="DNO ASA", trading_currency="NOK")
    db.add(h)
    db.commit()
    return h


def _report(year: int, revenue: dict[int, str]) -> bytes:
    """An annual report for `year` carrying `revenue` for each year in the dict
    (its own year and the comparative), tagged on the income statement page."""
    contexts = "".join(
        f'<xbrli:context id="fy{y}"><xbrli:entity><xbrli:identifier scheme="lei">X</xbrli:identifier></xbrli:entity>'
        f"<xbrli:period><xbrli:startDate>{y}-01-01</xbrli:startDate><xbrli:endDate>{y}-12-31</xbrli:endDate>"
        "</xbrli:period></xbrli:context>"
        for y in revenue
    )
    cells = "".join(
        f'<td><ix:nonFraction name="ifrs-full:Revenue" contextRef="fy{y}" unitRef="usd" scale="6" decimals="-5" '
        f'format="ixt:num-dot-decimal">{value}</ix:nonFraction></td>'
        for y, value in revenue.items()
    )
    return (
        '<?xml version="1.0" encoding="utf-8"?>'
        '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:ix="http://www.xbrl.org/2013/inlineXBRL" '
        'xmlns:ixt="http://www.xbrl.org/inlineXBRL/transformation/2022-02-16" '
        'xmlns:ifrs-full="https://xbrl.ifrs.org/taxonomy/2024-03-27/ifrs-full" '
        'xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:iso4217="http://www.xbrl.org/2003/iso4217">'
        "<head><title>ACME</title></head><body>"
        '<div style="display:none"><ix:header><ix:resources>'
        + contexts
        + '<xbrli:unit id="usd"><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unit>'
        "</ix:resources></ix:header></div>"
        f"<div><p>ACME annual report {year}</p></div>"
        "<div><p>Statement of income</p><table><tr><td>Revenue</td>" + cells + "</tr></table></div>"
        "</body></html>"
    ).encode("utf-8")


def _ingest(db, storage, holding, year: int, revenue: dict[int, str], name: str | None = None):
    return ingest_holding_document(
        db,
        storage,
        holding_id=holding.id,
        filename=name or f"acme-{year}-12-31.xhtml",
        content=_report(year, revenue),
        mime_type="application/xhtml+xml",
        document_type="annual_report",
    )


# Invented history: each report carries its own year and the prior year.
REPORTS = {
    2021: {2021: "1 000.0", 2020: "900.0"},
    2022: {2022: "1 100.0", 2021: "1 000.0"},
    2023: {2023: "1 200.0", 2022: "1 100.0"},
}


def _owners(db) -> dict[str, str]:
    """fiscal year -> filename of the document whose row holds it."""
    rows = (
        db.query(FinancialLineItem.period, Document.original_filename)
        .join(Document, Document.id == FinancialLineItem.document_id)
        .filter(FinancialLineItem.metric == "revenue")
        .all()
    )
    owners = {period: name for period, name in rows}
    assert len(owners) == len(rows), "a fiscal year is stored twice"
    return owners


EXPECTED_OWNERS = {
    "FY2023": "acme-2023-12-31.xhtml",
    "FY2022": "acme-2022-12-31.xhtml",
    "FY2021": "acme-2021-12-31.xhtml",
    "FY2020": "acme-2021-12-31.xhtml",  # only the 2021 report shows 2020
}


@pytest.mark.parametrize("order", list(permutations(REPORTS)))
def test_every_year_is_owned_by_its_own_report_whatever_the_import_order(db, storage, holding, order):
    for year in order:
        _ingest(db, storage, holding, year, REPORTS[year])
    assert _owners(db) == EXPECTED_OWNERS


def test_the_older_report_opened_in_the_reader_shows_its_own_year(db, storage, holding):
    """The bug: the FY2021 report showed FY2020/FY2019 because FY2021 was held by the FY2022 report."""
    for year in (2023, 2022, 2021):  # newest first, as the Newsweb import does
        _ingest(db, storage, holding, year, REPORTS[year])
    doc = db.query(Document).filter_by(original_filename="acme-2021-12-31.xhtml").one()
    periods = {f.period for f in db.query(FinancialLineItem).filter_by(document_id=doc.id)}
    assert periods == {"FY2021", "FY2020"}


def test_a_restated_comparative_never_replaces_the_reports_own_figure(db, storage, holding):
    restated_2022 = {2022: "1 100.0", 2021: "950.0"}  # the 2022 report restates 2021
    _ingest(db, storage, holding, 2022, restated_2022)
    second = _ingest(db, storage, holding, 2021, REPORTS[2021])
    fy21 = db.query(FinancialLineItem).filter_by(metric="revenue", period="FY2021").one()
    assert fy21.value == 1_000_000_000  # as originally reported, in its own filing
    # ...and the difference is visible rather than silent.
    notes = second.document.quality_flags["facts_differ_from_existing"]
    assert any("FY2021 revenue" in n and "replaces" in n and "acme-2022-12-31.xhtml" in n for n in notes)


def test_a_restated_comparative_is_kept_out_when_the_own_report_came_first(db, storage, holding):
    _ingest(db, storage, holding, 2021, REPORTS[2021])
    later = _ingest(db, storage, holding, 2022, {2022: "1 100.0", 2021: "950.0"})
    fy21 = db.query(FinancialLineItem).filter_by(metric="revenue", period="FY2021").one()
    assert fy21.value == 1_000_000_000
    notes = later.document.quality_flags["facts_differ_from_existing"]
    assert any("FY2021 revenue" in n and "(kept)" in n for n in notes)


def test_nearest_later_report_supplies_a_year_nobody_reports_itself(db, storage, holding):
    # FY2019 appears only as a comparative in two reports (2020 and 2021 filings); no 2019 report on file.
    _ingest(db, storage, holding, 2021, {2021: "1 000.0", 2019: "700.0"})
    _ingest(db, storage, holding, 2020, {2020: "900.0", 2019: "710.0"})
    fy19 = (
        db.query(FinancialLineItem, Document.original_filename)
        .join(Document, Document.id == FinancialLineItem.document_id)
        .filter(FinancialLineItem.period == "FY2019")
        .one()
    )
    assert fy19[1] == "acme-2020-12-31.xhtml" and fy19[0].value == 710_000_000


def test_an_untagged_file_keeps_first_source_wins_and_is_never_displaced(db, storage, holding):
    csv = "Income statement;;\nUSD million;FY 2020;FY 2021\nRevenue;800;850\n"
    ingest_holding_document(
        db, storage, holding_id=holding.id, filename="manual.csv", content=csv.encode(),
        mime_type="text/csv", document_type="other",
    )
    _ingest(db, storage, holding, 2021, REPORTS[2021])
    owners = _owners(db)
    assert owners["FY2021"] == "manual.csv" and owners["FY2020"] == "manual.csv"


def test_refresh_gives_the_same_ownership_as_import(db, storage, holding):
    for year in (2023, 2022, 2021):
        _ingest(db, storage, holding, year, REPORTS[year])
    refresh_document_facts(db, storage, holding)
    db.commit()
    assert _owners(db) == EXPECTED_OWNERS


def test_refresh_repairs_ownership_left_by_the_old_rule(db, storage, holding):
    """What is in the database today: each older report holds only the years nobody newer supplied."""
    for year in (2023, 2022, 2021):
        _ingest(db, storage, holding, year, REPORTS[year])
    docs = {d.original_filename: d for d in db.query(Document)}
    # Rebuild the old state: move every own-year row to the next report's comparative copy.
    for row in db.query(FinancialLineItem).filter_by(metric="revenue", period="FY2021"):
        row.document_id = docs["acme-2022-12-31.xhtml"].id
    db.commit()
    refresh_document_facts(db, storage, holding)
    db.commit()
    assert _owners(db)["FY2021"] == "acme-2021-12-31.xhtml"


def test_source_rank_orders_own_year_then_nearest_later_report():
    assert _source_rank(2021, 2021) < _source_rank(2022, 2021) < _source_rank(2023, 2021)
    assert _source_rank(None, 2021) is None and _source_rank(2021, None) is None


def test_own_year_is_the_latest_year_a_tagged_filing_reports():
    assert own_year_from_details({"ixbrl": {"fiscal_years": ["FY2021", "FY2020", "FY2019"]}}) == 2021
    assert own_year_from_details({"esef_index": {"fiscal_years": ["FY2024", "FY2023"]}}) == 2024
    assert own_year_from_details({"page_count": 3}) is None
    assert own_year_from_details(None) is None
