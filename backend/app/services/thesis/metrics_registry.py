"""Sprint 11 — the tripwire metric registry: which financial/market/price
metrics a tripwire can watch, and how to compute today's value for one
from data already in the database.

Reuses app/services/metrics.py exactly for every fundamentals/market
figure (CLAUDE.md Rule 1: never reimplement ROIC/ROE/margins/multiples —
a tripwire must read exactly what the metrics panel shows), and
app/services/holding_facts.py for "the latest fiscal year" / "the prior
one", same as GET /holdings/{id}/metrics. `revenue_growth_yoy` isn't one
of metrics.py's ratios, so it's computed here directly from the same raw
facts — still deterministic application code, still never the LLM.

Market multiples and `share_price` use app/services/thesis/prices.py's
stored-data-only price/FX and app/services/market_data/shares.py's
`resolve_share_count` with no provider (which already falls back to the
manual/SEC-cover-page/filing count without a live Yahoo call) — see
prices.py's docstring for why.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.holding import Holding
from app.services import metrics as metrics_service
from app.services.analysis.latest import latest_runs_by_holding
from app.services.holding_facts import (
    PeriodFacts,
    facts_by_period,
    latest_period,
    previous_period,
)
from app.services.market_data.shares import resolve_share_count
from app.services.thesis.prices import (
    convert_price,
    latest_stored_price,
    stored_price_at_or_before,
)


@dataclass(frozen=True)
class MetricDef:
    key: str
    label: str
    group: str  # "fundamentals" | "market_multiples" | "price"
    unit: str  # "pct" | "x" | "money" | "price"


FUNDAMENTAL_METRICS: tuple[MetricDef, ...] = (
    MetricDef("roic", "ROIC", "fundamentals", "pct"),
    MetricDef("roce", "ROCE", "fundamentals", "pct"),
    MetricDef("roe", "ROE", "fundamentals", "pct"),
    MetricDef("gross_margin", "Gross margin", "fundamentals", "pct"),
    MetricDef("operating_margin", "Operating margin", "fundamentals", "pct"),
    MetricDef("net_margin", "Net margin", "fundamentals", "pct"),
    MetricDef("revenue_growth_yoy", "Revenue growth (y/y)", "fundamentals", "pct"),
    MetricDef("free_cash_flow", "Free cash flow", "fundamentals", "money"),
    MetricDef("owner_earnings", "Owner earnings", "fundamentals", "money"),
    MetricDef("net_debt", "Net debt", "fundamentals", "money"),
    MetricDef("net_debt_to_ebitda", "Net debt / EBITDA", "fundamentals", "x"),
    MetricDef("interest_coverage", "Interest coverage", "fundamentals", "x"),
    MetricDef("debt_to_equity", "Debt / equity", "fundamentals", "x"),
)
MARKET_METRICS: tuple[MetricDef, ...] = (
    MetricDef("price_to_earnings", "P/E", "market_multiples", "x"),
    MetricDef("price_to_book", "P/B", "market_multiples", "x"),
    MetricDef("ev_to_ebitda", "EV/EBITDA", "market_multiples", "x"),
    MetricDef("fcf_yield", "FCF yield", "market_multiples", "pct"),
)
PRICE_METRICS: tuple[MetricDef, ...] = (
    MetricDef("share_price", "Share price", "price", "price"),
    MetricDef("price_change_since_analysis", "Price change since analysis", "price", "pct"),
)

ALL_METRICS: tuple[MetricDef, ...] = FUNDAMENTAL_METRICS + MARKET_METRICS + PRICE_METRICS
METRICS_BY_KEY: dict[str, MetricDef] = {m.key: m for m in ALL_METRICS}


def metric_registry() -> list[MetricDef]:
    return list(ALL_METRICS)


@dataclass
class MetricValue:
    metric: str
    value: Decimal | None
    unavailable_reason: str | None = None
    as_of_period: str | None = None


def _market_inputs(
    db: Session, holding: Holding, latest: PeriodFacts | None
) -> tuple[metrics_service.MarketInputs | None, str | None]:
    price_row = latest_stored_price(db, holding.id)
    if price_row is None:
        return None, "no stored share price yet"
    reporting_currency = (latest.currency if latest else None) or price_row.currency
    if price_row.currency == reporting_currency:
        price = price_row.price
    else:
        price = convert_price(db, price_row, reporting_currency)
        if price is None:
            return None, f"price is in {price_row.currency}, no stored FX rate to {reporting_currency}"
    shares = resolve_share_count(
        db,
        holding,
        None,
        latest_facts=latest.facts if latest else None,
        latest_period=latest.period if latest else None,
    )
    if shares.shares is None:
        return None, f"no share count: {shares.unavailable_reason}"
    return metrics_service.MarketInputs(price=price, shares=shares.shares), None


def _fundamentals(
    db: Session, holding: Holding
) -> tuple[metrics_service.MetricsResult | None, PeriodFacts | None, PeriodFacts | None]:
    periods = facts_by_period(db, holding.id)
    latest = latest_period(periods)
    if latest is None:
        return None, None, None
    prior = previous_period(periods, latest.period)
    market_inputs, market_reason = _market_inputs(db, holding, latest)
    result = metrics_service.compute_holding_metrics(
        latest.facts,
        latest.currencies,
        prior_facts=prior.facts if prior else None,
        market=market_inputs,
        market_unavailable_reason=market_reason,
    )
    return result, latest, prior


def _revenue_growth_yoy(latest: PeriodFacts, prior: PeriodFacts | None) -> MetricValue:
    if prior is None or "revenue" not in latest.facts or "revenue" not in prior.facts:
        return MetricValue(
            "revenue_growth_yoy", None, "missing: revenue for this year or the prior year", latest.period
        )
    prior_revenue = prior.facts["revenue"]
    if prior_revenue <= 0:
        return MetricValue(
            "revenue_growth_yoy", None, "not meaningful: prior-year revenue is zero or negative", latest.period
        )
    growth = (latest.facts["revenue"] - prior_revenue) / prior_revenue
    return MetricValue("revenue_growth_yoy", growth, None, latest.period)


def _price_change_since_analysis(db: Session, holding: Holding) -> MetricValue:
    metric = "price_change_since_analysis"
    runs = latest_runs_by_holding(db, [holding.id])
    run = runs.get(holding.id)
    if run is None:
        return MetricValue(metric, None, "no analyzed run yet")
    analysis_price = stored_price_at_or_before(db, holding.id, run.started_at)
    if analysis_price is None:
        return MetricValue(metric, None, "no stored price on or before the analysis date")
    if analysis_price.price <= 0:
        return MetricValue(metric, None, "not meaningful: analysis-day price was zero or negative")
    current = latest_stored_price(db, holding.id)
    if current is None:
        return MetricValue(metric, None, "no stored share price yet")
    if current.currency == analysis_price.currency:
        current_price = current.price
    else:
        current_price = convert_price(db, current, analysis_price.currency)
        if current_price is None:
            return MetricValue(
                metric, None,
                f"currency mismatch ({analysis_price.currency} vs {current.currency}) "
                "and no stored FX rate",
            )
    change = (current_price - analysis_price.price) / analysis_price.price
    return MetricValue(metric, change)


def compute_metric_value(db: Session, holding: Holding, metric: str) -> MetricValue:
    """Today's value for one registry metric, or None with a reason it
    couldn't be computed. Every failure names the specific missing input
    (CLAUDE.md: fail visibly), never a bare None."""
    definition = METRICS_BY_KEY.get(metric)
    if definition is None:
        return MetricValue(metric, None, f"unknown metric '{metric}'")

    if metric == "share_price":
        price_row = latest_stored_price(db, holding.id)
        if price_row is None:
            return MetricValue(metric, None, "no stored share price yet")
        return MetricValue(metric, price_row.price)

    if metric == "price_change_since_analysis":
        return _price_change_since_analysis(db, holding)

    result, latest, prior = _fundamentals(db, holding)
    if result is None or latest is None:
        return MetricValue(metric, None, "no financial line items on file")

    if metric == "revenue_growth_yoy":
        return _revenue_growth_yoy(latest, prior)

    if metric in result.computed:
        return MetricValue(metric, result.computed[metric], None, latest.period)
    return MetricValue(metric, None, result.skipped.get(metric, "not available"), latest.period)
