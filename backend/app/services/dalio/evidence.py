"""The Dalio evidence packet (Epic F22, stories 22.3 and 22.10) — what the
dalio_v1 blind and reconciliation passes reason over and cite.

Same contract as the Buffett/Munger packets
(app/services/analysis/evidence_packet.py, app/services/funds/evidence.py):
every number is computed in Python first (CLAUDE.md Rule 1), every item has
an EV-### id the output must cite (Rule 2), research text is quoted as data
(Rule 5), and every gap goes to `unavailable_reasons` instead of a
placeholder.

Blind-pass isolation (plan §2): nothing here reads the holding's notes, and
nothing reads another persona's analysis run — the Dalio packet is built
only from market, macro, country and portfolio data. A test guards both.

One packet for every instrument type (decision 5, §3c): what differs
between a stock, a fund and a gold ETC is which items are present, not the
schema.
"""
from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timezone
from decimal import Decimal
from itertools import count

from sqlalchemy.orm import Session

from app.domain.instrument_types import COMMODITY_ETC, STOCK, display_label
from app.models.holding import Holding
from app.providers.base import (
    MarketDataProvider,
    ResearchProvider,
    RiskFreeRateProvider,
)
from app.services.analysis.evidence_packet import EvidenceItem, EvidencePacket
from app.services.country_risk.domicile import COUNTRY_NAMES, country_exposure
from app.services.country_risk.indicators import describe_country_risk, get_country_risk
from app.services.dalio import gold_demand
from app.services.dalio.holding_analytics import correlation_contribution, cycle_profile
from app.services.dalio.macro import get_dalio_macro
from app.services.macro.evidence import add_macro_indicator_evidence
from app.services.macro.evidence import describe as describe_indicator
from app.services.portfolio_overview import build_overview
from app.services.research.macro import get_macro_research
from app.services.risk.regime import classify_regime

# dalio-v1 (2026-09-27): first Dalio packet.
DALIO_EVIDENCE_PACKET_VERSION = "dalio-v1"

# Country-risk items for at most this many countries per holding, and only
# for countries carrying at least this share of the holding.
MAX_COUNTRIES = 5
MIN_COUNTRY_WEIGHT_PCT = Decimal(5)


def _is_gold_related(holding: Holding) -> bool:
    return holding.asset_class_raw == COMMODITY_ETC or "gold" in (holding.name or "").lower()


def build_dalio_evidence_packet(
    db: Session,
    holding: Holding,
    *,
    market_data_provider: MarketDataProvider | None,
    risk_free_rate_provider: RiskFreeRateProvider | None,
    research_provider: ResearchProvider | None,
) -> EvidencePacket:
    packet = EvidencePacket(holding_id=holding.id, ticker=holding.ticker, version=DALIO_EVIDENCE_PACKET_VERSION)
    counter = count(1)

    def add(category: str, label: str, content: str, citation: str | None = None) -> EvidenceItem:
        item = EvidenceItem(
            id=f"EV-{next(counter):03d}", category=category, label=label, content=content, citation=citation
        )
        packet.items.append(item)
        return item

    add(
        "holding",
        "Holding identity",
        f"{holding.name} ({holding.ticker}); instrument type: {display_label(holding.asset_class_raw)}; "
        f"sector: {holding.sector or 'unspecified'}; trading currency: {holding.trading_currency}.",
    )

    overview = build_overview(db)
    _add_portfolio_position(overview, holding, add, packet)
    _add_cycle_state(db, add, packet)
    _add_cycle_profile(db, holding, market_data_provider, add, packet)
    _add_correlation(db, holding, market_data_provider, overview, add, packet)
    _add_currency(db, holding, overview, add, packet)
    _add_country_risk(db, holding, add, packet)
    if _is_gold_related(holding):
        summary = gold_demand.summarize(datetime.now(timezone.utc).date())
        add("gold", "Central-bank gold demand (static WGC dataset)", gold_demand.describe(summary),
            citation=gold_demand.SOURCE)
        if summary.quarters_behind:
            packet.unavailable_reasons.append(
                f"central-bank gold demand dataset ends {summary.as_of} ({summary.quarters_behind} quarters behind)"
            )
    if holding.asset_class_raw == STOCK and market_data_provider is not None and risk_free_rate_provider is not None:
        _add_valuation(db, holding, market_data_provider, risk_free_rate_provider, add, packet)
    elif holding.asset_class_raw != STOCK:
        packet.unavailable_reasons.append(
            "price target: n/a — no owner-earnings DCF exists for a fund, ETF or ETC (never invented)"
        )

    if research_provider is not None:
        snapshot = get_macro_research(db, research_provider)
        if snapshot.items:
            for item in snapshot.items:
                add("macro_research", f"Macro/geopolitical research: {item.title}", item.summary,
                    citation=f"{item.source_name} — {item.source_url}")
        else:
            add("macro_research", "Macro/geopolitical research", "No research items currently available.")
        if not snapshot.available:
            packet.unavailable_reasons.append(f"macro research unavailable: {snapshot.reason}")
    return packet


