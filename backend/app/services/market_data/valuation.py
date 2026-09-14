"""
Portfolio market-data refresh and valuation (architecture §26 Phase 2).

Orchestrates: fetch live price + FX for each holding in a snapshot via
MarketDataProvider, persist the observations for provenance (§5.2, §8.3),
then compute market value, unrealized P&L, and concentration/exposure using
only app.domain.calculations — no LLM involvement (§2.2).

A holding can fail to value for perfectly ordinary reasons (no
market_ticker set yet, ticker delisted, FX pair unavailable). Per §21
("fail visibly rather than silently invent") and the Phase 1 precedent for
document extraction failures, one holding failing does not fail the whole
refresh: it's marked unavailable with an explicit reason and excluded from
totals, and that exclusion is itself surfaced as a warning so a total is
never silently understated without saying so.

Portfolio-level valuation is computed on demand from persisted point-in-time
observations, not itself persisted as a new snapshot table this phase —
that's the analysis-run world of Phase 5 (§10, portfolio_risk_snapshots).
Historical valuations remain reconstructable later from MarketObservation/
FxObservation rows if needed.
"""

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.domain import calculations as calc
from app.models.market_data import FxObservation, MarketObservation
from app.models.portfolio import PortfolioSnapshot
from app.providers.base import FxRate, MarketDataProvider, MarketDataUnavailableError, PriceObservation

_UNCLASSIFIED_SECTOR = "Unclassified"


@dataclass
class HoldingValuation:
    holding_id: UUID
    ticker: str
    name: str
    asset_class: str
    sector: str | None
    trading_currency: str
    market_ticker: str | None
    quantity: Decimal | None
    uploaded_weight_pct: Decimal | None

    price: Decimal | None = None
    price_currency: str | None = None
    price_observed_at: datetime | None = None
    price_status: str = "unavailable"  # current | delayed | stale | unavailable

    market_value_trading_ccy: Decimal | None = None
    fx_rate_to_reporting: Decimal | None = None
    market_value_reporting_ccy: Decimal | None = None

    cost_basis_value_reporting_ccy: Decimal | None = None
    unrealized_pnl: Decimal | None = None
    unrealized_pnl_pct: Decimal | None = None

    computed_weight_pct: Decimal | None = None
    data_warning: str | None = None


@dataclass
class ConcentrationProfile:
    single_name_hhi: Decimal | None
    largest_single_name_pct: Decimal | None
    single_name_weights: dict[str, Decimal]
    sector_hhi: Decimal | None
    sector_weights: dict[str, Decimal]
    currency_weights: dict[str, Decimal]
    asset_class_weights: dict[str, Decimal]
    holdings_excluded_from_concentration: list[str]


@dataclass
class PortfolioValuation:
    snapshot_id: UUID
    reporting_currency: str
    total_market_value: Decimal
    total_cost_basis_value: Decimal | None
    total_unrealized_pnl: Decimal | None
    holdings: list[HoldingValuation]
    concentration: ConcentrationProfile
    warnings: list[str] = field(default_factory=list)
    # None = every position in the snapshot (every account, including
    # unassigned ones). A non-None set scopes this computation to just those
    # accounts' positions — the dashboard's account filter (§26 accounts
    # feature) — so it's echoed back here rather than only living on the
    # request, letting a caller confirm what a given valuation actually
    # covers.
    account_ids: frozenset[UUID] | None = None


class _FxCache:
    """Fetches/persists each (from, to) FX pair at most once per refresh —
    common when several holdings share a trading currency (§2.7: cache
    aggressively; this is the per-run version of that principle)."""

    def __init__(self, db: Session, provider: MarketDataProvider):
        self._db = db
        self._provider = provider
        self._cache: dict[tuple[str, str], FxRate] = {}

    def get(self, from_currency: str, to_currency: str) -> FxRate:
        key = (from_currency.upper(), to_currency.upper())
        if key in self._cache:
            return self._cache[key]

        rate = self._provider.get_fx_rate(*key)
        self._cache[key] = rate

        # Skip persisting the trivial same-currency case — it carries no
        # information and would otherwise add DB noise on every refresh.
        if key[0] != key[1]:
            self._db.add(
                FxObservation(
                    from_currency=rate.from_currency,
                    to_currency=rate.to_currency,
                    rate=rate.rate,
                    observed_at=rate.observed_at,
                    provider=rate.provider,
                )
            )
        return rate


