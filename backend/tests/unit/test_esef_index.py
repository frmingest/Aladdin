"""ESEF history import from filings.xbrl.org (Sprint 10): xBRL-JSON mapping
and the import rules, against a fake index — no network. The filings are
small invented xBRL-JSON reports, not real company figures."""
from __future__ import annotations

import json
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, Holding
from app.models.document import Document
from app.models.financial_line_item import FinancialLineItem
from app.providers.esef_index_provider import (
    EsefFilingRef,
    EsefIndexUnavailableError,
    FilingsXbrlOrgProvider,
)
from app.providers.object_storage import LocalObjectStorageProvider
from app.services.documents.extraction.ixbrl import extract_ixbrl
from app.services.documents.extraction.xbrl_json import (
    map_xbrl_json,
    tagged_facts_from_xbrl_json,
)
from app.services.documents.ingestion import ingest_holding_document
from app.services.filings.esef_index import (
    EsefImportError,
    find_lei,
    import_esef_history,
    latest_import_summary,
)
from tests.unit.test_extraction_ixbrl import BALANCE, HEAD, INCOME

LEI = "5493001ACMEACMEAC012"
OTHER_LEI = "549300OTHEROTHERO099"


def _fact(concept, period, value, *, unit="iso4217:NOK", lei=LEI, decimals=-5, **axes):
    dims = {"concept": concept, "entity": f"scheme:{lei}", "period": period, "unit": unit, **axes}
    return {"value": str(value), "decimals": decimals, "dimensions": dims}


def _year(y: int) -> tuple[str, str, str]:
    """(duration, closing instant, opening instant) for calendar year y, in
    xBRL-JSON's end-exclusive form."""
    return f"{y}-01-01T00:00:00/{y + 1}-01-01T00:00:00", f"{y + 1}-01-01T00:00:00", f"{y}-01-01T00:00:00"