# ---------------------------------------------------------------------------


def _add_portfolio_position(overview, holding: Holding, add: Callable, packet: EvidencePacket) -> None:
    rows = [p for p in overview.positions if p.holding_id == holding.id]
    if not rows:
        add("portfolio", "Position in the portfolio",
            "Not currently owned (watchlist or closed position): the portfolio-role question is whether to add it.")
        return
    row = rows[0]
    if row.weight_pct is None or row.value_nok is None:
        add("portfolio", "Position in the portfolio",
            f"Owned, but no market value is stored for this position, so its weight is unknown; "
            f"the portfolio holds {overview.holding_count} holdings.")
        packet.unavailable_reasons.append("position weight: no market value stored for this position")
        return
    add(
        "portfolio",
        "Position in the portfolio",
        f"{row.weight_pct:.2f}% of the portfolio's market value ({row.value_nok:,.0f} NOK); portfolio total "
        f"{overview.total_value_nok:,.0f} NOK across {overview.holding_count} holdings.",
    )


def _add_cycle_state(db: Session, add: Callable, packet: EvidencePacket) -> None:
    """Debt-cycle and liquidity inputs: the shared macro catalogue, the
    Dalio-only FRED series, and the regime reading (label + numbers only —
    its narrative was written for the Buffett/Munger engine)."""
    add_macro_indicator_evidence(db, add, packet.unavailable_reasons)

    dalio_macro = get_dalio_macro(db)
    missing = []
    for snap in dalio_macro.snapshots:
        if snap.value is None:
            missing.append(snap.label)
            continue
        add("dalio_macro", f"{snap.label} ({snap.region})", describe_indicator(snap),
            citation=f"{snap.source_name} — series {snap.source_series_id} — {snap.source_url}")
    for fig in dalio_macro.derived:
        if fig.value is None:
            missing.append(f"{fig.label} ({fig.reason})")
            continue
        change = f"; 12 months earlier {fig.value_12m_ago} (change {fig.change_12m:+})" if fig.change_12m is not None else ""
        add("dalio_macro", f"{fig.label} (computed)",
            f"{fig.value} {fig.unit} as of {fig.observed_on}{change}. Computed: {fig.formula}. {fig.description}")
    if missing:
        packet.unavailable_reasons.append(f"Dalio macro series missing: {', '.join(missing)}")

    regime = classify_regime(db)
    inputs = "; ".join(
        f"{i.label} ({i.region}) {i.smoothed_value:.2f}{i.unit} 3-month average"
        for i in regime.inputs
        if i.smoothed_value is not None
    )
    add(
        "regime",
        "Macro regime classification (deterministic, Sprint 12 rules)",
        f"Regime: {regime.regime}. Inputs: {inputs or 'none stored'}. Yield-curve and credit-spread legs are "
        "US-only — no Norwegian curve or credit-spread series is captured yet (ECON-F22-02).",
    )
    packet.unavailable_reasons.append("Norway yield curve / credit spread: not captured — curve and credit are US-only")
    packet.unavailable_reasons.append(
        "Norway/EU long-term debt cycle (credit-to-GDP gap, debt-service ratio): no source yet (ECON-F22-04)"
    )


def _add_cycle_profile(
    db: Session, holding: Holding, provider: MarketDataProvider | None, add: Callable, packet: EvidencePacket
) -> None:
    profile = cycle_profile(db, provider, ticker=holding.ticker, trading_currency=holding.trading_currency)
    lines = [beta.describe() for beta in (profile.growth, profile.inflation)]
    add(
        "quadrant",
        "Growth/inflation sensitivity (monthly return betas)",
        " ".join(lines) + f" {profile.tilt} Returns in {holding.trading_currency}; univariate OLS on monthly "
        "data — weak evidence on short histories.",
    )
    add(
        "rates",
        "Interest-rate sensitivity (monthly return betas)",
        " ".join(beta.describe() for beta in (profile.rates_us, profile.rates_no)),
    )
    for beta in profile.betas:
        if not beta.available:
            packet.unavailable_reasons.append(f"cycle beta — {beta.factor_label}: {beta.reason}")
    if profile.history_note:
        packet.unavailable_reasons.append(f"price history: {profile.history_note}")


