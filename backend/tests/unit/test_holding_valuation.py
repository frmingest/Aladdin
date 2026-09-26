"""Unit tests for app.services.valuation.holding_valuation — the Sprint 3
orchestration that ties live market data, the versioned assumptions, and
the deterministic DCF/multiples modules together for one holding, against
an in-memory SQLite DB and fake providers (no real network calls)."""
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, Document, FinancialLineItem, Holding
from app.providers.base import (
    FxRate,
    MarketDataUnavailableError,
    PricePoint,
    RiskFreeRate,
)
from app.services.valuation.holding_valuation import compute_holding_valuation

D = Decimal
_DEFAULT_BETA = D("1.0")


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


class _FakeMarketDataProvider:
    name = "fake"

    def __init__(self, *, price: PricePoint | None = None, fx: FxRate | None = None, beta=_DEFAULT_BETA):
        self._price = price
        self._fx = fx
        self._beta = beta

    def get_current_price(self, ticker, *, currency_hint=None):
        if self._price is None:
            raise MarketDataUnavailableError("no price configured")
        return self._price

    def get_price_history(self, ticker, *, years=5, currency_hint=None):  # pragma: no cover
        raise NotImplementedError

    def get_fx_rate(self, from_currency, to_currency):
        if self._fx is None:
            raise MarketDataUnavailableError("no fx configured")
        return self._fx

    def get_beta(self, ticker):
        return self._beta


class _FakeRiskFreeRateProvider:
    def __init__(self, *, rate: RiskFreeRate | None = None):
        self._rate = rate

    def get_risk_free_rate(self, currency):
        if self._rate is None:
            from app.providers.base import RiskFreeRateUnavailableError

            raise RiskFreeRateUnavailableError("no rate configured")
        return self._rate


def _document(holding: Holding) -> Document:
    return Document(
        holding=holding, type="filing", original_filename="10k.pdf", mime_type="application/pdf",
        size_bytes=100, storage_path="documents/10k.pdf", sha256="a" * 64, status="processed",
        quality_flags={},
    )


def _add_period(db: Session, document: Document, holding: Holding, period: str, *, net_income, d_and_a, capex, shares, currency="USD"):
    facts = {
        "net_income": net_income, "depreciation_and_amortization": d_and_a,
        "capital_expenditures": capex, "shares_outstanding": shares,
    }
    for metric, value in facts.items():
        db.add(
            FinancialLineItem(
                document=document, holding=holding, metric=metric, value=D(value),
                unit="USD", currency=currency, period=period, confidence=0.95,
            )
        )


def _setup_holding_with_two_periods(db: Session, *, trading_currency="USD", filing_currency="USD") -> Holding:
    holding = Holding(ticker="AAPL", name="Apple Inc.", trading_currency=trading_currency)
    document = _document(holding)
    db.add_all([holding, document])
    db.flush()
    _add_period(db, document, holding, "FY2024", net_income="80", d_and_a="20", capex="10", shares="10", currency=filing_currency)
    _add_period(db, document, holding, "FY2025", net_income="100", d_and_a="25", capex="15", shares="10", currency=filing_currency)
    db.commit()
    return holding


def _price_point(price="200", currency="USD") -> PricePoint:
    return PricePoint(price=D(price), currency=currency, observed_at=datetime.now(timezone.utc), provider="fake")


def _risk_free_rate(rate="4.00", currency="USD") -> RiskFreeRate:
    return RiskFreeRate(currency=currency, rate=D(rate), observed_at=datetime.now(timezone.utc), provider="fake", source_series_id="FAKE10Y")


def test_full_valuation_computes_dcf_and_reverse_dcf():
    with _session() as db:
        holding = _setup_holding_with_two_periods(db)
        market_provider = _FakeMarketDataProvider(price=_price_point())
        rate_provider = _FakeRiskFreeRateProvider(rate=_risk_free_rate())

        result = compute_holding_valuation(db, holding, market_provider, rate_provider)

    assert result.unavailable_reasons == []
    assert result.valuation_currency == "USD"
    # owner earnings: FY2024 = 80+20-10=90, FY2025 = 100+25-15=110 -> CAGR over 1 year = 110/90-1
    assert result.base_growth_rate == D("110") / D("90") - D("1")
    # discount rate = 4%/100 + 1.0*0.045 = 0.04+0.045 = 0.085
    assert result.discount_rate == D("0.085")
    assert result.current_price_per_share == D("200")
    assert result.dcf is not None
    assert {s.label for s in result.dcf.scenarios} == {"bear", "base", "bull"}
    assert result.reverse_dcf_implied_growth is not None


def test_currency_mismatch_converts_price_via_fx():
    with _session() as db:
        # Filings report in USD, but the stock trades in NOK.
        holding = _setup_holding_with_two_periods(db, trading_currency="NOK", filing_currency="USD")
        market_provider = _FakeMarketDataProvider(
            price=_price_point(price="2000", currency="NOK"),
            fx=FxRate(from_currency="NOK", to_currency="USD", rate=D("0.095"), observed_at=datetime.now(timezone.utc), provider="fake"),
        )
        rate_provider = _FakeRiskFreeRateProvider(rate=_risk_free_rate(currency="USD"))

        result = compute_holding_valuation(db, holding, market_provider, rate_provider)

    assert result.valuation_currency == "USD"
    assert result.current_price_per_share == D("2000") * D("0.095")


