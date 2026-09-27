"""All-Weather portfolio view for Dalio mode (Epic F22, story 22.9 —
absorbs quarterly-review Sprint 15 #3, rate sensitivity).

Everything is market-value weighted from portfolio_overview.build_overview
(ECON-F22-09: CWO weighted by cost basis; Aladdin never does). Two kinds of
figure, kept apart and labelled:

- **measured** (Python, CLAUDE.md Rule 1): quadrant and rate betas per
  holding (app/services/dalio/cycle_math.py), the portfolio's measured
  quadrant tilt from statistically clear betas only, weighted rate
  sensitivity, currency split, correlation clusters, and country risk
  weighted through fund look-through (ECON-F22-08);
- **judged** (the Dalio analysis runs): each holding's portfolio_role and
  favoured environments, as the latest Dalio run wrote them. A holding with
  no Dalio run is "not analyzed", never guessed.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.domain.analysis_schema.dalio_v1 import ENVIRONMENTS, PORTFOLIO_ROLES
from app.models.holding import Holding
from app.providers.base import MarketDataProvider
from app.services.analysis.latest import (
    latest_runs_by_holding,
    run_portfolio_role,
    run_ratings,
)
from app.services.country_risk.domicile import COUNTRY_NAMES, country_exposure
from app.services.country_risk.indicators import get_country_risk
from app.services.dalio.cycle_math import FactorBeta
from app.services.dalio.holding_analytics import cycle_profile
from app.services.portfolio_overview import build_overview
from app.services.risk.correlation import build_correlation_matrix, correlated_clusters
from app.services.risk.price_history import TickerHistory, get_or_refresh_daily_history
from app.services.risk.regime import classify_regime

ZERO = Decimal(0)
Q2 = Decimal("0.01")

ROLE_LABELS = {
    "growth_engine": "Growth engine",
    "inflation_hedge": "Inflation hedge",
    "deflation_hedge": "Deflation hedge",
    "currency_debasement_hedge": "Currency-debasement hedge",
    "diversifier": "Diversifier",
    "redundant": "Redundant",
    "not_analyzed": "No Dalio analysis yet",
}
ENVIRONMENT_LABELS = {
    "rising_growth": "Rising growth",
    "falling_growth": "Falling growth",
    "rising_inflation": "Rising inflation",
    "falling_inflation": "Falling inflation",
}


@dataclass
class BetaView:
    beta: Decimal | None
    t_stat: Decimal | None
    significant: bool
    n_months: int
    reason: str | None

    @classmethod
    def of(cls, b: FactorBeta) -> BetaView:
        return cls(
            beta=b.beta.quantize(Q2) if b.beta is not None else None,
            t_stat=b.t_stat.quantize(Q2) if b.t_stat is not None else None,
            significant=b.significant,
            n_months=b.n_months,
            reason=b.reason,
        )


@dataclass
class AllWeatherPosition:
    holding_id: object
    ticker: str
    name: str
    instrument_type: str
    trading_currency: str
    weight_pct: Decimal | None
    value_nok: Decimal | None
    portfolio_role: str | None
    dalio_verdict: str | None
    dalio_analyzed_at: datetime | None
    favoured_environments: list[str]
    inflation: BetaView
    growth: BetaView
    rates_us: BetaView
    rates_no: BetaView
    tilt: str


@dataclass
class WeightSlice:
    key: str
    label: str
    weight_pct: Decimal
    count: int


@dataclass
class CountrySlice:
    country: str
    name: str
    weight_pct: Decimal
    ssi_score: Decimal | None
    ssi_band: str | None
    data_quality: str
    wgi_estimate: Decimal | None


@dataclass
class RateSensitivity:
    key: str
    label: str
    weighted_beta: Decimal | None
    coverage_pct: Decimal
    note: str


@dataclass
class AllWeather:
    as_of: datetime | None
    total_value_nok: Decimal
    regime: str
    positions: list[AllWeatherPosition] = field(default_factory=list)
    by_role: list[WeightSlice] = field(default_factory=list)
    by_judged_environment: list[WeightSlice] = field(default_factory=list)
    by_measured_environment: list[WeightSlice] = field(default_factory=list)
    by_currency: list[WeightSlice] = field(default_factory=list)
    by_country: list[CountrySlice] = field(default_factory=list)
    country_coverage_pct: Decimal = ZERO
    rate_sensitivity: list[RateSensitivity] = field(default_factory=list)
    clusters: list[dict] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def _favoured(run) -> list[str]:
    blind = (run.blind_pass_json or {}) if run else {}
    envs = (blind.get("quadrant_fit") or {}).get("favoured_environments") or []
    return [e for e in envs if e in ENVIRONMENTS]


def _measured_envs(p: AllWeatherPosition) -> list[str]:
    out = []
    if p.growth.significant and p.growth.beta is not None:
        out.append("rising_growth" if p.growth.beta > 0 else "falling_growth")
    if p.inflation.significant and p.inflation.beta is not None:
        out.append("rising_inflation" if p.inflation.beta > 0 else "falling_inflation")
    return out


def build_all_weather(db: Session, *, market_data_provider: MarketDataProvider | None) -> AllWeather:
    settings = get_settings()
    overview = build_overview(db)
    result = AllWeather(
        as_of=overview.as_of, total_value_nok=overview.total_value_nok, regime=classify_regime(db).regime
    )
    positions = [p for p in overview.positions if p.ticker]
    runs = latest_runs_by_holding(db, [p.holding_id for p in positions], persona="dalio")

    for p in positions:
        run = runs.get(p.holding_id)
        verdict, _moat, analyzed_at = run_ratings(run) if run else (None, None, None)
        profile = cycle_profile(db, market_data_provider, ticker=p.ticker, trading_currency=p.trading_currency)
        result.positions.append(
            AllWeatherPosition(
                holding_id=p.holding_id,
                ticker=p.ticker,
                name=p.name,
                instrument_type=p.instrument_type,
                trading_currency=p.trading_currency,
                weight_pct=p.weight_pct,
                value_nok=p.value_nok,
                portfolio_role=run_portfolio_role(run) if run else None,
                dalio_verdict=verdict,
                dalio_analyzed_at=analyzed_at,
                favoured_environments=_favoured(run),
                inflation=BetaView.of(profile.inflation),
                growth=BetaView.of(profile.growth),
                rates_us=BetaView.of(profile.rates_us),
                rates_no=BetaView.of(profile.rates_no),
                tilt=profile.tilt,
            )
        )

    def w(pos: AllWeatherPosition) -> Decimal:
        return pos.weight_pct or ZERO

    # Judged: roles and favoured environments from the Dalio runs.
    for role in (*PORTFOLIO_ROLES, "not_analyzed"):
        members = [x for x in result.positions if (x.portfolio_role or "not_analyzed") == role]
        if members:
            result.by_role.append(
                WeightSlice(role, ROLE_LABELS[role], sum(map(w, members)).quantize(Q2), len(members))
            )
    for env in ENVIRONMENTS:
        judged = [x for x in result.positions if env in x.favoured_environments]
        result.by_judged_environment.append(
            WeightSlice(env, ENVIRONMENT_LABELS[env], sum(map(w, judged), ZERO).quantize(Q2), len(judged))
        )
        measured = [x for x in result.positions if env in _measured_envs(x)]
        result.by_measured_environment.append(
            WeightSlice(env, ENVIRONMENT_LABELS[env], sum(map(w, measured), ZERO).quantize(Q2), len(measured))
        )
    result.notes.append(
        "Environment weights can add to more or less than 100%: a holding can suit several environments, or none."
    )

    result.by_currency = [
        WeightSlice(s.key, s.label, s.weight_pct, s.holding_count) for s in overview.by_currency
    ]

    # Rate sensitivity (absorbs quarterly-review #3): weighted mean beta over
    # holdings with enough history, plus the share of the portfolio it covers.
    for key, label, attr in (
        ("rates_us", "US 10-year yield", "rates_us"),
        ("rates_no", "Norway 10-year yield", "rates_no"),
    ):
        covered = [x for x in result.positions if getattr(x, attr).beta is not None]
        cov_w = sum(map(w, covered), ZERO)
        beta = (sum(getattr(x, attr).beta * w(x) for x in covered) / cov_w).quantize(Q2) if cov_w > 0 else None
        result.rate_sensitivity.append(
            RateSensitivity(
                key, label, beta, cov_w.quantize(Q2),
                "% monthly portfolio return per +1pp change in the yield, weighted over the covered holdings; "
                "includes statistically weak betas — see each holding's t-statistic.",
            )
        )

    # Country risk, market-value weighted with fund look-through.
    country_w: dict[str, Decimal] = {}
    covered = ZERO
    for pos in result.positions:
        holding = db.get(Holding, pos.holding_id)
        if holding is None or pos.weight_pct is None:
            continue
        exposure = country_exposure(db, holding)
        if exposure.gap:
            continue
        for c, pct in exposure.weights.items():
            share = pos.weight_pct * pct / 100
            country_w[c] = country_w.get(c, ZERO) + share
            covered += share
    result.country_coverage_pct = covered.quantize(Q2)
    for c, weight in sorted(country_w.items(), key=lambda kv: -kv[1]):
        risk = get_country_risk(db, c)
        result.by_country.append(
            CountrySlice(
                country=c, name=COUNTRY_NAMES.get(c, c), weight_pct=weight.quantize(Q2),
                ssi_score=risk.ssi.score, ssi_band=risk.ssi.band, data_quality=risk.ssi.data_quality,
                wgi_estimate=risk.wgi_estimate,
            )
        )
    if covered < (sum(map(w, result.positions), ZERO) - Decimal("0.5")):
        result.notes.append(
            "Country weights cover only part of the portfolio: funds/ETFs/ETCs without stored country look-through "
            "are left out rather than attributed to their domicile (ECON-F22-08)."
        )

    # Correlation clusters over every position (not just equities).
    if market_data_provider is not None and positions:
        lookback = settings.risk_correlation_lookback_days
        histories: dict[str, TickerHistory] = {}
        for p in positions:
            if p.ticker not in histories:
                histories[p.ticker] = get_or_refresh_daily_history(
                    db, market_data_provider, ticker=p.ticker, currency_hint=p.trading_currency, lookback_days=lookback
                )
        matrix = build_correlation_matrix(histories, lookback_days=lookback)
        flags = correlated_clusters(
            top_holdings=sorted(((p.ticker, p.name, p.weight_pct or ZERO) for p in positions), key=lambda t: -t[2]),
            correlation=matrix,
            threshold=Decimal(settings.risk_cluster_correlation_threshold),
        )
        result.clusters = [
            {"tickers": f.tickers, "names": f.names, "correlation": f.correlation, "combined_weight_pct": f.combined_weight_pct}
            for f in flags
        ]
    else:
        result.notes.append("Correlation clusters not computed: no market-data provider configured.")
    return result
