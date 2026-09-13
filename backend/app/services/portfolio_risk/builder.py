"""
Portfolio risk snapshot orchestration (architecture §15, §15.1, §18, §26
Phase 5).

Reuses Phase 2's concentration calculation as-is (app.services.market_data.
valuation.refresh_and_value_snapshot) rather than recomputing it, then layers
on what Phase 5 adds: correlation (from historical prices), exposure
(currency/commodity, derived from the same concentration weights),
systemic/state risk (§15.1 — deposit concentration, custody structure,
Norwegian wealth-tax estimate, jurisdictional concentration), and scenario
impact (app.domain.scenarios) against every registered scenario. Each
dimension that can't be computed for lack of data is simply absent from
`dimension_scores` rather than defaulted to a fabricated "LOW" (§21) — see
app.domain.portfolio_risk.score_dimension.
"""

from collections import defaultdict
from dataclasses import asdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.config.settings import Settings, get_settings
from app.domain import calculations as calc
from app.domain import portfolio_risk as risk
from app.domain import scenarios as scenario_domain
from app.domain.asset_class import AssetClass
from app.models.market_data import FxObservation
from app.models.portfolio import PortfolioSnapshot
from app.models.portfolio_risk import PortfolioRiskSnapshot
from app.providers.base import MarketDataProvider, MarketDataUnavailableError
from app.services.market_data.valuation import PortfolioValuation, refresh_and_value_snapshot

_COMMODITY_SECTOR_KEYWORDS = (
    "gold", "silver", "commodity", "commodities", "energy", "oil", "gas",
    "mining", "metals", "materials", "precious metals",
)
_LISTED_SHARE_ASSET_CLASSES = {AssetClass.EQUITY.value, AssetClass.ETF.value, AssetClass.FUND.value}
_CORRELATION_WINDOW_DAYS = 90


def _json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    return value


def _dataclass_to_json(obj: Any) -> dict | None:
    if obj is None:
        return None
    return _json_safe(asdict(obj))


def _dataclass_list_to_json(objs: list) -> list:
    return [_json_safe(asdict(o)) for o in objs]


def _currency_exposure_pct(currency_weights_pct: dict[str, Decimal], reporting_currency: str) -> Decimal | None:
    if not currency_weights_pct:
        return None
    outside = sum(
        (w for ccy, w in currency_weights_pct.items() if ccy.upper() != reporting_currency.upper()),
        Decimal("0"),
    )
    return calc.quantize(outside, calc.PERCENT_PLACES)


def _commodity_exposure_pct(sector_weights_pct: dict[str, Decimal]) -> Decimal | None:
    if not sector_weights_pct:
        return None
    total = sum(
        (w for sector, w in sector_weights_pct.items() if any(kw in (sector or "").lower() for kw in _COMMODITY_SECTOR_KEYWORDS)),
        Decimal("0"),
    )
    return calc.quantize(total, calc.PERCENT_PLACES)


def _compute_cash_positions(
    db: Session, snapshot: PortfolioSnapshot, reporting_currency: str
) -> tuple[list[tuple[str | None, Decimal]], Decimal, list[str]]:
    """Cash/deposit positions valued from `quantity` directly (cash has no
    market price to fetch — quantity *is* the value in its trading
    currency), converted via the most recent FxObservation on record. A
    position that can't be converted (foreign-currency cash with no FX rate
    ever observed) is excluded with an explicit warning, not silently
    dropped (§21)."""
    warnings: list[str] = []
    positions_value: list[tuple[str | None, Decimal]] = []
    total = Decimal("0")

    for position in snapshot.positions:
        holding = position.holding
        if holding.asset_class != AssetClass.CASH.value:
            continue
        if position.quantity is None:
            warnings.append(f"{holding.ticker}: cash position has no quantity — excluded from deposit concentration")
            continue

        if holding.trading_currency.upper() == reporting_currency.upper():
            fx_rate = Decimal("1")
        else:
            fx_obs = (
                db.query(FxObservation)
                .filter(
                    FxObservation.from_currency == holding.trading_currency.upper(),
                    FxObservation.to_currency == reporting_currency.upper(),
                )
                .order_by(FxObservation.observed_at.desc())
                .first()
            )
            if fx_obs is None:
                warnings.append(
                    f"{holding.ticker}: no FX rate on record for {holding.trading_currency}->{reporting_currency} "
                    "— excluded from deposit concentration"
                )
                continue
            fx_rate = fx_obs.rate

        value = calc.quantize(position.quantity * fx_rate)
        positions_value.append((holding.institution, value))
        total += value

    return positions_value, total, warnings