def _report(year: int, *, revenue: dict[int, int], lei: str = LEI) -> dict:
    facts = {}
    n = 0

    def _f(*args, **kwargs):
        return _fact(*args, lei=lei, **kwargs)

    for y, rev in revenue.items():
        duration, closing, _ = _year(y)
        for f in (
            _f("ifrs-full:Revenue", duration, f"{rev}.0"),
            _f("ifrs-full:ProfitLoss", duration, rev // 10),
            _f("ifrs-full:ProfitLossBeforeTax", duration, rev // 5),
            _f("ifrs-full:IncomeTaxExpenseContinuingOperations", duration, rev // 5 - rev // 10),
            _f("ifrs-full:Assets", closing, rev * 3),
            _f("ifrs-full:Equity", closing, rev),
            _f("ifrs-full:Equity", closing, -5, **{"ifrs-full:ComponentsOfEquityAxis": "ifrs-full:RetainedEarningsMember"}),
            _f("ifrs-full:BasicEarningsLossPerShare", duration, "1.25", unit="iso4217:NOK/xbrli:shares", decimals=2),
            _f("ifrs-full:DisclosureOfNotesText", duration, "text", unit=None),
        ):
            if f["dimensions"]["unit"] is None:
                del f["dimensions"]["unit"]
                f["value"] = "Some note text"
            n += 1
            facts[f"f{n}"] = f
        facts[f"f{n + 1}"] = _f("ifrs-full:Revenue", f"{y}-10-01T00:00:00/{y + 1}-01-01T00:00:00", 1)
        n += 1
    return {"documentInfo": {"documentType": "https://xbrl.org/2021/xbrl-json"}, "facts": facts, "_year": year, "_lei": lei}


class FakeIndex(FilingsXbrlOrgProvider):
    def __init__(self, reports: dict[int, dict], fail_years: set[int] | None = None):
        super().__init__()
        self.reports = reports
        self.fail_years = fail_years or set()
        self.listed: list[str] = []

    def list_filings(self, lei):
        self.listed.append(lei)
        if lei != LEI:
            return []
        return [
            EsefFilingRef(
                period_end=f"{y}-12-31", fxo_id=f"{LEI}-{y}-12-31-ESEF-NO-0",
                json_url=f"https://filings.xbrl.org/x/{y}.json", report_url=f"https://filings.xbrl.org/x/{y}.xhtml",
                viewer_url="", error_count=0, date_added=f"{y + 1}-05-01", country="NO",
            )
            for y in sorted(self.reports, reverse=True)
        ]

    def get_filing_json(self, ref):
        year = int(ref.period_end[:4])
        if year in self.fail_years:
            raise EsefIndexUnavailableError("HTTP 503")
        data = self.reports[year]
        clean = {k: v for k, v in data.items() if not k.startswith("_")}
        return clean, json.dumps(clean, sort_keys=True).encode()


def _three_years() -> dict[int, dict]:
    return {
        2024: _report(2024, revenue={2024: 3000, 2023: 2900}),
        2023: _report(2023, revenue={2023: 2800, 2022: 2500}),  # FY2023 restated in the 2024 report
        2022: _report(2022, revenue={2022: 2400, 2021: 2000}),
    }


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
    h = Holding(ticker="ACME.OL", name="ACME ASA", trading_currency="NOK")
    db.add(h)
    db.commit()
    return h


def _values(db, metric):
    return {
        r.period: r.value
        for r in db.query(FinancialLineItem).filter(FinancialLineItem.metric == metric).all()
    }


# --- xBRL-JSON mapping -------------------------------------------------------------


def test_xbrl_json_periods_are_end_exclusive_and_units_are_short():
    tagged, contexts = tagged_facts_from_xbrl_json(_report(2024, revenue={2024: 3000}))
    revenue = next(f for f in tagged if f.concept == "ifrs-full:Revenue" and contexts[f.context_id].start.month != 10)
    ctx = contexts[revenue.context_id]
    assert (ctx.start.isoformat(), ctx.end.isoformat()) == ("2024-01-01", "2024-12-31")
    assert revenue.unit == "NOK" and revenue.value == Decimal(3000)
    assets = next(f for f in tagged if f.concept == "ifrs-full:Assets")
    assert contexts[assets.context_id].is_instant and contexts[assets.context_id].end.isoformat() == "2024-12-31"
    eps = next(f for f in tagged if f.concept == "ifrs-full:BasicEarningsLossPerShare")
    assert eps.unit == "NOK/shares"
    # Text facts have no unit and are skipped.
    assert not any("Disclosure" in f.concept for f in tagged)


def test_xbrl_json_maps_like_an_uploaded_filing():
    mapped = map_xbrl_json(_report(2024, revenue={2024: 3000, 2023: 2900}))
    facts = {(f.metric, f.period): f for f in mapped.facts}
    assert facts[("revenue", "FY2024")].value == Decimal(3000)
    # The equity-component row (axis) never replaces group equity.
    assert facts[("total_equity", "FY2024")].value == Decimal(3000)
    assert facts[("eps_basic", "FY2024")].unit == "NOK/shares"
    # The Q4-only duration isn't annual.
    assert {f.period for f in mapped.facts} == {"FY2024", "FY2023"}
    assert mapped.integrity["failed"] == [] and mapped.integrity["passed"] >= 2


def test_same_filing_as_xhtml_and_as_xbrl_json_gives_the_same_metrics():
    """The upload fixture from test_extraction_ixbrl, re-expressed in
    xBRL-JSON: map_tagged_facts must produce identical facts."""
    xhtml = (HEAD + "<div><table>" + INCOME + BALANCE + "</table></div></div></body></html>").encode()
    from_xhtml = {(f.metric, f.period, f.value, f.unit) for f in extract_ixbrl(xhtml).facts}

    fy25, i25, _ = _year(2025)
    fy24, i24, _ = _year(2024)
    rows = [
        ("ifrs-full:Revenue", fy25, "8095600000"), ("ifrs-full:Revenue", fy24, "7450100000"),
        ("ifrs-full:DepreciationAndAmortisationExpense", fy25, "2710100000"),
        ("ifrs-full:DepreciationAndAmortisationExpense", fy24, "1915900000"),
        ("ifrs-full:ProfitLoss", fy25, "846400000"), ("ifrs-full:ProfitLoss", fy24, "-327100000"),
        ("ACME:HybridCoupon", fy25, "61300000"),
        ("ifrs-full:Assets", i25, "26145300000"), ("ifrs-full:Assets", i24, "21868200000"),
        ("ifrs-full:Equity", i25, "560000000"),
        ("ifrs-full:LongtermBorrowings", i25, "5841900000"), ("ifrs-full:ShorttermBorrowings", i25, "100000000"),
        ("ifrs-full:CashAndCashEquivalents", i25, "699900000"),
    ]
    data = {"facts": {f"f{i}": _fact(c, p, v, unit="iso4217:USD") for i, (c, p, v) in enumerate(rows)}}
    data["facts"]["seg"] = _fact(
        "ifrs-full:Equity", i25, "-280000000", unit="iso4217:USD",
        **{"ifrs-full:ComponentsOfEquityAxis": "ifrs-full:RetainedEarningsMember"},
    )
    from_json = {(f.metric, f.period, f.value, f.unit) for f in map_xbrl_json(data).facts}
    assert from_json == from_xhtml


# --- import rules -----------------------------------------------------------------


def test_import_takes_each_year_from_its_own_filing_plus_one_comparative_year(db, storage, holding):
    result = import_esef_history(db, holding, FakeIndex(_three_years()), storage, lei=LEI)

    assert result.periods_imported == ["FY2024", "FY2023", "FY2022", "FY2021"]
    revenue = _values(db, "revenue")
    assert revenue["FY2024"] == 3000
    assert revenue["FY2023"] == 2800  # its own report, not the 2024 report's comparative
    assert revenue["FY2022"] == 2400
    assert revenue["FY2021"] == 2000  # only in the 2022 report's comparative column
    assert result.latest_period_in_index == "FY2024"
    by_fxo = {f.fxo_id: f.years_used for f in result.filings}
    assert by_fxo[f"{LEI}-2022-12-31-ESEF-NO-0"] == ["FY2022", "FY2021"]
    # One stored Document per filing, each line item pointing at its filing.
    docs = db.query(Document).filter(Document.type == "esef_index_facts").all()
    assert len(docs) == 3
    fy21 = db.query(FinancialLineItem).filter(FinancialLineItem.period == "FY2021").first()
    assert db.get(Document, fy21.document_id).quality_flags["fxo_id"].startswith(f"{LEI}-2022")


def test_years_from_an_uploaded_file_are_kept(db, storage, holding):
    xhtml = (HEAD + "<div><table>" + INCOME + BALANCE + "</table></div></div></body></html>").encode()
    ingest_holding_document(
        db, storage, holding_id=holding.id, filename="acme-2025.xhtml", content=xhtml,
        mime_type="application/xhtml+xml", document_type="annual_report",
    )  # FY2025 + FY2024 comparatives, in USD
    result = import_esef_history(db, holding, FakeIndex(_three_years()), storage, lei=LEI)

    assert result.periods_skipped_existing == ["FY2024"]
    assert "FY2024" not in result.periods_imported
    assert _values(db, "revenue")["FY2024"] == Decimal(7450100000)  # the upload's figure


def test_reimport_replaces_the_previous_import(db, storage, holding):
    index = FakeIndex(_three_years())
    import_esef_history(db, holding, index, storage, lei=LEI)
    count = db.query(FinancialLineItem).count()
    again = import_esef_history(db, holding, index, storage, lei=LEI)
    assert db.query(FinancialLineItem).count() == count
    assert db.query(Document).filter(Document.type == "esef_index_facts").count() == 3  # deduplicated
    assert latest_import_summary(db, holding).imported_at == again.imported_at


def test_refuses_a_filing_reported_for_another_lei(db, storage, holding):
    reports = _three_years()
    reports[2023] = _report(2023, revenue={2023: 1}, lei=OTHER_LEI)
    with pytest.raises(EsefImportError, match="another company"):
        import_esef_history(db, holding, FakeIndex(reports), storage, lei=LEI)
    assert db.query(FinancialLineItem).count() == 0


def test_a_filing_that_cannot_be_fetched_is_a_warning(db, storage, holding):
    result = import_esef_history(db, holding, FakeIndex(_three_years(), fail_years={2023}), storage, lei=LEI)
    assert any("FY2023 filing skipped" in w for w in result.warnings)
    # FY2023 still comes from the 2024 report's comparative column.
    assert _values(db, "revenue")["FY2023"] == 2900


def test_lei_is_found_in_an_uploaded_esef_file(db, storage, holding):
    head = HEAD.replace('scheme="lei">X<', f'scheme="http://standards.iso.org/iso/17442">{LEI}<')
    xhtml = (head + "<div><table>" + INCOME + "</table></div></div></body></html>").encode()
    ingest_holding_document(
        db, storage, holding_id=holding.id, filename="Acme-annual-report.xhtml", content=xhtml,
        mime_type="application/xhtml+xml", document_type="annual_report",
    )
    lei, source = find_lei(db, holding)
    assert lei == LEI and "Acme-annual-report.xhtml" in source

    result = import_esef_history(db, holding, FakeIndex(_three_years()), storage)
    assert result.lei == LEI and result.lei_source.startswith("uploaded ESEF file")


def test_lei_is_found_in_an_esef_file_name(db, storage, holding):
    ingest_holding_document(
        db, storage, holding_id=holding.id, filename=f"{LEI}-2025-12-31-0-no.csv",
        content=b"Line item;2025\nRevenue;1\n", mime_type="text/csv", document_type="other",
    )
    assert find_lei(db, holding)[0] == LEI


def test_no_lei_and_bad_lei_fail_visibly(db, storage, holding):
    with pytest.raises(EsefImportError, match="No LEI found"):
        import_esef_history(db, holding, FakeIndex(_three_years()), storage)
    with pytest.raises(EsefImportError, match="not a valid LEI"):
        import_esef_history(db, holding, FakeIndex(_three_years()), storage, lei="ACME")
    with pytest.raises(EsefImportError, match="no ESEF filings"):
        import_esef_history(db, holding, FakeIndex(_three_years()), storage, lei=OTHER_LEI)


# --- provider: filing list parsing ---------------------------------------------------


class _Response:
    def __init__(self, payload):
        self.status_code = 200
        self.content = json.dumps(payload).encode()
        self._payload = payload

    def json(self):
        return self._payload


class _Client:
    def __init__(self, payload):
        self.payload = payload
        self.urls: list[str] = []

    def get(self, url, headers=None):
        self.urls.append(url)
        return _Response(self.payload)


def test_provider_keeps_one_filing_per_period_end():
    def row(period, country, errors, added, lang="en"):
        return {"type": "filing", "attributes": {
            "period_end": period, "fxo_id": f"{LEI}-{period}-ESEF-{country}-0", "error_count": errors,
            "date_added": added, "country": country,
            "json_url": f"/{LEI}/{period}/ESEF/{country}/0/{LEI}-{period}-{lang}.json",
            "report_url": f"/{LEI}/{period}/x.xhtml", "viewer_url": "",
        }}

    client = _Client({"data": [
        row("2023-12-31", "NO", 0, "2024-05-01"),
        row("2024-12-31", "NO", 2, "2025-05-21 16:38"),
        row("2024-12-31", "LU", 0, "2025-05-21 16:39"),
        {"type": "filing", "attributes": {"period_end": None}},
    ]})
    filings = FilingsXbrlOrgProvider(client=client).list_filings(LEI.lower())
    assert [f.period_end for f in filings] == ["2024-12-31", "2023-12-31"]
    assert filings[0].country == "LU"  # fewer validation errors wins
    assert filings[0].json_url.startswith("https://filings.xbrl.org/")
    assert client.urls[0] == f"https://filings.xbrl.org/api/entities/{LEI}/filings?page%5Bsize%5D=100"
