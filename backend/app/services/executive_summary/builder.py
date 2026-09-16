"""
Executive summary (architecture §19) — a single portfolio-wide rollup of
what Composition, Portfolio risk, Factor profile, and the Macro dashboard
each already compute, plus a consolidated "needs attention" list, for
`GET /portfolio/snapshots/{id}/executive-summary`.

Entirely a read-time aggregation over data those sections already persisted:
the latest cached valuation (app.services.market_data.valuation, same source
Composition reads), the latest PortfolioRiskSnapshot matching this exact
account scope, the latest HoldingAnalysis per holding in scope, and the
latest macro snapshot (app.services.research.macro, same source the Macro
dashboard reads) — no new live provider call of its own, no new persisted
table, same "compute once elsewhere, read for free here" convention as
`build_cached_valuation` (§2.7).

Nothing here is LLM-produced. Every figure and every watch-item sentence is
deterministic application code, the same convention
app.services.portfolio_risk.builder's narrative already established
(docs/decisions/0008) — an executive summary is exactly the kind of "memo"
that convention already ruled out writing with an LLM.
"""

from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal
from typing import overload
from uuid import UUID

from sqlalchemy.orm import Session

from app.config.settings import Settings, get_settings
from app.domain import calculations as calc
from app.domain import portfolio_risk as risk
from app.domain.scoring import classify_macro_regime
from app.models.analysis import HoldingAnalysis
from app.models.portfolio import PortfolioSnapshot
from app.models.portfolio_risk import PortfolioRiskSnapshot
from app.schemas.executive_summary import (
    CollectionSliceOut,
    CompositionHeadlineOut,
    ExecutiveSummaryOut,
    FactorProfileHeadlineOut,
    HeadlineOut,
    MacroHeadlineOut,
    RiskDimensionOut,
    RiskHeadlineOut,
    WatchItemOut,
    WorstScenarioOut,
)
from app.services.market_data.valuation import PortfolioValuation, build_cached_valuation
from app.services.research.macro import MacroSnapshotView, get_latest_macro_snapshot

# How old something can get before it's worth calling out in watch_items.
# Deliberately generous — this is an attention-flag threshold, not a
# correctness bound (a stale price/snapshot is still shown; it just also
# gets a watch item).
_STALE_VALUATION_DAYS = 7
_STALE_RISK_SNAPSHOT_DAYS = 30
_STALE_MACRO_DAYS = 3
_LOW_COVERAGE_THRESHOLD_PCT = Decimal("50")

# Plain-language labels for the risk-dimension keys app.domain.portfolio_risk
# scores — same mapping RiskSection.tsx's DIMENSION_LABELS already uses on
# the frontend, duplicated here so a watch item reads in English rather than
# a raw dimension key (kept in sync by hand, same as that frontend copy).
_DIMENSION_LABELS: dict[str, str] = {
    "single_name_concentration": "Single-stock concentration",
    "sector_concentration": "Sector concentration",
    "currency_exposure": "Currency exposure",
    "commodity_exposure": "Commodity exposure",
    "correlation": "Holding correlation",
    "systemic_state_risk": "Bank deposit risk",
}

# Same tuple of (dimension_name, raw-value-lookup-path) app.services.
# portfolio_risk.builder.build_portfolio_risk_snapshot scores when it first
# builds a risk snapshot — recomputing dimension bands here from that
# snapshot's own persisted JSON (rather than re-deriving concentration/
# correlation/exposure from scratch) keeps this consistent with whichever
# risk_scoring_version actually produced the snapshot, including an older
# one from before a scoring-config change.
_DIMENSION_SOURCES: tuple[tuple[str, str, str], ...] = (
    ("single_name_concentration", "concentration", "single_name_hhi"),
    ("sector_concentration", "concentration", "sector_hhi"),
    ("currency_exposure", "exposure", "currency_exposure_pct"),
    ("commodity_exposure", "exposure", "commodity_exposure_pct"),
    ("correlation", "correlation", "average_pairwise_correlation"),
    ("systemic_state_risk", "systemic_state_risk", "deposits_over_guarantee_limit_pct"),
)


