"""Unit tests for app.services.analysis.evidence_packet — the Sprint 4
evidence-packet builder, against an in-memory SQLite DB and fake
providers (no real yfinance/FRED/Gemini calls)."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, Document, FinancialLineItem, Holding
from app.providers.base import (
    FxRate,
    MarketDataUnavailableError,
    PricePoint,
    ResearchItem,
    RiskFreeRate,
    RiskFreeRateUnavailableError,
)
from app.services.analysis.evidence_packet import build_evidence_packet

D = Decimal
_DEFAULT_BETA = D("1.0")


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


class _FakeMarket:
    name = "fake"

    def __init__(self, *, price: PricePoint | None = None, beta=_DEFAULT_BETA):
        self._price = price
        self._beta = beta

    def get_current_price(self, ticker, *, currency_hint=None):
        if self._price is None:
            raise MarketDataUnavailableError("no price configured")
        return self._price

    def get_price_history(self, ticker, *, years=5, currency_hint=None):  # pragma: no cover
        raise NotImplementedError

    def get_fx_rate(self, from_currency, to_currency):
        return FxRate(from_currency=from_currency, to_currency=to_currency, rate=D("1"), observed_at=datetime.now(timezone.utc), provider="fake")

    def get_beta(self, ticker):
        return self._beta


class _FakeRate:
    def __init__(self, *, rate: RiskFreeRate | None = None):
        self._rate = rate

    def get_risk_free_rate(self, currency):
        if self._rate is None:
            raise RiskFreeRateUnavailableError("no rate configured")
        return self._rate


class _FakeResearch:
    name = "fake"

    def __init__(self, *, item: ResearchItem | None = None):
        self._item = item

    def get_macro_research(self):
        return [self._item] if self._item else []

    def get_sector_research(self, sector):
        return [self._item] if self._item else []

    def get_company_research(self, *, company_name, ticker, sector):
        return [self._item] if self._item else []


def _research_item() -> ResearchItem:
    return ResearchItem(
        source_url="https://example.com/a",
        source_name="example.com",
        title="A finding",
        summary="Something relevant.",
        source_type="macro_news",
        retrieved_at=datetime.now(timezone.utc),
    )


def _holding(**overrides) -> Holding:
    defaults = {"ticker": "AAPL", "name": "Apple Inc.", "trading_currency": "USD", "sector": "Technology"}
    defaults.update(overrides)
    return Holding(**defaults)


def _add_period(db, document, holding, period, *, net_income, total_equity, revenue, cogs, opinc, d_and_a, capex, shares):
    facts = {
        "net_income": net_income,
        "total_equity": total_equity,
        "revenue": revenue,
        "cost_of_goods_sold": cogs,
        "operating_income": opinc,
        "depreciation_and_amortization": d_and_a,
        "capital_expenditures": capex,
        "shares_outstanding": shares,
    }
    for metric, value in facts.items():
        db.add(
            FinancialLineItem(
                document=document, holding=holding, metric=metric, value=D(value),
                unit="USD", currency="USD", period=period, confidence=0.9,
            )
        )


def _document(holding: Holding) -> Document:
    return Document(
        holding=holding, type="filing", original_filename="10k.pdf", mime_type="application/pdf",
        size_bytes=1, storage_path="documents/10k.pdf", sha256="a" * 64, status="processed",
        quality_flags={},
    )


def test_evidence_ids_are_unique_and_sequential():
    db = _session()
    holding = _holding()
    db.add(holding)
    db.commit()

    packet = build_evidence_packet(
        db, holding,
        market_data_provider=_FakeMarket(),
        risk_free_rate_provider=_FakeRate(),
        research_provider=_FakeResearch(item=_research_item()),
    )
    ids = [item.id for item in packet.items]
    assert ids == sorted(ids)
    assert len(ids) == len(set(ids))
    assert all(i.startswith("EV-") for i in ids)


def test_computes_roe_history_and_hurdle_comparison():
    db = _session()
    holding = _holding()
    db.add(holding)
    document = _document(holding)
    db.add(document)
    db.flush()
    _add_period(db, document, holding, "FY2024", net_income="100", total_equity="500", revenue="1000", cogs="600", opinc="150", d_and_a="30", capex="20", shares="10")
    _add_period(db, document, holding, "FY2025", net_income="120", total_equity="550", revenue="1100", cogs="650", opinc="170", d_and_a="32", capex="22", shares="10")
    db.commit()

    packet = build_evidence_packet(
        db, holding,
        market_data_provider=_FakeMarket(),
        risk_free_rate_provider=_FakeRate(),
        research_provider=_FakeResearch(),
    )

    roe_items = [i for i in packet.items if i.label == "ROE (return on equity) history"]
    assert len(roe_items) == 1
    assert "2024" in roe_items[0].content and "2025" in roe_items[0].content
    assert "average" in roe_items[0].content.lower()

    hurdle_items = [i for i in packet.items if "hurdle" in i.content.lower() and i.label.startswith("ROE")]
    assert hurdle_items, "expected the hurdle comparison to be folded into the ROE evidence item"
    assert "MEETS" in hurdle_items[0].content or "BELOW" in hurdle_items[0].content

    roic_items = [i for i in packet.items if i.label.startswith("ROIC")]
    assert len(roic_items) == 1
    assert "not computable" in roic_items[0].content.lower()


def test_no_financial_facts_reports_a_gap_not_a_crash():
    db = _session()
    holding = _holding()
    db.add(holding)
    db.commit()

    packet = build_evidence_packet(
        db, holding,
        market_data_provider=_FakeMarket(),
        risk_free_rate_provider=_FakeRate(),
        research_provider=_FakeResearch(),
    )
    history_items = [i for i in packet.items if i.category == "financial_history"]
    assert len(history_items) == 1
    assert "no extracted financial facts" in history_items[0].content.lower()


def test_missing_sector_is_recorded_as_unavailable_reason_not_a_crash():
    db = _session()
    holding = _holding(sector=None)
    db.add(holding)
    db.commit()

    packet = build_evidence_packet(
        db, holding,
        market_data_provider=_FakeMarket(),
        risk_free_rate_provider=_FakeRate(),
        research_provider=_FakeResearch(item=_research_item()),
    )
    assert any("sector research skipped" in reason for reason in packet.unavailable_reasons)
    assert not any(i.category == "sector_research" for i in packet.items)


def test_research_items_carry_a_real_citation():
    db = _session()
    holding = _holding()
    db.add(holding)
    db.commit()

    item = _research_item()
    packet = build_evidence_packet(
        db, holding,
        market_data_provider=_FakeMarket(),
        risk_free_rate_provider=_FakeRate(),
        research_provider=_FakeResearch(item=item),
    )
    macro_items = [i for i in packet.items if i.category == "macro_research" and i.citation]
    assert macro_items
    assert item.source_url in macro_items[0].citation


def test_valuation_unavailable_reasons_propagate_into_packet():
    db = _session()
    holding = _holding()
    db.add(holding)
    document = _document(holding)
    db.add(document)
    db.flush()
    _add_period(db, document, holding, "FY2025", net_income="100", total_equity="500", revenue="1000", cogs="600", opinc="150", d_and_a="30", capex="20", shares="10")
    db.commit()  # only one period -> DCF unavailable (needs >= 2)

    packet = build_evidence_packet(
        db, holding,
        market_data_provider=_FakeMarket(),
        risk_free_rate_provider=_FakeRate(),
        research_provider=_FakeResearch(),
    )
    assert any(r.startswith("valuation: DCF unavailable") for r in packet.unavailable_reasons)
