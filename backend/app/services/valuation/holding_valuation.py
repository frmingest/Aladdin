"""Ties the valuation engine together for one holding (Sprint 3): live
market data + risk-free rate (app/services/market_data/), the versioned
assumptions (app/domain/valuation_assumptions/), and the deterministic
calc modules (growth, discount_rate, dcf, multiples) into one result the
API (app/api/valuation.py) can serve.

Currency handling: a DCF discounts owner earnings, which are computed from
FinancialLineItem facts in whatever currency that holding's filings report
in (`FinancialLineItem.currency`) — not necessarily the same currency the
stock trades in (`Holding.trading_currency`; e.g. a Norway-listed company
that reports in USD). The live share price and risk-free rate both need to
be in the *filing's* currency for the DCF to be internally consistent, so
this module converts the price via a live FX rate when the two differ,
and fetches the risk-free rate for the filing's currency, not the trading
currency.

Fail-visibly discipline (CLAUDE.md): a missing/unconvertible price, an
unavailable risk-free rate, or too little owner-earnings history each
degrade a *specific part* of the result (recorded in `unavailable_reasons`)
rather than failing the whole valuation — multiples-over-time, for
instance, has no dependency on the DCF succeeding.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.domain.instrument_types import FUND_ANALYSIS_TYPES
from app.domain.period_dates import extract_year
from app.domain.regime_adjustments import get_regime_adjustments
from app.domain.valuation_assumptions import get_valuation_assumptions
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.providers.base import MarketDataProvider, RiskFreeRateProvider
from app.services.holding_facts import facts_by_period, previous_period
from app.services.market_data.beta import get_or_refresh_beta
from app.services.market_data.fx import get_or_refresh_fx
from app.services.market_data.price import get_or_refresh_price
from app.services.market_data.risk_free_rate import get_or_refresh_risk_free_rate
from app.services.market_data.shares import resolve_share_count
from app.services.metrics import (
    certificate_holder_share,
    compute_holding_metrics,
    ordinary_equity,
    owner_earnings_from_facts,
)
from app.services.risk.regime import classify_regime
from app.services.upstream_detection import holding_is_upstream
from app.services.valuation.dcf import (
    DCFScenarioResult,
    dcf_scenarios,
    reverse_dcf_implied_growth,
)
from app.services.valuation.discount_rate import cost_of_equity
from app.services.valuation.financials import FinancialsValuation, financials_valuation
from app.services.valuation.fund_look_through import (
    STALE_AFTER_DAYS,
    FundLookThroughValuation,
    LookThroughUnavailable,
    compute_look_through,
    load_constituents,
)
from app.services.valuation.growth import (
    historical_cagr,
    normalised_base,
    profitable_run_cagr,
)
from app.services.valuation.multiples import PeriodMultiples, multiples_over_time

OWNER_EARNINGS_DCF = "owner_earnings_dcf"
FINANCIALS_PRICE_TO_BOOK = "financials_price_to_book"
FUND_LOOK_THROUGH_PE = "fund_look_through_pe"

# valuation_status values
STATUS_OK = "ok"  # a headline valuation is available and passed the plausibility check
STATUS_IMPLAUSIBLE = "implausible"  # computed, then withheld: see valuation_status_reason
STATUS_UNAVAILABLE = "unavailable"  # missing data — see unavailable_reasons


@dataclass
class HoldingValuationResult:
    holding_id: uuid.UUID
    ticker: str
    valuation_currency: str | None = None
    as_of: datetime | None = None
    base_growth_rate: Decimal | None = None
    discount_rate: Decimal | None = None
    # The plain CAPM rate, before any regime widening below — always set
    # alongside discount_rate once the risk-free rate/beta/ERP are known,
    # even when regime_adjusted_dcf_enabled is False (in which case the
    # two are equal) — Sprint 14, 2026-09-26.
    base_discount_rate: Decimal | None = None
    # Set only when settings.regime_adjusted_dcf_enabled is True (Sprint 14).
    regime: str | None = None
    regime_discount_rate_addon: Decimal | None = None
    regime_adjustments_version: str | None = None
    risk_free_rate_pct: Decimal | None = None
    beta: Decimal | None = None
    equity_risk_premium: Decimal | None = None
    current_price_per_share: Decimal | None = None
    dcf: DCFScenarioResult | None = None
    reverse_dcf_implied_growth: Decimal | None = None
    multiples: list[PeriodMultiples] = field(default_factory=list)
    shares_outstanding: Decimal | None = None
    # "2,496.4m shares (Yahoo Finance, 2026-09-25)"
    shares_source: str | None = None
    assumptions_version: str = ""
    unavailable_reasons: list[str] = field(default_factory=list)

    # --- v2 guardrails (2026-09-29) -----------------------------------
    # Which model produced the headline value: the owner-earnings DCF, or
    # (banks/insurers) justified price-to-book.
    valuation_method: str = OWNER_EARNINGS_DCF
    valuation_status: str = STATUS_UNAVAILABLE
    # Plain-language why, for "implausible" (and the reason a DCF was
    # skipped for a financial). None when the status needs no explanation.
    valuation_status_reason: str | None = None
    # The historical CAGR before the growth cap, and whether it was capped.
    raw_base_growth_rate: Decimal | None = None
    growth_capped: bool = False
    # CAPM before the cost-of-equity floor.
    capm_cost_of_equity: Decimal | None = None
    financials: FinancialsValuation | None = None
    # What the model produced when it was withheld as implausible — kept so
    # the UI can show it as "rejected", never as a valuation.
    rejected_dcf: DCFScenarioResult | None = None
    rejected_financials: FinancialsValuation | None = None
    # Funds/ETFs (2026-09-29): the look-through earnings-yield screen.
    fund_look_through: FundLookThroughValuation | None = None
    rejected_fund_look_through: FundLookThroughValuation | None = None

    def headline_values(self) -> dict[str, Decimal] | None:
        """bear/base/bull value per share from whichever method applies, or
        None when there is no trustworthy headline valuation. Every
        consumer that shows a margin of safety, a zone, a price target or
        evidence reads this, so the plausibility guard cannot be bypassed."""
        if self.dcf is not None:
            return {s.label: s.intrinsic_value_per_share for s in self.dcf.scenarios}
        if self.financials is not None:
            return {s.label: s.value_per_share for s in self.financials.scenarios}
        if self.fund_look_through is not None:
            return {s.label: s.value_per_unit for s in self.fund_look_through.scenarios}
        return None

    def headline_margin_of_safety(self, label: str) -> Decimal | None:
        if self.dcf is not None:
            return self.dcf.margin_of_safety(label)
        if self.financials is not None:
            return self.financials.margin_of_safety(label)
        if self.fund_look_through is not None:
            return self.fund_look_through.margin_of_safety(label)
        return None


def _owner_earnings_history(
    db: Session, holding: Holding, *, cash_basis: bool = False
) -> list[tuple[int, str, Decimal]]:
    """(year, period, owner_earnings) triples, oldest first, for every
    period with a complete owner-earnings input set and a parseable year.
    """
    line_items = list(
        db.scalars(select(FinancialLineItem).where(FinancialLineItem.holding_id == holding.id))
    )
    by_period: dict[str, dict[str, Decimal]] = {}
    currency_by_period: dict[str, str | None] = {}
    for item in line_items:
        by_period.setdefault(item.period, {})[item.metric] = item.value
        currency_by_period[item.period] = item.currency

    history: list[tuple[int, str, Decimal]] = []
    for period, facts in by_period.items():
        year = extract_year(period)
        if year is None:
            continue
        # Same owner's-view definition as GET /holdings/{id}/metrics and the
        # evidence packet (decommissioning and lease payments deducted when
        # extracted) — app/services/metrics.py owns it.
        owner = owner_earnings_from_facts(facts, cash_basis=True) if cash_basis else None
        if owner is None:
            owner = owner_earnings_from_facts(facts)
        if owner is None:
            continue
        history.append((year, period, owner[0]))
    history.sort(key=lambda row: row[0])
    return history


def _latest_financial_period(db: Session, holding: Holding) -> str | None:
    """The most recent period with ANY financial line item on file,
    regardless of whether it has a complete owner-earnings input set —
    used only to resolve a currency to fetch/convert the live price into
    when there isn't (yet) enough data to run a DCF. None when the holding
    has no financial line items at all."""
    periods = set(db.scalars(select(FinancialLineItem.period).where(FinancialLineItem.holding_id == holding.id)))
    parseable = sorted((year, period) for period in periods if (year := extract_year(period)) is not None)
    return parseable[-1][1] if parseable else None


def _valuation_currency(db: Session, holding: Holding, latest_period: str) -> str:
    stmt = select(FinancialLineItem.currency).where(
        FinancialLineItem.holding_id == holding.id, FinancialLineItem.period == latest_period
    )
    currency = db.scalar(stmt.where(FinancialLineItem.currency.isnot(None)))
    return currency or holding.trading_currency


def _period_facts(db: Session, holding: Holding, period: str) -> dict[str, Decimal]:
    stmt = select(FinancialLineItem).where(
        FinancialLineItem.holding_id == holding.id, FinancialLineItem.period == period
    )
    return {item.metric: item.value for item in db.scalars(stmt)}


def _fx_fallback(db: Session, provider: MarketDataProvider, force: bool):
    def rate(from_currency: str, to_currency: str) -> Decimal | None:
        snapshot = get_or_refresh_fx(
            db,
            provider,
            from_currency=from_currency,
            to_currency=to_currency,
            force=force,
            refresh_live=force,
        )
        return snapshot.value.rate if snapshot.available and snapshot.value is not None else None

    return rate


def _is_financial(holding: Holding, assumptions) -> bool:
    sector = (holding.sector or "").lower()
    return bool(sector) and any(keyword in sector for keyword in assumptions.financials_sector_keywords)


def _resolve_cost_of_equity(
    db: Session,
    holding: Holding,
    market_data_provider: MarketDataProvider,
    risk_free_rate_provider: RiskFreeRateProvider,
    result: HoldingValuationResult,
    assumptions,
    valuation_currency: str,
    *,
    what: str,
    force_refresh: bool,
) -> Decimal | None:
    """Risk-free rate -> beta -> CAPM -> floor -> optional regime add-on,
    recorded on `result`. Shared by the DCF and the bank P/B valuation
    (both discount at the cost of equity). None when no risk-free rate."""
    settings = get_settings()
    rate_snapshot = get_or_refresh_risk_free_rate(
        db, risk_free_rate_provider, currency=valuation_currency, force=force_refresh, refresh_live=force_refresh
    )
    if not rate_snapshot.available or rate_snapshot.value is None:
        result.unavailable_reasons.append(
            f"{what} unavailable: no risk-free rate for {valuation_currency}: {rate_snapshot.reason}"
        )
        return None
    result.risk_free_rate_pct = rate_snapshot.value.rate

    # Sprint 20: stored beta (app/services/market_data/beta.py). A plain GET
    # serves the stored value; only Refresh / the worker call Yahoo.
    beta = get_or_refresh_beta(
        db, market_data_provider, holding.ticker, force=force_refresh, refresh_live=force_refresh
    ).value
    if beta is None:
        beta = assumptions.default_beta
        result.unavailable_reasons.append(
            f"beta unavailable from {market_data_provider.name}, used default beta "
            f"{assumptions.default_beta} from assumptions {assumptions.version}"
        )
    result.beta = beta

    equity_risk_premium = assumptions.equity_risk_premium.get(
        valuation_currency, assumptions.default_equity_risk_premium
    )
    result.equity_risk_premium = equity_risk_premium

    capm = cost_of_equity(
        risk_free_rate_pct=rate_snapshot.value.rate, beta=beta, equity_risk_premium=equity_risk_premium
    )
    result.capm_cost_of_equity = capm
    floor = assumptions.min_cost_of_equity
    if floor is not None and capm < floor:
        result.unavailable_reasons.append(
            f"Cost of equity floored at {floor * 100:.1f}% (CAPM gave {capm * 100:.1f}% from beta {beta}: "
            f"a low beta understates equity risk; assumptions {assumptions.version})."
        )
        capm = floor
    result.discount_rate = capm
    result.base_discount_rate = capm

    # Sprint 14 (2026-09-26): optional regime widening of the discount rate.
    # Off by default (see Settings.regime_adjusted_dcf_enabled's docstring) —
    # classify_regime(db) is a cheap DB-only read (app/services/macro/indicators.py,
    # no external call), so calling it per holding here (and per row on the
    # margin-of-safety board) doesn't add meaningful latency.
    if settings.regime_adjusted_dcf_enabled:
        regime_result = classify_regime(db)
        adjustments = get_regime_adjustments(settings.active_regime_adjustment_version)
        addon = adjustments.discount_rate_addon.get(regime_result.regime, adjustments.default_addon)
        result.regime = regime_result.regime
        result.regime_discount_rate_addon = addon
        result.regime_adjustments_version = adjustments.version
        result.discount_rate = result.base_discount_rate + addon
        if addon != 0:
            result.unavailable_reasons.append(
                f"Discount rate widened {addon * 100:.2f}pp for the current {regime_result.regime} "
                f"macro regime (regime adjustments {adjustments.version}, base CAPM rate "
                f"{result.base_discount_rate * 100:.2f}%)."
            )
    return result.discount_rate


def _implausible_reason(value: Decimal, price: Decimal, max_ratio: Decimal, what: str) -> str | None:
    """Text when `value` is more than `max_ratio` times, or less than
    1/`max_ratio` of, `price` — else None."""
    if price <= 0 or value <= 0:
        return None if value > 0 else f"{what} is not positive"
    ratio = value / price
    if ratio > max_ratio:
        return f"{what} of {value:,.2f} is {ratio:.1f}x the share price of {price:,.2f}"
    if ratio < Decimal(1) / max_ratio:
        return f"{what} of {value:,.2f} is only {ratio * 100:.0f}% of the share price of {price:,.2f}"
    return None


def _withhold(result: HoldingValuationResult, what: str, reason: str) -> None:
    result.valuation_status = STATUS_IMPLAUSIBLE
    result.valuation_status_reason = (
        f"{reason} — far outside what a sound model gives, so it is withheld rather than shown "
        f"as a valuation. Check the inputs (growth history, share count, currency)."
    )
    result.unavailable_reasons.append(f"{what} unavailable: {reason} (withheld as not credible)")


def _value_financials(
    db: Session,
    holding: Holding,
    market_data_provider: MarketDataProvider,
    risk_free_rate_provider: RiskFreeRateProvider,
    result: HoldingValuationResult,
    assumptions,
    *,
    force_refresh: bool,
) -> None:
    """Banks and insurers: justified price-to-book instead of the
    owner-earnings DCF (app/services/valuation/financials.py)."""
    what = "Price-to-book valuation"
    result.valuation_method = FINANCIALS_PRICE_TO_BOOK
    result.valuation_status_reason = (
        "An owner-earnings DCF does not apply to banks and insurers — they must retain capital, so "
        "profit is not distributable. Valued on justified price-to-book (ROE vs cost of equity)."
    )
    periods = facts_by_period(db, holding.id)
    latest_year = max((p.year for p in periods.values() if p.year is not None), default=None)
    latest = next(
        (
            p for p in sorted(periods.values(), key=lambda p: p.period)
            if p.year == latest_year and p.period.upper().startswith("FY")
        ),
        None,
    ) or next((p for p in periods.values() if p.year == latest_year), None)
    if latest is None:
        result.unavailable_reasons.append(f"{what} unavailable: no financial history on file")
        return

    valuation_currency = result.valuation_currency or holding.trading_currency
    share_count = resolve_share_count(
        db, holding, market_data_provider, latest_facts=latest.facts, latest_period=latest.period,
        force=force_refresh, refresh_live=force_refresh,
    )
    shares = share_count.shares
    if shares is None or shares <= 0:
        result.unavailable_reasons.append(f"{what} unavailable: no share count ({share_count.unavailable_reason})")
        return
    result.shares_outstanding = shares
    result.shares_source = share_count.describe()
    result.unavailable_reasons.extend(share_count.warnings)

    equity = ordinary_equity(latest.facts)
    if equity is None or equity <= 0:
        result.unavailable_reasons.append(f"{what} unavailable: no positive ordinary equity in {latest.period}")
        return
    book_value_per_share = equity / shares
    certificate_share = certificate_holder_share(latest.facts, shares)
    if certificate_share is not None:
        # An equity-certificate savings bank: the certificates are only part of
        # the bank's equity (the rest is the savings-bank reserve). Total equity
        # over the certificate count would overstate book value per certificate.
        book_value_per_share = equity * certificate_share / shares
        result.unavailable_reasons[:] = [
            w for w in result.unavailable_reasons if w not in share_count.warnings
        ]
        result.unavailable_reasons.append(
            f"Equity-certificate bank: certificate holders own about {certificate_share * 100:.1f}% of the "
            "profit and equity (EPS × certificates ÷ net income), so book value per certificate is that "
            "share of equity, not total equity ÷ certificates."
        )

    ke = _resolve_cost_of_equity(
        db, holding, market_data_provider, risk_free_rate_provider, result, assumptions,
        valuation_currency, what=what, force_refresh=force_refresh,
    )
    if ke is None:
        return

    roes: list[Decimal] = []
    dated = [(p.year, p) for p in periods.values() if p.year is not None]
    seen_years: set[int] = set()
    for year, entry in sorted(dated, key=lambda row: row[0], reverse=True):
        if year in seen_years or len(roes) >= assumptions.financials_roe_history_years:
            continue
        seen_years.add(year)
        prior = previous_period(periods, entry.period)
        roe = compute_holding_metrics(
            entry.facts, prior_facts=prior.facts if prior else None, financial=True
        ).computed.get("roe")
        if roe is not None:
            roes.append(roe)

    try:
        valuation = financials_valuation(
            roes=roes,
            book_value_per_share=book_value_per_share,
            cost_of_equity=ke,
            growth_rate=assumptions.terminal_growth_rate,
            max_roe=assumptions.financials_max_roe,
            roe_spread=assumptions.financials_roe_spread,
            current_price_per_share=result.current_price_per_share,
        )
    except ValueError as exc:
        result.unavailable_reasons.append(f"{what} unavailable: {exc}")
        return

    if valuation.roe_was_capped:
        result.unavailable_reasons.append(
            f"Average ROE capped at {assumptions.financials_max_roe * 100:.0f}% (not assumed sustainable)."
        )
    price = result.current_price_per_share
    if price is not None and assumptions.plausibility_max_ratio is not None:
        base_value = valuation.scenario("base").value_per_share
        reason = _implausible_reason(base_value, price, assumptions.plausibility_max_ratio, "Base value")
        if reason:
            result.rejected_financials = valuation
            _withhold(result, what, reason)
            return
    result.financials = valuation
    result.valuation_status = STATUS_OK



def _value_fund_look_through(
    db: Session,
    holding: Holding,
    market_data_provider: MarketDataProvider,
    risk_free_rate_provider: RiskFreeRateProvider,
    result: HoldingValuationResult,
    assumptions,
    *,
    force_refresh: bool,
) -> None:
    """Funds/ETFs: the look-through earnings-yield screen
    (app/services/valuation/fund_look_through.py) instead of a DCF — a fund
    has no statements, but the businesses it holds have P/Es. Reads stored
    constituent P/Es only (POST /funds/{id}/look-through/refresh fetches
    them), so a page load never makes one provider call per constituent."""
    what = "Look-through valuation"
    result.valuation_method = FUND_LOOK_THROUGH_PE
    constituents, oldest, unrefreshed = load_constituents(db, holding)
    if not constituents:
        result.unavailable_reasons.append(
            f"{what} unavailable: no holdings imported for this fund (fetch or upload its holdings first)"
        )
        return
    if unrefreshed == len(constituents):
        result.unavailable_reasons.append(
            f"{what} unavailable: constituent P/Es not fetched yet — run Refresh look-through on the fund page"
        )
        return
    price = result.current_price_per_share
    if price is None:
        result.unavailable_reasons.append(f"{what} unavailable: no current price for {holding.ticker}")
        return
    ke = _resolve_cost_of_equity(
        db, holding, market_data_provider, risk_free_rate_provider, result, assumptions,
        result.valuation_currency or holding.trading_currency, what=what, force_refresh=force_refresh,
    )
    if ke is None:
        return
    try:
        look = compute_look_through(
            constituents=constituents,
            cost_of_equity=ke,
            terminal_growth=assumptions.terminal_growth_rate,
            bull_offset=assumptions.bull_growth_offset,
            bear_offset=assumptions.bear_growth_offset,
            current_price=price,
        )
    except LookThroughUnavailable as exc:
        result.unavailable_reasons.append(f"{what} unavailable: {exc}")
        return
    look.oldest_observation = oldest
    if unrefreshed:
        look.notes.append(f"{unrefreshed} holding(s) have no stored P/E yet (counted as uncovered).")
    if oldest is not None:
        from datetime import timezone as _tz

        age_days = (datetime.now(_tz.utc) - oldest).days
        if age_days > STALE_AFTER_DAYS:
            look.notes.append(f"Constituent P/Es are {age_days} days old — run Refresh look-through.")
    if assumptions.plausibility_max_ratio is not None:
        reason = _implausible_reason(
            look.scenario("base").value_per_unit, price, assumptions.plausibility_max_ratio, "Base value"
        )
        if reason is not None:
            result.rejected_fund_look_through = look
            _withhold(result, what, reason)
            return
    result.fund_look_through = look
    result.valuation_status = STATUS_OK


def compute_holding_valuation(
    db: Session,
    holding: Holding,
    market_data_provider: MarketDataProvider,
    risk_free_rate_provider: RiskFreeRateProvider,
    *,
    force_refresh: bool = False,
) -> HoldingValuationResult:
    settings = get_settings()
    assumptions = get_valuation_assumptions(settings.active_valuation_assumptions_version)
    result = HoldingValuationResult(
        holding_id=holding.id, ticker=holding.ticker, assumptions_version=assumptions.version
    )

    is_fund = holding.asset_class_raw in FUND_ANALYSIS_TYPES
    if not is_fund:
        result.multiples = multiples_over_time(
            db, holding, fx_fallback=_fx_fallback(db, market_data_provider, force_refresh)
        )

    # Resolve a currency and fetch/convert today's price *before* any of the
    # DCF-specific early returns below (2026-09-26 fix: a holding with too
    # little data for a DCF used to skip the price fetch entirely, so the
    # margin-of-safety board and watchlist showed "no price" for a company
    # that in fact has a perfectly good quote — they just can't be valued
    # yet). `_latest_financial_period` falls back to any period on file
    # (not just one with a complete owner-earnings input set), and to the
    # holding's trading currency when there's no financial data at all.
    latest_any_period = _latest_financial_period(db, holding)
    valuation_currency = (
        _valuation_currency(db, holding, latest_any_period) if latest_any_period else holding.trading_currency
    )
    result.valuation_currency = valuation_currency
    result.current_price_per_share = _current_price_in_valuation_currency(
        db, holding, valuation_currency, market_data_provider, result, force_refresh=force_refresh
    )

    # Funds/ETFs: no statements to run a DCF on — value the basket they hold.
    if is_fund:
        _value_fund_look_through(
            db, holding, market_data_provider, risk_free_rate_provider, result, assumptions,
            force_refresh=force_refresh,
        )
        return result

    # Banks/insurers (v2): an owner-earnings DCF is the wrong model — value
    # them on justified price-to-book and stop here.
    if _is_financial(holding, assumptions):
        _value_financials(
            db, holding, market_data_provider, risk_free_rate_provider, result, assumptions,
            force_refresh=force_refresh,
        )
        return result

    cash_basis = assumptions.upstream_owner_earnings_basis == "cash" and holding_is_upstream(db, holding)
    history = _owner_earnings_history(db, holding, cash_basis=cash_basis)
    if cash_basis:
        result.unavailable_reasons.append(
            "Upstream oil and gas: owner earnings are built from operating cash flow - capex - "
            "decommissioning, lease and financing-interest payments, not net income + D&A - capex, "
            "because most of the tax expense is deferred and not paid in cash "
            f"(assumptions {assumptions.version})."
        )
    if len(history) < 2:
        result.unavailable_reasons.append(
            "DCF unavailable: fewer than two periods with complete owner-earnings inputs "
            "(net_income, depreciation_and_amortization, capital_expenditures)"
        )
        return result

    _latest_year, latest_period, base_owner_earnings = history[-1]
    normalised = None
    if assumptions.base_earnings_method == "normalised_median":
        normalised = normalised_base(
            [(row[0], row[2]) for row in history],
            window_years=assumptions.normalisation_window_years,
            min_years=assumptions.normalisation_min_years,
            dispersion=assumptions.normalisation_dispersion,
        )
    if normalised is not None and normalised.volatile:
        # Uneven earnings (a cycle, a windfall, a disposal gain): start from the
        # median and do not extrapolate an endpoint-to-endpoint trend.
        if normalised.base <= 0:
            result.unavailable_reasons.append(
                f"DCF unavailable: owner earnings are volatile and their {len(normalised.years)}-year "
                f"median is not positive (FY{normalised.years[0]}-FY{normalised.years[-1]}), so there is "
                "no normal level to value"
            )
            return result
        base_owner_earnings = normalised.base
        raw_growth_rate = assumptions.terminal_growth_rate
        result.unavailable_reasons.append(
            f"Owner earnings are uneven across FY{normalised.years[0]}-FY{normalised.years[-1]}, so the DCF "
            f"starts from their median ({normalised.base:,.0f}), not the latest year "
            f"({normalised.latest:,.0f}), and grows it at the {raw_growth_rate * 100:.1f}% terminal rate "
            "with no extrapolated trend (assumptions " + assumptions.version + ")."
        )
    else:
        try:
            if assumptions.growth_base_method == "profitable_run":
                run = profitable_run_cagr([(row[0], row[2]) for row in history])
                raw_growth_rate = run.rate
                if run.skipped_years:
                    skipped = ", ".join(f"FY{y}" for y in run.skipped_years)
                    result.unavailable_reasons.append(
                        f"Growth measured over FY{run.start_year}-FY{run.end_year}, the latest run of "
                        f"profitable years; earlier loss-making years ({skipped}) are left out of the base."
                    )
            else:
                raw_growth_rate = historical_cagr([row[2] for row in history])
        except ValueError as exc:
            result.unavailable_reasons.append(f"DCF unavailable: {exc}")
            return result
    base_growth_rate = raw_growth_rate
    cap = assumptions.max_base_growth
    if cap is not None and raw_growth_rate > cap:
        base_growth_rate = cap
        result.growth_capped = True
        result.unavailable_reasons.append(
            f"Historical growth of {raw_growth_rate * 100:.1f}%/yr capped at {cap * 100:.1f}% — a past "
            f"rate (often a merger or recovery from a low base) is not a forecast"
            + (
                f"; growth fades to {assumptions.terminal_growth_rate * 100:.1f}% by year "
                f"{assumptions.projection_years}."
                if assumptions.fade_growth_to_terminal
                else "."
            )
        )
    result.raw_base_growth_rate = raw_growth_rate
    result.base_growth_rate = base_growth_rate

    # The owner-earnings history's own latest period can differ from the
    # "any period" one above (e.g. the newest filing lacks a complete
    # owner-earnings input set yet) — recompute and only refetch the price
    # if the currency actually changes, so the normal (DCF-succeeds) case
    # still does exactly one price fetch, as before this fix.
    owner_earnings_currency = _valuation_currency(db, holding, latest_period)
    if owner_earnings_currency != valuation_currency:
        valuation_currency = owner_earnings_currency
        result.valuation_currency = valuation_currency
        result.current_price_per_share = _current_price_in_valuation_currency(
            db, holding, valuation_currency, market_data_provider, result, force_refresh=force_refresh
        )

    # Current share count (manual > SEC cover page > Yahoo > filing fact),
    # app/services/market_data/shares.py — the same count the metrics
    # panel's market cap uses.
    share_count = resolve_share_count(
        db,
        holding,
        market_data_provider,
        latest_facts=_period_facts(db, holding, latest_period),
        latest_period=latest_period,
        force=force_refresh,
        refresh_live=force_refresh,
    )
    shares_outstanding = share_count.shares
    if shares_outstanding is None or shares_outstanding <= 0:
        result.unavailable_reasons.append(
            f"DCF unavailable: no share count ({share_count.unavailable_reason})"
        )
        return result
    result.shares_outstanding = shares_outstanding
    result.shares_source = share_count.describe()
    result.unavailable_reasons.extend(share_count.warnings)

    discount_rate = _resolve_cost_of_equity(
        db, holding, market_data_provider, risk_free_rate_provider, result, assumptions,
        valuation_currency, what="DCF", force_refresh=force_refresh,
    )
    if discount_rate is None:
        return result

    # Already fetched above (in `valuation_currency`, refetched only if the
    # owner-earnings period's currency differs from the "any period" one).
    current_price_per_share = result.current_price_per_share
    fade = assumptions.fade_growth_to_terminal

    try:
        dcf = dcf_scenarios(
            base_owner_earnings=base_owner_earnings,
            base_growth_rate=base_growth_rate,
            discount_rate=discount_rate,
            terminal_growth_rate=assumptions.terminal_growth_rate,
            years=assumptions.projection_years,
            shares_outstanding=shares_outstanding,
            bull_growth_offset=assumptions.bull_growth_offset,
            bear_growth_offset=assumptions.bear_growth_offset,
            current_price_per_share=current_price_per_share,
            fade_to_terminal=fade,
        )
    except ValueError as exc:
        result.unavailable_reasons.append(f"DCF unavailable: {exc}")
        return result

    if current_price_per_share is not None:
        try:
            result.reverse_dcf_implied_growth = reverse_dcf_implied_growth(
                current_price_per_share=current_price_per_share,
                base_owner_earnings=base_owner_earnings,
                discount_rate=discount_rate,
                terminal_growth_rate=assumptions.terminal_growth_rate,
                years=assumptions.projection_years,
                shares_outstanding=shares_outstanding,
                fade_to_terminal=fade,
            )
        except ValueError as exc:
            result.unavailable_reasons.append(f"reverse DCF unavailable: {exc}")

    if current_price_per_share is not None and assumptions.plausibility_max_ratio is not None:
        reason = _implausible_reason(
            dcf.scenario("base").intrinsic_value_per_share,
            current_price_per_share,
            assumptions.plausibility_max_ratio,
            "DCF base value",
        )
        if reason:
            result.rejected_dcf = dcf
            _withhold(result, "DCF", reason)
            return result

    result.dcf = dcf
    result.valuation_status = STATUS_OK
    return result


def _current_price_in_valuation_currency(
    db: Session,
    holding: Holding,
    valuation_currency: str,
    market_data_provider: MarketDataProvider,
    result: HoldingValuationResult,
    *,
    force_refresh: bool,
) -> Decimal | None:
    price_snapshot = get_or_refresh_price(
        db, market_data_provider, holding=holding, force=force_refresh, refresh_live=force_refresh
    )
    if not price_snapshot.available or price_snapshot.value is None:
        result.unavailable_reasons.append(
            f"current price unavailable, margin of safety/reverse DCF skipped: {price_snapshot.reason}"
        )
        return None

    result.as_of = price_snapshot.as_of
    price = price_snapshot.value
    if price.currency == valuation_currency:
        return price.price

    fx_snapshot = get_or_refresh_fx(
        db,
        market_data_provider,
        from_currency=price.currency,
        to_currency=valuation_currency,
        force=force_refresh,
        refresh_live=force_refresh,
    )
    if not fx_snapshot.available or fx_snapshot.value is None:
        result.unavailable_reasons.append(
            f"price is in {price.currency} but no FX rate to {valuation_currency} available, "
            f"margin of safety/reverse DCF skipped: {fx_snapshot.reason}"
        )
        return None

    return price.price * fx_snapshot.value.rate