def _custody_breakdown(snapshot: PortfolioSnapshot, valuation: PortfolioValuation, total_portfolio_value: Decimal) -> dict[str, Decimal]:
    """Weight of portfolio value by custody_type (§15.1) — only holdings
    where custody_type is set contribute; holdings without one are simply
    absent (their weight isn't invented), so the reported percentages can
    legitimately sum to less than 100 (§21)."""
    holdings_by_id = {position.holding_id: position.holding for position in snapshot.positions}
    values_by_custody: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for hv in valuation.holdings:
        holding = holdings_by_id.get(hv.holding_id)
        if holding is None or not holding.custody_type or hv.market_value_reporting_ccy is None:
            continue
        values_by_custody[holding.custody_type] += hv.market_value_reporting_ccy
    if not values_by_custody or total_portfolio_value <= 0:
        return {}
    return {
        k: calc.quantize(v, calc.PERCENT_PLACES)
        for k, v in calc.weights_by_group(dict(values_by_custody), total=total_portfolio_value).items()
    }


def _value_by_institution(
    snapshot: PortfolioSnapshot, valuation: PortfolioValuation, cash_positions: list[tuple[str | None, Decimal]]
) -> dict[str, Decimal]:
    """Institution is used as a proxy for custodian/jurisdiction (§15.1: no
    dedicated custodian-country field exists yet — see decision 0008)."""
    holdings_by_id = {position.holding_id: position.holding for position in snapshot.positions}
    values: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for hv in valuation.holdings:
        holding = holdings_by_id.get(hv.holding_id)
        if holding is None or hv.market_value_reporting_ccy is None:
            continue
        values[holding.institution or "Unknown institution"] += hv.market_value_reporting_ccy
    for institution, value in cash_positions:
        values[institution or "Unknown institution"] += value
    return dict(values)


def _collect_daily_prices(
    provider: MarketDataProvider, tickers_with_symbol: list[tuple[str, str]], window_days: int = _CORRELATION_WINDOW_DAYS
) -> tuple[dict[str, dict[date, Decimal]], list[str]]:
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=window_days)
    daily: dict[str, dict[date, Decimal]] = {}
    warnings: list[str] = []

    for ticker, market_ticker in tickers_with_symbol:
        try:
            observations = provider.get_historical_prices(market_ticker, start, end)
        except MarketDataUnavailableError as exc:
            warnings.append(f"{ticker}: historical prices unavailable for correlation — {exc}")
            continue
        if not observations:
            warnings.append(f"{ticker}: no historical price observations returned for correlation")
            continue
        by_date: dict[date, Decimal] = {}
        for obs in sorted(observations, key=lambda o: o.observed_at):
            by_date[obs.observed_at.date()] = obs.price
        daily[ticker] = by_date

    return daily, warnings


def _build_narrative(
    risk_band: str,
    dimension_scores: dict[str, risk.DimensionScore],
    wealth_tax: risk.WealthTaxEstimate | None,
    scenario_impacts: dict[str, scenario_domain.ScenarioImpact],
    warning_count: int,
) -> str:
    """A short, deterministic, code-generated summary — not an LLM memo. See
    docs/decisions/0008 for why a portfolio-risk LLM narrative was deferred
    this phase."""
    sentences = [f"Overall risk band: {risk_band}."]
    if dimension_scores:
        worst = sorted(dimension_scores.items(), key=lambda kv: kv[1].severity, reverse=True)[:3]
        contributors = ", ".join(f"{name.replace('_', ' ')} ({score.band})" for name, score in worst)
        sentences.append(f"Highest-severity dimensions: {contributors}.")
    if wealth_tax is not None:
        sentences.append(
            f"Estimated Norwegian formuesskatt: {wealth_tax.estimated_tax} NOK on a taxable base of "
            f"{wealth_tax.taxable_base} NOK."
        )
    impacts = [
        (impact.label, impact.estimated_portfolio_impact_pct)
        for impact in scenario_impacts.values()
        if impact.estimated_portfolio_impact_pct is not None
    ]
    if impacts:
        worst_scenario = min(impacts, key=lambda pair: pair[1])
        sentences.append(
            f"Most damaging modeled scenario: {worst_scenario[0]} "
            f"({worst_scenario[1]}% estimated portfolio impact)."
        )
    if warning_count:
        sentences.append(f"{warning_count} data-quality warning(s) — see concentration/correlation/exposure detail.")
    return " ".join(sentences)