def refresh_and_value_snapshot(
    db: Session,
    provider: MarketDataProvider,
    snapshot: PortfolioSnapshot,
    account_ids: set[UUID] | None = None,
) -> PortfolioValuation:
    """`account_ids=None` values every position in the snapshot, same as
    before this parameter existed. A non-None set restricts market value,
    P&L, and concentration/exposure to just the positions tagged with one of
    those accounts (§26 accounts feature) — a position with no account at
    all is excluded whenever a filter is given, matching how
    `GET /portfolio/holdings?account_id=` already treats "unassigned"."""
    reporting_currency = snapshot.reporting_currency
    fx_cache = _FxCache(db, provider)
    positions = (
        snapshot.positions
        if account_ids is None
        else [p for p in snapshot.positions if p.account_id in account_ids]
    )

    valuations: list[HoldingValuation] = []
    warnings: list[str] = []

    for position in positions:
        holding = position.holding
        hv = HoldingValuation(
            holding_id=holding.id,
            ticker=holding.ticker,
            name=holding.name,
            asset_class=holding.asset_class,
            sector=holding.sector,
            trading_currency=holding.trading_currency,
            market_ticker=holding.market_ticker,
            quantity=position.quantity,
            uploaded_weight_pct=position.weight_pct,
        )
        _value_one_holding(db, provider, fx_cache, hv, position, reporting_currency)
        valuations.append(hv)

    _apply_computed_weights(valuations)
    concentration = _build_concentration(valuations, warnings)

    total_market_value = sum(
        (hv.market_value_reporting_ccy for hv in valuations if hv.market_value_reporting_ccy is not None),
        Decimal("0"),
    )
    cost_values = [hv.cost_basis_value_reporting_ccy for hv in valuations if hv.cost_basis_value_reporting_ccy is not None]
    total_cost_basis_value = sum(cost_values, Decimal("0")) if cost_values else None
    total_unrealized_pnl = calc.unrealized_pnl(total_market_value, total_cost_basis_value)

    unvalued = [hv.ticker for hv in valuations if hv.market_value_reporting_ccy is None]
    if unvalued:
        warnings.append(
            f"{len(unvalued)} holding(s) excluded from totals/weights (no market value available): "
            + ", ".join(unvalued)
        )

    db.commit()

    return PortfolioValuation(
        snapshot_id=snapshot.id,
        reporting_currency=reporting_currency,
        total_market_value=total_market_value,
        total_cost_basis_value=total_cost_basis_value,
        total_unrealized_pnl=total_unrealized_pnl,
        holdings=valuations,
        concentration=concentration,
        warnings=warnings,
        account_ids=frozenset(account_ids) if account_ids is not None else None,
    )


def _value_one_holding(
    db: Session,
    provider: MarketDataProvider,
    fx_cache: _FxCache,
    hv: HoldingValuation,
    position,
    reporting_currency: str,
) -> None:
    if hv.market_ticker is None:
        hv.data_warning = (
            "no market_ticker set for this holding — set one via "
            "PATCH /portfolio/holdings/{holding_id} to include it in market-data refresh"
        )
        return

    try:
        price_obs: PriceObservation = provider.get_latest_price(hv.market_ticker)
    except MarketDataUnavailableError as exc:
        hv.data_warning = str(exc)
        return

    db.add(
        MarketObservation(
            holding_id=hv.holding_id,
            observed_at=price_obs.observed_at,
            price=price_obs.price,
            currency=price_obs.currency,
            provider=price_obs.provider,
            data_status=price_obs.status,
        )
    )
    hv.price = price_obs.price
    hv.price_currency = price_obs.currency
    hv.price_observed_at = price_obs.observed_at
    hv.price_status = price_obs.status

    if hv.quantity is None:
        hv.data_warning = "no quantity on this position — cannot compute an absolute market value"
        return

    hv.market_value_trading_ccy = calc.quantize(hv.quantity * price_obs.price)

    try:
        fx_to_reporting = fx_cache.get(price_obs.currency, reporting_currency)
    except MarketDataUnavailableError as exc:
        hv.data_warning = f"price available but FX conversion failed: {exc}"
        return

    hv.fx_rate_to_reporting = fx_to_reporting.rate
    hv.market_value_reporting_ccy = calc.quantize(
        calc.convert_currency(hv.market_value_trading_ccy, fx_to_reporting.rate)
    )

    if position.cost_basis is not None and hv.quantity is not None:
        cost_basis_currency = position.cost_basis_currency or hv.trading_currency
        cost_value_native = hv.quantity * position.cost_basis
        try:
            fx_cost = fx_cache.get(cost_basis_currency, reporting_currency)
        except MarketDataUnavailableError:
            fx_cost = None
        if fx_cost is not None:
            hv.cost_basis_value_reporting_ccy = calc.quantize(
                calc.convert_currency(cost_value_native, fx_cost.rate)
            )
            hv.unrealized_pnl = calc.quantize(
                calc.unrealized_pnl(hv.market_value_reporting_ccy, hv.cost_basis_value_reporting_ccy)
            )
            hv.unrealized_pnl_pct = calc.quantize(
                calc.unrealized_pnl_pct(hv.market_value_reporting_ccy, hv.cost_basis_value_reporting_ccy),
                places=calc.PERCENT_PLACES,
            )


