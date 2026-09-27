"""Country-risk storage + evidence (Epic F22, story 22.10). The DoD asks
for proof that no fallback/placeholder from the CWO port can reach the
evidence packet: a failed fetch leaves the figures missing."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, Document, FundExposure, Holding
from app.providers.world_bank import WorldBankUnavailableError, YearValue
from app.services.country_risk.domicile import country_exposure, listing_country
from app.services.country_risk.indicators import (
    describe_country_risk,
    get_country_risk,
    refresh_country,
)

D = Decimal


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


class _Provider:
    name = "fake"

    def __init__(self, data):
        self.data = data
        self.calls = []

    def fetch(self, country, indicator, *, start_year, end_year, source_id=None):
        self.calls.append((country, indicator, source_id))
        if indicator not in self.data:
            raise WorldBankUnavailableError(f"no {indicator}")
        return [YearValue(y, D(str(v))) for y, v in self.data[indicator]]


NORWAY = {
    "GC.DOD.TOTL.GD.ZS": [(2022, 38), (2023, 40), (2024, 42)],
    "GC.NLD.TOTL.GD.ZS": [(2022, 25), (2024, 12)],
    "BN.CAB.XOKA.GD.ZS": [(2024, 17)],
    "FI.RES.TOTL.MO": [(2024, 4.5)],
    "NY.GDP.MKTP.KD.ZG": [(2022, 3), (2023, 0.5), (2024, 2.1)],
    "PV.EST": [(2023, 0.95)],
}


def test_refresh_then_score_norway_with_data_years():
    db = _session()
    provider = _Provider(NORWAY)
    result = refresh_country(db, provider, "NOR", only_stale=False)
    assert result.status == "partial"  # external debt + reserves US$ not provided
    assert ("NOR", "PV.EST", 3) in provider.calls  # WGI uses source=3
    risk = get_country_risk(db, "NOR")
    assert risk.ssi.score is not None and risk.ssi.band == "Low stress"
    assert risk.ssi.components["fiscal_deficit"] >= D(0)
    text = describe_country_risk(risk)
    assert "(2024" in text and "no crisis probability" in text
    assert "NOK is not one of the IMF SDR basket" in text


def test_second_refresh_within_window_is_skipped():
    db = _session()
    provider = _Provider(NORWAY)
    refresh_country(db, provider, "NOR", only_stale=False)
    assert refresh_country(db, provider, "NOR").status == "fresh"


def test_failed_fetch_leaves_everything_missing_no_placeholder():
    db = _session()
    result = refresh_country(db, _Provider({}), "USA", only_stale=False)
    assert result.status == "failed" and result.errors
    risk = get_country_risk(db, "USA")
    assert risk.ssi.score is None
    assert all(f.value is None for f in risk.figures)
    assert "not computable" in describe_country_risk(risk)


def test_stock_uses_listing_country_and_fund_needs_look_through():
    db = _session()
    stock = Holding(ticker="KOG.OL", name="Kongsberg", trading_currency="NOK", asset_class_raw="stock")
    etf = Holding(ticker="XDEF.DE", name="Xtrackers Defence", trading_currency="EUR", asset_class_raw="equity_etf")
    db.add_all([stock, etf])
    db.commit()
    assert country_exposure(db, stock).weights == {"NOR": D(100)}
    assert listing_country("AAPL") == "USA"
    gap = country_exposure(db, etf)
    assert gap.gap and "ECON-F22-08" in gap.gap
    doc = Document(holding=etf, type="fund_report", original_filename="f.pdf", mime_type="application/pdf",
                   size_bytes=1, storage_path="f.pdf", sha256="e" * 64, status="processed", quality_flags={})
    db.add(doc)
    db.flush()
    db.add_all([
        FundExposure(holding_id=etf.id, dimension="country", as_of_date=date(2026, 6, 30), label="Germany",
                     weight_pct=D(30), source_document_id=doc.id),
        FundExposure(holding_id=etf.id, dimension="country", as_of_date=date(2026, 6, 30), label="Atlantis",
                     weight_pct=D(5), source_document_id=doc.id),
    ])
    db.commit()
    exposure = country_exposure(db, etf)
    assert exposure.weights == {"DEU": D(30)} and exposure.unmapped_pct == D(5)