def build_portfolio_risk_snapshot(
    db: Session,
    market_provider: MarketDataProvider,
    snapshot: PortfolioSnapshot,
    analysis_run_id: UUID | None = None,
    settings: Settings | None = None,
) -> PortfolioRiskSnapshot:
    settings = settings or get_settings()
    reporting_currency = snapshot.reporting_currency

    valuation = refresh_and_value_snapshot(db, market_provider, snapshot)
    concentration = valuation.concentration
    warnings: list[str] = list(valuation.warnings)

    tickers_with_symbol = [
        (hv.ticker, hv.market_ticker) for hv in valuation.holdings if hv.market_ticker is not None
    ]
    daily_prices, correlation_warnings = _collect_daily_prices(market_provider, tickers_with_symbol)
    warnings.extend(correlation_warnings)
    correlation_result = risk.build_correlation_matrix(daily_prices)

    currency_exposure_pct = _currency_exposure_pct(concentration.currency_weights, reporting_currency)
    commodity_exposure_pct = _commodity_exposure_pct(concentration.sector_weights)

    cash_positions, cash_total, cash_warnings = _compute_cash_positions(db, snapshot, reporting_currency)
    warnings.extend(cash_warnings)
    deposit_exposures, deposits_over_guarantee_pct = risk.compute_deposit_concentration(
        cash_positions, Decimal(str(settings.deposit_guarantee_limit_nok))
    )

    total_portfolio_value = valuation.total_market_value + cash_total
    custody_weights = _custody_breakdown(snapshot, valuation, total_portfolio_value)
    jurisdiction_weights_raw = calc.weights_by_group(_value_by_institution(snapshot, valuation, cash_positions))
    jurisdiction_weights = {k: calc.quantize(v, calc.PERCENT_PLACES) for k, v in jurisdiction_weights_raw.items()}
    jurisdictional_hhi = (
        calc.quantize(calc.herfindahl_hirschman_index(list(jurisdiction_weights.values())))
        if jurisdiction_weights
        else None
    )

    wealth_tax: risk.WealthTaxEstimate | None = None
    if reporting_currency.upper() == "NOK":
        listed_share_value = sum(
            (
                hv.market_value_reporting_ccy
                for hv in valuation.holdings
                if hv.asset_class in _LISTED_SHARE_ASSET_CLASSES and hv.market_value_reporting_ccy is not None
            ),
            Decimal("0"),
        )
        wealth_tax = risk.estimate_norwegian_wealth_tax(
            net_portfolio_value_nok=total_portfolio_value,
            listed_share_value_nok=listed_share_value,
            bunnfradrag_nok=Decimal(str(settings.wealth_tax_bunnfradrag_nok)),
            rate_pct=Decimal(str(settings.wealth_tax_rate_pct)),
            share_discount_pct=Decimal(str(settings.wealth_tax_share_discount_pct)),
        )
    else:
        warnings.append(
            "wealth-tax estimate skipped — only implemented for NOK-reporting portfolios "
            f"(this one reports in {reporting_currency})"
        )

    scenario_registry = scenario_domain.load_scenario_registry(settings.active_scenario_version)
    scenario_impacts = {
        key: scenario_domain.estimate_scenario_impact(
            definition,
            asset_class_weights_pct=concentration.asset_class_weights,
            sector_weights_pct=concentration.sector_weights,
            currency_weights_pct=concentration.currency_weights,
            reporting_currency=reporting_currency,
        )
        for key, definition in scenario_registry.scenarios.items()
    }

    risk_config = risk.load_risk_scoring_config(settings.active_risk_scoring_version)
    dimension_scores: dict[str, risk.DimensionScore] = {}
    for dimension, value in (
        ("single_name_concentration", concentration.single_name_hhi),
        ("sector_concentration", concentration.sector_hhi),
        ("currency_exposure", currency_exposure_pct),
        ("commodity_exposure", commodity_exposure_pct),
        ("correlation", correlation_result.average_pairwise_correlation),
        ("systemic_state_risk", deposits_over_guarantee_pct),
    ):
        score = risk.score_dimension(value, risk_config, dimension)
        if score is not None:
            dimension_scores[dimension] = score

    composite_score = risk.compute_composite_score(dimension_scores, risk_config)
    risk_band = (
        risk.worst_band([s.band for s in dimension_scores.values()]) if dimension_scores else "INSUFFICIENT DATA"
    )
    narrative = _build_narrative(risk_band, dimension_scores, wealth_tax, scenario_impacts, len(warnings))

    row = PortfolioRiskSnapshot(
        portfolio_snapshot_id=snapshot.id,
        analysis_run_id=analysis_run_id,
        concentration_json=_dataclass_to_json(concentration),
        correlation_json=_dataclass_to_json(correlation_result),
        exposure_json=_json_safe(
            {
                "currency_exposure_pct": currency_exposure_pct,
                "commodity_exposure_pct": commodity_exposure_pct,
                "currency_weights_pct": concentration.currency_weights,
                "asset_class_weights_pct": concentration.asset_class_weights,
            }
        ),
        scenario_json={key: _dataclass_to_json(impact) for key, impact in scenario_impacts.items()},
        systemic_state_risk_json=_json_safe(
            {
                "deposit_exposures": _dataclass_list_to_json(deposit_exposures),
                "deposits_over_guarantee_limit_pct": deposits_over_guarantee_pct,
                "custody_weights_pct": custody_weights,
                "jurisdictional_weights_pct": jurisdiction_weights,
                "jurisdictional_concentration_hhi": jurisdictional_hhi,
                "wealth_tax_estimate": _dataclass_to_json(wealth_tax),
                "warnings": warnings,
            }
        ),
        risk_band=risk_band,
        composite_risk_score=composite_score,
        narrative=narrative,
        risk_scoring_version=risk_config.version,
        scenario_version=scenario_registry.version,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
