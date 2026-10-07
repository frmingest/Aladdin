"""Tag review service: newest report wins, and a gap another document fills is dropped."""
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, Document, FinancialLineItem, Holding
from app.services.tag_review import build_tag_review


def _doc(db, holding, fy, gaps, *, name="r.xhtml", sha="a"):
    document = Document(
        holding_id=holding.id, type="annual_report", original_filename=name, mime_type="application/xhtml+xml",
        size_bytes=1, storage_path="x", sha256=sha * 64, status="processed",
        quality_flags={"ixbrl": {"tag_review": {"version": 1, "fiscal_year": fy, "gaps": gaps, "unused": []}}},
    )
    db.add(document)
    db.flush()
    return document


GAP = {"metric": "capital expenditure", "fiscal_year": "FY2025", "candidates": []}


def test_newest_fiscal_year_wins_and_filled_gaps_are_dropped():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        holding = Holding(ticker="ACME.OL", name="Acme", trading_currency="NOK")
        db.add(holding)
        db.flush()
        _doc(db, holding, "FY2024", [{**GAP, "fiscal_year": "FY2024"}], sha="b")
        newest = _doc(db, holding, "FY2025", [GAP, {**GAP, "metric": "share count"}], sha="c")
        db.commit()

        result = build_tag_review(db)
        assert [g["metric"] for g in result["holdings"][0]["gaps"]] == ["capital expenditure", "share count"]
        assert result["holdings"][0]["document_id"] == newest.id

        db.add(FinancialLineItem(
            document_id=newest.id, holding_id=holding.id, metric="capital_expenditures",
            value=Decimal(5), unit="NOK", currency="NOK", period="FY2025", confidence=1.0,
        ))
        db.commit()
        result = build_tag_review(db)
        assert [g["metric"] for g in result["holdings"][0]["gaps"]] == ["share count"]
        assert result["total_gaps"] == 1