def _add_correlation(
    db: Session, holding: Holding, provider: MarketDataProvider | None, overview, add: Callable, packet: EvidencePacket
) -> None:
    positions = [
        (p.ticker, p.name, p.trading_currency, p.weight_pct or Decimal(0))
        for p in overview.positions
        if p.ticker
    ]
    contribution = correlation_contribution(
        db, provider, ticker=holding.ticker, trading_currency=holding.trading_currency, positions=positions
    )
    if contribution.weighted_avg_correlation is None:
        add("diversification", "Correlation with the rest of the portfolio",
            f"Not computable: {contribution.reason}.")
        packet.unavailable_reasons.append(f"correlation contribution: {contribution.reason}")
        return
    most = ", ".join(f"{n} {c}" for _t, n, c in contribution.most_correlated)
    least = ", ".join(f"{n} {c}" for _t, n, c in contribution.least_correlated)
    add(
        "diversification",
        "Correlation with the rest of the portfolio (1 year of daily returns)",
        f"Value-weighted average correlation with {contribution.peers_counted} other positions: "
        f"{contribution.weighted_avg_correlation}. Most correlated: {most}. Least correlated: {least}. "
        "Below ~0.3 = a genuinely separate return stream in Dalio's sense; above ~0.7 = largely the same bet.",
    )


def _add_currency(db: Session, holding: Holding, overview, add: Callable, packet: EvidencePacket) -> None:
    from app.domain.instrument_types import STOCK as _STOCK
    from app.services.funds.facts import latest_exposures

    text = f"Trades in {holding.trading_currency}; the owner measures wealth in NOK."
    if holding.trading_currency == "NOK":
        text += " No direct currency translation for a NOK owner."
    else:
        text += f" Its NOK value moves with {holding.trading_currency}/NOK as well as with the asset."
    if holding.asset_class_raw != _STOCK:
        as_of, rows = latest_exposures(db, holding.id, "currency")
        if rows:
            parts = ", ".join(f"{r.label} {r.weight_pct:.1f}%" for r in rows[:6])
            text += f" Underlying currency look-through as of {as_of}: {parts}."
        else:
            packet.unavailable_reasons.append("currency look-through: none on file for this fund/ETF/ETC")
    portfolio_split = ", ".join(f"{s.label} {s.weight_pct:.1f}%" for s in overview.by_currency[:6] if s.weight_pct)
    if portfolio_split:
        text += f" Whole portfolio by trading currency (market value): {portfolio_split}."
    add("currency", "Currency exposure", text)


def _add_country_risk(db: Session, holding: Holding, add: Callable, packet: EvidencePacket) -> None:
    exposure = country_exposure(db, holding)
    if exposure.gap:
        add("country_risk", "Country exposure", f"Not determined: {exposure.gap}.")
        packet.unavailable_reasons.append(f"country exposure: {exposure.gap}")
        return
    ranked = sorted(exposure.weights.items(), key=lambda kv: -kv[1])
    listed = ", ".join(f"{COUNTRY_NAMES.get(c, c)} {w:.1f}%" for c, w in ranked[:8])
    unmapped = f" Unmapped look-through labels: {exposure.unmapped_pct:.1f}%." if exposure.unmapped_pct else ""
    add("country_risk", "Country exposure", f"{listed} — {exposure.basis}.{unmapped}")
    for country, weight in ranked[:MAX_COUNTRIES]:
        if weight < MIN_COUNTRY_WEIGHT_PCT:
            continue
        risk = get_country_risk(db, country)
        add(
            "country_risk",
            f"Sovereign stress and political stability: {risk.name} ({weight:.1f}% of this holding)",
            describe_country_risk(risk),
            citation="World Bank World Development Indicators and Worldwide Governance Indicators (api.worldbank.org)",
        )
        if not risk.any_data:
            packet.unavailable_reasons.append(f"country indicators for {risk.name}: none stored yet")
    packet.unavailable_reasons.append(
        "IMF COFER reserve-currency shares: not integrated — the endpoint could not be verified live and the CWO "
        "version held only a static snapshot; reserve status is shown as SDR-basket membership instead"
    )


def _add_valuation(
    db: Session,
    holding: Holding,
    market_data_provider: MarketDataProvider,
    risk_free_rate_provider: RiskFreeRateProvider,
    add: Callable,
    packet: EvidencePacket,
) -> None:
    from app.services.valuation.holding_valuation import compute_holding_valuation

    valuation = compute_holding_valuation(db, holding, market_data_provider, risk_free_rate_provider)
    packet.valuation = valuation
    if valuation.dcf is None:
        add("valuation", "Owner-earnings DCF (context only)", "Not available for this holding.")
        packet.unavailable_reasons.extend(f"valuation: {r}" for r in valuation.unavailable_reasons)
        return
    scenarios = "; ".join(
        f"{s.label} {s.intrinsic_value_per_share:,.2f}" for s in valuation.dcf.scenarios
    )
    price = (
        f"{valuation.current_price_per_share:,.2f}" if valuation.current_price_per_share is not None else "unavailable"
    )
    add(
        "valuation",
        "Owner-earnings DCF (context only; computed by the Buffett/Munger valuation engine)",
        f"Intrinsic value per share by scenario ({valuation.valuation_currency}): {scenarios}. Current price: {price}. "
        "The Dalio verdict does not rest on this — it is here so the price-target range has a source.",
    )