def test_missing_fx_rate_skips_price_dependent_parts_but_keeps_dcf():
    with _session() as db:
        holding = _setup_holding_with_two_periods(db, trading_currency="NOK", filing_currency="USD")
        market_provider = _FakeMarketDataProvider(price=_price_point(price="2000", currency="NOK"), fx=None)
        rate_provider = _FakeRiskFreeRateProvider(rate=_risk_free_rate(currency="USD"))

        result = compute_holding_valuation(db, holding, market_provider, rate_provider)

    assert result.current_price_per_share is None
    assert result.dcf is not None  # DCF scenarios still computed without a price
    assert result.reverse_dcf_implied_growth is None
    assert any("FX rate" in reason for reason in result.unavailable_reasons)


def test_missing_risk_free_rate_makes_dcf_unavailable_entirely():
    with _session() as db:
        holding = _setup_holding_with_two_periods(db)
        market_provider = _FakeMarketDataProvider(price=_price_point())
        rate_provider = _FakeRiskFreeRateProvider(rate=None)

        result = compute_holding_valuation(db, holding, market_provider, rate_provider)

    assert result.dcf is None
    assert any("risk-free rate" in reason for reason in result.unavailable_reasons)


def test_missing_beta_falls_back_to_assumptions_default_and_says_so():
    with _session() as db:
        holding = _setup_holding_with_two_periods(db)
        market_provider = _FakeMarketDataProvider(price=_price_point(), beta=None)
        rate_provider = _FakeRiskFreeRateProvider(rate=_risk_free_rate())

        result = compute_holding_valuation(db, holding, market_provider, rate_provider)

    assert result.beta == D("1.0")  # v1 assumptions' default_beta
    assert any("default beta" in reason for reason in result.unavailable_reasons)
    assert result.dcf is not None


def test_fewer_than_two_periods_makes_dcf_unavailable():
    with _session() as db:
        holding = Holding(ticker="AAPL", name="Apple Inc.", trading_currency="USD")
        document = _document(holding)
        db.add_all([holding, document])
        db.flush()
        _add_period(db, document, holding, "FY2025", net_income="100", d_and_a="25", capex="15", shares="10")
        db.commit()

        market_provider = _FakeMarketDataProvider(price=_price_point())
        rate_provider = _FakeRiskFreeRateProvider(rate=_risk_free_rate())
        result = compute_holding_valuation(db, holding, market_provider, rate_provider)

    assert result.dcf is None
    assert any("fewer than two periods" in reason for reason in result.unavailable_reasons)


def test_fewer_than_two_periods_still_fetches_and_shows_the_price():
    """2026-09-26 fix: a holding with too little data for a DCF used to
    skip the price fetch entirely, so the margin-of-safety board and
    watchlist showed "no price" for a company that in fact has a
    perfectly good quote (see Sprint 11's known-issue fix)."""
    with _session() as db:
        holding = Holding(ticker="AAPL", name="Apple Inc.", trading_currency="USD")
        document = _document(holding)
        db.add_all([holding, document])
        db.flush()
        _add_period(db, document, holding, "FY2025", net_income="100", d_and_a="25", capex="15", shares="10")
        db.commit()

        market_provider = _FakeMarketDataProvider(price=_price_point())
        rate_provider = _FakeRiskFreeRateProvider(rate=_risk_free_rate())
        result = compute_holding_valuation(db, holding, market_provider, rate_provider)

    assert result.dcf is None
    assert result.current_price_per_share == D("200")
    assert result.valuation_currency == "USD"


def test_no_financial_line_items_at_all_still_fetches_price_in_trading_currency():
    with _session() as db:
        holding = Holding(ticker="AAPL", name="Apple Inc.", trading_currency="USD")
        db.add(holding)
        db.flush()
        db.commit()

        market_provider = _FakeMarketDataProvider(price=_price_point())
        rate_provider = _FakeRiskFreeRateProvider(rate=_risk_free_rate())
        result = compute_holding_valuation(db, holding, market_provider, rate_provider)

    assert result.dcf is None
    assert result.valuation_currency == "USD"
    assert result.current_price_per_share == D("200")


def test_multiples_are_still_computed_even_when_dcf_is_unavailable():
    with _session() as db:
        holding = Holding(ticker="AAPL", name="Apple Inc.", trading_currency="USD")
        document = _document(holding)
        db.add_all([holding, document])
        db.flush()
        _add_period(db, document, holding, "FY2025", net_income="100", d_and_a="25", capex="15", shares="10")
        db.commit()

        market_provider = _FakeMarketDataProvider(price=_price_point())
        rate_provider = _FakeRiskFreeRateProvider(rate=_risk_free_rate())
        result = compute_holding_valuation(db, holding, market_provider, rate_provider)

    # multiples_over_time doesn't depend on the DCF succeeding.
    assert len(result.multiples) == 1