def _apply_computed_weights(valuations: list[HoldingValuation]) -> None:
    total = sum(
        (hv.market_value_reporting_ccy for hv in valuations if hv.market_value_reporting_ccy is not None),
        Decimal("0"),
    )
    if total <= 0:
        return
    for hv in valuations:
        if hv.market_value_reporting_ccy is not None:
            hv.computed_weight_pct = calc.quantize(
                hv.market_value_reporting_ccy / total * Decimal("100"), places=calc.PERCENT_PLACES
            )


def _quantize_pct(value: Decimal) -> Decimal:
    """Non-Optional convenience over calc.quantize for call sites that
    already know their input isn't None — keeps calc.quantize's signature
    honestly Optional-in/Optional-out (it's the one that handles genuinely
    missing calculated values) without forcing every caller here to satisfy
    a type checker over a case that can't actually occur."""
    result = calc.quantize(value, places=calc.PERCENT_PLACES)
    assert result is not None  # value is non-None in, so quantize can't return None
    return result


def _build_concentration(valuations: list[HoldingValuation], warnings: list[str]) -> ConcentrationProfile:
    valued = [hv for hv in valuations if hv.computed_weight_pct is not None]
    excluded = [hv.ticker for hv in valuations if hv.computed_weight_pct is None]

    # Grouped by ticker rather than taken straight from computed_weight_pct:
    # the same instrument legitimately sits in more than one account (e.g.
    # "Vår Energi" in both Ezra's ASK and Malik Faiz's ASK — see
    # app.services.portfolio.ingestion's module docstring), so `valued` can
    # contain several HoldingValuation entries that share a ticker. A plain
    # `{hv.ticker: hv.computed_weight_pct for hv in valued}` dict comprehension
    # silently let the last position for a given ticker clobber every earlier
    # one instead of combining them, understating (or, depending on
    # iteration order, wildly overstating relative to what should have been
    # the largest slice) that instrument's true weight in "By holding" and in
    # largest_single_name_pct/single_name_hhi. Summing market value per
    # ticker first — the same pattern already used for sector/currency/
    # asset-class below — fixes that without changing the total each
    # weight is measured against (still every valued position's market
    # value, matching _apply_computed_weights).
    single_name_values: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for hv in valued:
        if hv.market_value_reporting_ccy is not None:
            single_name_values[hv.ticker] += hv.market_value_reporting_ccy
    single_name_weights = {
        k: _quantize_pct(v) for k, v in calc.weights_by_group(dict(single_name_values)).items()
    }
    single_name_hhi = calc.quantize(calc.herfindahl_hirschman_index(list(single_name_weights.values())))
    largest = calc.largest_weight_pct(list(single_name_weights.values()))

    sector_values: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    currency_values: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    asset_class_values: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for hv in valued:
        market_value = hv.market_value_reporting_ccy
        if market_value is None:
            continue
        sector_values[hv.sector or _UNCLASSIFIED_SECTOR] += market_value
        currency_values[hv.trading_currency] += market_value
        asset_class_values[hv.asset_class] += market_value

    sector_weights = {k: _quantize_pct(v) for k, v in calc.weights_by_group(dict(sector_values)).items()}
    currency_weights = {
        k: _quantize_pct(v) for k, v in calc.weights_by_group(dict(currency_values)).items()
    }
    asset_class_weights = {
        k: _quantize_pct(v) for k, v in calc.weights_by_group(dict(asset_class_values)).items()
    }
    sector_hhi = (
        calc.quantize(calc.herfindahl_hirschman_index(list(sector_weights.values())))
        if sector_weights
        else None
    )

    if excluded:
        warnings.append(
            "concentration figures exclude holdings with no market value: " + ", ".join(excluded)
        )

    return ConcentrationProfile(
        single_name_hhi=single_name_hhi,
        largest_single_name_pct=largest,
        single_name_weights=single_name_weights,
        sector_hhi=sector_hhi,
        sector_weights=sector_weights,
        currency_weights=currency_weights,
        asset_class_weights=asset_class_weights,
        holdings_excluded_from_concentration=excluded,
    )