def _collection_for_asset_class(asset_class: str) -> str:
    """Same three-way split frontend/src/components/CollectionFilter.tsx's
    collectionForAssetClass applies — COMMODITY is the coin collection,
    COLLECTIBLE is the whisky collection, everything else is "Securities"."""
    if asset_class == "COMMODITY":
        return "Coin collection"
    if asset_class == "COLLECTIBLE":
        return "Whisky collection"
    return "Securities"


def _find_scoped_risk_snapshot(
    db: Session, portfolio_snapshot_id: UUID, account_ids: set[UUID] | None
) -> PortfolioRiskSnapshot | None:
    """The most recent PortfolioRiskSnapshot whose own account scope exactly
    matches `account_ids` — mirrors RiskSection.tsx's scopeMatches (None/no
    filter and an empty scope both normalize to the same "all accounts"
    target, so they match each other regardless of representation)."""
    target = sorted(str(a) for a in account_ids) if account_ids else None
    rows = (
        db.query(PortfolioRiskSnapshot)
        .filter(PortfolioRiskSnapshot.portfolio_snapshot_id == portfolio_snapshot_id)
        .order_by(PortfolioRiskSnapshot.created_at.desc())
        .all()
    )
    for row in rows:
        if (row.account_ids_json or None) == target:
            return row
    return None


def _decimal_or_none(value: object) -> Decimal | None:
    return Decimal(str(value)) if value is not None else None


@overload
def _to_utc(value: datetime) -> datetime: ...
@overload
def _to_utc(value: None) -> None: ...
def _to_utc(value: datetime | None) -> datetime | None:
    """SQLite loses tz-awareness on round-trip — same normalization
    app.services.research.common.is_stale already applies before comparing
    a persisted timestamp against `datetime.now(timezone.utc)`. Overloaded
    (matching app.domain.calculations.quantize's own precedent) so a call
    site passing a value already known to be non-None gets back a plain
    `datetime`, not `datetime | None`."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _risk_headline(row: PortfolioRiskSnapshot | None) -> RiskHeadlineOut:
    if row is None:
        return RiskHeadlineOut(
            available=False,
            risk_band=None,
            composite_risk_score=None,
            as_of=None,
            worst_dimensions=[],
            worst_scenario=None,
            wealth_tax_estimated_tax=None,
        )

    risk_config = risk.load_risk_scoring_config(row.risk_scoring_version)
    sections = {
        "concentration": row.concentration_json or {},
        "correlation": row.correlation_json or {},
        "exposure": row.exposure_json or {},
        "systemic_state_risk": row.systemic_state_risk_json or {},
    }

    dimension_scores: dict[str, risk.DimensionScore] = {}
    for dimension, section, key in _DIMENSION_SOURCES:
        raw_value = sections[section].get(key)
        score = risk.score_dimension(_decimal_or_none(raw_value), risk_config, dimension)
        if score is not None:
            dimension_scores[dimension] = score

    worst = sorted(dimension_scores.items(), key=lambda kv: kv[1].severity, reverse=True)[:3]
    worst_dimensions = [
        RiskDimensionOut(dimension=name, label=_DIMENSION_LABELS.get(name, name.replace("_", " ")), band=score.band)
        for name, score in worst
    ]

    worst_scenario: WorstScenarioOut | None = None
    impacts = [
        (impact.get("label", key), Decimal(str(impact["estimated_portfolio_impact_pct"])))
        for key, impact in (row.scenario_json or {}).items()
        if impact.get("estimated_portfolio_impact_pct") is not None
    ]
    if impacts:
        label, impact_pct = min(impacts, key=lambda pair: pair[1])
        worst_scenario = WorstScenarioOut(label=label, estimated_portfolio_impact_pct=impact_pct)

    wealth_tax = sections["systemic_state_risk"].get("wealth_tax_estimate")
    wealth_tax_estimated_tax = (
        Decimal(str(wealth_tax["estimated_tax"])) if wealth_tax and wealth_tax.get("estimated_tax") is not None else None
    )

    return RiskHeadlineOut(
        available=True,
        risk_band=row.risk_band,
        composite_risk_score=row.composite_risk_score,
        as_of=row.created_at,
        worst_dimensions=worst_dimensions,
        worst_scenario=worst_scenario,
        wealth_tax_estimated_tax=wealth_tax_estimated_tax,
    )


def _factor_profile_headline(db: Session, holding_ids: set[UUID]) -> FactorProfileHeadlineOut:
    if not holding_ids:
        return FactorProfileHeadlineOut(
            holdings_total=0,
            holdings_analyzed=0,
            coverage_pct=None,
            avg_business_quality=None,
            avg_financial_strength=None,
            avg_valuation=None,
            avg_overall_score=None,
        )

    # Newest first, so the first row kept per holding_id below is that
    # holding's latest analysis — same "most recent completed analysis"
    # convention FactorProfileSection.tsx uses on the frontend.
    analyses = (
        db.query(HoldingAnalysis)
        .filter(HoldingAnalysis.holding_id.in_(holding_ids))
        .order_by(HoldingAnalysis.created_at.desc())
        .all()
    )
    latest_by_holding: dict[UUID, HoldingAnalysis] = {}
    for ha in analyses:
        latest_by_holding.setdefault(ha.holding_id, ha)

    scores_by_factor: dict[str, list[int]] = defaultdict(list)
    overall_scores: list[Decimal] = []
    for ha in latest_by_holding.values():
        for fa in ha.factor_assessments:
            scores_by_factor[fa.factor].append(fa.score)
        if ha.overall_score is not None:
            overall_scores.append(ha.overall_score)

    def _avg(values: list) -> Decimal | None:
        if not values:
            return None
        total = sum((Decimal(v) for v in values), Decimal("0"))
        return calc.quantize(total / len(values), Decimal("0.01"))

    holdings_total = len(holding_ids)
    holdings_analyzed = len(latest_by_holding)
    coverage_pct = (
        calc.quantize(Decimal(holdings_analyzed) / Decimal(holdings_total) * Decimal("100"), calc.PERCENT_PLACES)
        if holdings_total
        else None
    )

    return FactorProfileHeadlineOut(
        holdings_total=holdings_total,
        holdings_analyzed=holdings_analyzed,
        coverage_pct=coverage_pct,
        avg_business_quality=_avg(scores_by_factor.get("business_quality", [])),
        avg_financial_strength=_avg(scores_by_factor.get("financial_strength", [])),
        avg_valuation=_avg(scores_by_factor.get("valuation", [])),
        avg_overall_score=_avg(overall_scores),
    )


def _composition_headline(valuation: PortfolioValuation) -> CompositionHeadlineOut:
    totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for asset_class, value in valuation.concentration.asset_class_values.items():
        totals[_collection_for_asset_class(asset_class)] += value

    total_value = valuation.total_market_value
    slices = []
    for key in ("Securities", "Coin collection", "Whisky collection"):
        value = totals.get(key, Decimal("0"))
        pct = calc.quantize(value / total_value * Decimal("100"), calc.PERCENT_PLACES) if total_value > 0 else Decimal("0")
        slices.append(CollectionSliceOut(collection=key, value_reporting_ccy=calc.quantize(value), pct_of_total=pct))

    currency_exposure_pct: Decimal | None = None
    if valuation.concentration.currency_weights:
        outside = sum(
            (w for ccy, w in valuation.concentration.currency_weights.items() if ccy.upper() != valuation.reporting_currency.upper()),
            Decimal("0"),
        )
        currency_exposure_pct = calc.quantize(outside, calc.PERCENT_PLACES)

    return CompositionHeadlineOut(by_collection=slices, currency_exposure_pct=currency_exposure_pct)


def _macro_headline(db: Session, settings: Settings) -> MacroHeadlineOut:
    macro: MacroSnapshotView = get_latest_macro_snapshot(db)
    if not macro.available:
        return MacroHeadlineOut(available=False, as_of=None, regime="baseline", reason=macro.reason)

    latest_values = {obs.series_key: obs.value for obs in macro.observations}
    regime = classify_macro_regime(latest_values, settings.active_scoring_version)
    return MacroHeadlineOut(available=True, as_of=macro.as_of, regime=regime, reason=None)


def _build_watch_items(
    *,
    valuation: PortfolioValuation,
    risk_row: PortfolioRiskSnapshot | None,
    factor_profile: FactorProfileHeadlineOut,
    macro: MacroHeadlineOut,
    now: datetime,
) -> list[WatchItemOut]:
    items: list[WatchItemOut] = []

    for warning in valuation.warnings:
        items.append(WatchItemOut(severity="warning", message=warning))

    if valuation.as_of is None:
        items.append(
            WatchItemOut(
                severity="info",
                message="This portfolio has never been priced — click Refresh valuation on Portfolio composition.",
            )
        )
    else:
        age_days = (now - _to_utc(valuation.as_of)).days
        if age_days >= _STALE_VALUATION_DAYS:
            items.append(WatchItemOut(severity="warning", message=f"Prices are {age_days} day(s) old — consider refreshing valuation."))

    if risk_row is None:
        items.append(WatchItemOut(severity="info", message="No risk snapshot computed yet for this account selection."))
    else:
        age_days = (now - _to_utc(risk_row.created_at)).days
        if age_days >= _STALE_RISK_SNAPSHOT_DAYS:
            items.append(
                WatchItemOut(severity="info", message=f"Risk snapshot is {age_days} day(s) old — recompute for the latest picture.")
            )
        if risk_row.risk_band in ("HIGH", "MODERATE-HIGH"):
            items.append(WatchItemOut(severity="warning", message=f"Overall risk band is {risk_row.risk_band}."))
        for warning in (risk_row.systemic_state_risk_json or {}).get("warnings", []):
            items.append(WatchItemOut(severity="warning", message=warning))

    if factor_profile.holdings_total > 0 and (factor_profile.coverage_pct or Decimal("0")) < _LOW_COVERAGE_THRESHOLD_PCT:
        items.append(
            WatchItemOut(
                severity="info",
                message=(
                    f"Only {factor_profile.holdings_analyzed} of {factor_profile.holdings_total} holdings have an "
                    f"AI analysis on record ({factor_profile.coverage_pct}%)."
                ),
            )
        )

    if not macro.available:
        items.append(WatchItemOut(severity="info", message="No macro research on record yet."))
    elif macro.as_of is not None:
        age_days = (now - _to_utc(macro.as_of)).days
        if age_days >= _STALE_MACRO_DAYS:
            items.append(WatchItemOut(severity="info", message=f"Macro data is {age_days} day(s) old — consider refreshing."))

    return items


def build_executive_summary(
    db: Session,
    snapshot: PortfolioSnapshot,
    account_ids: set[UUID] | None = None,
    settings: Settings | None = None,
) -> ExecutiveSummaryOut:
    """`account_ids=None` covers every position in the snapshot, same
    convention as build_cached_valuation/build_portfolio_risk_snapshot. Pure
    aggregation — never writes anything, never calls a live provider."""
    settings = settings or get_settings()
    now = datetime.now(timezone.utc)

    valuation = build_cached_valuation(db, snapshot, account_ids=account_ids)
    positions = snapshot.positions if account_ids is None else [p for p in snapshot.positions if p.account_id in account_ids]
    holding_ids = {p.holding_id for p in positions}

    risk_row = _find_scoped_risk_snapshot(db, snapshot.id, account_ids)
    factor_profile = _factor_profile_headline(db, holding_ids)
    macro = _macro_headline(db, settings)

    total_unrealized_pnl_pct: Decimal | None = None
    if valuation.total_unrealized_pnl is not None and valuation.total_cost_basis_value:
        total_unrealized_pnl_pct = calc.quantize(
            valuation.total_unrealized_pnl / valuation.total_cost_basis_value * Decimal("100"), calc.PERCENT_PLACES
        )

    headline = HeadlineOut(
        total_market_value=calc.quantize(valuation.total_market_value),
        reporting_currency=valuation.reporting_currency,
        total_unrealized_pnl=calc.quantize(valuation.total_unrealized_pnl),
        total_unrealized_pnl_pct=total_unrealized_pnl_pct,
        largest_single_name_pct=valuation.concentration.largest_single_name_pct,
        valuation_as_of=valuation.as_of,
    )

    return ExecutiveSummaryOut(
        snapshot_id=snapshot.id,
        generated_at=now,
        account_ids=sorted(str(a) for a in account_ids) if account_ids else None,
        headline=headline,
        risk=_risk_headline(risk_row),
        factor_profile=factor_profile,
        composition=_composition_headline(valuation),
        macro=macro,
        watch_items=_build_watch_items(
            valuation=valuation, risk_row=risk_row, factor_profile=factor_profile, macro=macro, now=now
        ),
    )
