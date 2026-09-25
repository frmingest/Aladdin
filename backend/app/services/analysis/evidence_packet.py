"""Builds the evidence packet the blind/reconciliation passes reason over
(CLAUDE.md Rule 2: every material claim in an analysis output must cite a
real evidence ID from the packet built for that run).

Every item's *content* is either a raw sourced fact (a research item's
summary + source_url) or a number already computed deterministically by
app/services/calculations.py / app/services/valuation/ — this module never
hands the LLM raw, uninterpreted filing rows for it to do arithmetic on
(CLAUDE.md Rule 1). It reuses, rather than re-implements, Sprint 2's
research services and Sprint 3's valuation orchestration exactly as they
already exist — no changes to either.

ROE, ROIC and ROCE (since v6, 2026-09-25) come from
metrics.compute_holding_metrics() with the prior year passed in, so the
packet and the metrics panel use one definition.
"""
from __future__ import annotations

import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from decimal import Decimal
from itertools import count

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.domain.analysis_assumptions import get_analysis_assumptions
from app.domain.period_dates import extract_year
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.providers.base import (
    MarketDataProvider,
    ResearchProvider,
    RiskFreeRateProvider,
)
from app.providers.newsweb_provider import NewswebAnnouncementsProvider
from app.services.analysis.document_excerpts import (
    add_document_excerpt_evidence,
    select_document_excerpts,
)
from app.services.filings.announcements import get_holding_announcements
from app.services.filings.eligibility import newsweb_applies
from app.services.filings.sec_edgar import latest_edgar_document
from app.services.macro.evidence import add_macro_indicator_evidence
from app.services.holding_facts import facts_by_period, latest_period
from app.services.market_inputs import build_market_context
from app.services.metrics import MetricsResult, compute_holding_metrics
from app.services.research.common import ResearchSnapshot
from app.services.research.company import get_company_research
from app.services.research.macro import get_macro_research
from app.services.research.sector import get_sector_research
from app.services.valuation.holding_valuation import (
    HoldingValuationResult,
    compute_holding_valuation,
)

# v2 (2026-09-22): adds SEC EDGAR filing provenance ("financial_sources")
# and Oslo Børs Newsweb announcements ("regulatory_announcements"). v1 runs
# stay traceable via equity_analysis_runs.evidence_packet_version.
# v3 (2026-09-23): owner's-view definitions from app/services/metrics.py —
# FCF/owner earnings net of decommissioning, lease, financing-classified
# interest and hybrid coupons; hybrid capital as debt; ROE on ordinary
# equity; "not meaningful" instead of ratios over a negative denominator.
# v4 (2026-09-23, Sprint 6): adds "document_excerpt" items — passages from
# the holding's uploaded annual reports/presentations, chosen by
# app/services/analysis/document_excerpts.py within a token budget.
# v5 (2026-09-24): adds "macro_indicator" items — policy rates, yields,
# CPI, FX and credit spread from Norges Bank / FRED / SSB, with 3- and
# 12-month changes and derived real rates (app/services/macro/).
# v6 (2026-09-25): ROE on AVERAGE ordinary equity (not meaningful when book
# equity is depleted), ROIC on the filing's effective tax rate, ROCE, and
# "current market multiples" (today's price in the filing currency x the
# current share count on the latest year's figures). Historical multiples
# now convert the price into the filing currency.
EVIDENCE_PACKET_VERSION = "v6"


@dataclass(frozen=True)
class EvidenceItem:
    id: str
    category: str
    label: str
    content: str
    citation: str | None = None


@dataclass
class EvidencePacket:
    holding_id: uuid.UUID
    ticker: str
    version: str = EVIDENCE_PACKET_VERSION
    items: list[EvidenceItem] = field(default_factory=list)
    unavailable_reasons: list[str] = field(default_factory=list)
    # Kept for the pipeline to derive the deterministic price-target range
    # from — its own numbers are separately surfaced as EvidenceItems below,
    # this reference isn't itself serialized to the LLM.
    valuation: HoldingValuationResult | None = None

    def render_for_prompt(self) -> str:
        blocks = []
        for item in self.items:
            citation = f"\nsource: {item.citation}" if item.citation else ""
            blocks.append(f"[{item.id}] ({item.category}) {item.label}\n{item.content}{citation}")
        return "\n\n".join(blocks)

    def known_ids(self) -> set[str]:
        return {item.id for item in self.items}

    def as_dict(self) -> dict:
        return {
            "version": self.version,
            "holding_id": str(self.holding_id),
            "ticker": self.ticker,
            "items": [
                {
                    "id": item.id,
                    "category": item.category,
                    "label": item.label,
                    "content": item.content,
                    "citation": item.citation,
                }
                for item in self.items
            ],
            "unavailable_reasons": self.unavailable_reasons,
        }


def _fmt_pct(value: Decimal) -> str:
    return f"{value * 100:.1f}%"


def _fmt_num(value: Decimal) -> str:
    return f"{value:,.2f}"


def _financial_history_by_period(
    db: Session, holding: Holding
) -> list[tuple[int, str, dict[str, Decimal]]]:
    """(year, period, facts) triples, most-recent-first, for periods with a
    parseable year — mirrors app/services/valuation/holding_valuation.py's
    own period-grouping approach."""
    line_items = list(
        db.scalars(select(FinancialLineItem).where(FinancialLineItem.holding_id == holding.id))
    )
    by_period: dict[str, dict[str, Decimal]] = {}
    for item in line_items:
        by_period.setdefault(item.period, {})[item.metric] = item.value

    rows: list[tuple[int, str, dict[str, Decimal]]] = []
    for period, facts in by_period.items():
        year = extract_year(period)
        if year is not None:
            rows.append((year, period, facts))
    rows.sort(key=lambda row: row[0], reverse=True)
    return rows


def build_evidence_packet(
    db: Session,
    holding: Holding,
    *,
    market_data_provider: MarketDataProvider,
    risk_free_rate_provider: RiskFreeRateProvider,
    research_provider: ResearchProvider,
    announcements_provider: NewswebAnnouncementsProvider | None = None,
) -> EvidencePacket:
    settings = get_settings()
    assumptions = get_analysis_assumptions(settings.active_analysis_assumptions_version)
    packet = EvidencePacket(holding_id=holding.id, ticker=holding.ticker)
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
        f"{holding.name} ({holding.ticker}); sector: {holding.sector or 'unspecified'}; "
        f"trading currency: {holding.trading_currency}.",
    )

    _add_financial_history_evidence(db, holding, assumptions, add)
    _add_financial_source_evidence(db, holding, add)

    valuation = compute_holding_valuation(db, holding, market_data_provider, risk_free_rate_provider)
    packet.valuation = valuation
    _add_valuation_evidence(valuation, add)
    packet.unavailable_reasons.extend(f"valuation: {reason}" for reason in valuation.unavailable_reasons)
    _add_market_multiples_evidence(db, holding, market_data_provider, packet, add)

    macro_snapshot = get_macro_research(db, research_provider)
    _add_research_evidence(macro_snapshot, "macro_research", "Macro/geopolitical research", add)
    _note_research_gap(packet, macro_snapshot, "macro research")
    add_macro_indicator_evidence(db, add, packet.unavailable_reasons)

    if holding.sector:
        sector_snapshot = get_sector_research(db, research_provider, sector=holding.sector)
        _add_research_evidence(
            sector_snapshot, "sector_research", f"Sector research ({holding.sector})", add
        )
        _note_research_gap(packet, sector_snapshot, "sector research")
    else:
        packet.unavailable_reasons.append("sector research skipped: holding has no sector set")

    company_snapshot = get_company_research(db, research_provider, holding=holding)
    _add_research_evidence(company_snapshot, "company_research", "Company-specific research", add)
    _note_research_gap(packet, company_snapshot, "company research")

    excerpts = select_document_excerpts(
        db,
        holding,
        token_budget=settings.evidence_document_token_budget,
        max_excerpt_chars=settings.evidence_document_max_excerpt_chars,
        max_documents=settings.evidence_documents_max,
    )
    add_document_excerpt_evidence(excerpts, add)
    if excerpts.reason:
        packet.unavailable_reasons.append(f"document excerpts: {excerpts.reason}")

    if newsweb_applies(holding):
        announcements = get_holding_announcements(db, announcements_provider, holding=holding)
        _add_announcement_evidence(announcements, settings.announcements_in_evidence_packet, add)
        _note_research_gap(packet, announcements, "Newsweb announcements")

    return packet


def _add_return_on_capital_evidence(
    per_period: list[tuple[int, str, MetricsResult, Decimal | None]], assumptions, add: Callable
) -> None:
    """ROIC (after the filing's effective tax) and ROCE (pre-tax) series,
    with the latest period's definition note — the tax rate matters (Vår
    Energi pays ~78% petroleum tax)."""
    latest_period_label = per_period[0][1]
    for key, label in (
        ("roic", "ROIC (return on invested capital, after effective tax)"),
        ("roce", "ROCE (pre-tax return on the same invested capital)"),
    ):
        series = sorted(
            ((y, m.computed[key]) for y, _p, m, _r in per_period if key in m.computed), key=lambda r: r[0]
        )
        latest = per_period[0][2]
        if series:
            average = sum(v for _y, v in series) / len(series)
            content = (
                ", ".join(f"{y}: {_fmt_pct(v)}" for y, v in series)
                + f". {len(series)}-period average: {_fmt_pct(average)}."
            )
            if key == "roic":
                hurdle = assumptions.capital_efficiency_hurdle
                content += (
                    f" Capital-efficiency hurdle (assumptions {assumptions.version}): {_fmt_pct(hurdle)} — "
                    f"average ROIC is {'MEETS' if average >= hurdle else 'BELOW'} hurdle."
                )
            if key in latest.notes:
                content += f" Definition ({latest_period_label}): {latest.notes[key]}."
            elif key in latest.skipped:
                content += f" {latest_period_label}: {latest.skipped[key]}."
            add("financial_history", label, content)
        else:
            add(
                "financial_history",
                label,
                f"Not computable for any available period — {latest_period_label}: "
                f"{latest.skipped.get(key, 'missing inputs')}.",
            )


def _add_market_multiples_evidence(
    db: Session, holding: Holding, provider: MarketDataProvider, packet: EvidencePacket, add: Callable
) -> None:
    """Today's price and share count on the latest fiscal year's figures —
    the same numbers as the metrics panel's market multiples."""
    latest = latest_period(facts_by_period(db, holding.id))
    if latest is None:
        return
    no_currency = not any(c for m, c in latest.currencies.items() if m != "shares_outstanding")
    context = build_market_context(
        db,
        holding,
        provider,
        reporting_currency=latest.currency,
        latest_facts=latest.facts,
        latest_period=latest.period,
        currency_unknown_not_mixed=no_currency,
    )
    label = f"Current market multiples (today's price, {latest.period} figures)"
    if context.inputs is None:
        add("valuation", label, f"Not available: {context.unavailable_reason}.")
        packet.unavailable_reasons.append(f"market multiples: {context.unavailable_reason}")
        return
    result = compute_holding_metrics(latest.facts, latest.currencies, market=context.inputs)
    currency = context.reporting_currency or ""
    parts: list[str] = []
    for key, name, kind in (
        ("market_cap", "market cap", "money"),
        ("enterprise_value", "EV", "money"),
        ("price_to_earnings", "P/E", "x"),
        ("price_to_book", "P/B", "x"),
        ("price_to_sales", "P/S", "x"),
        ("ev_to_ebitda", "EV/EBITDA", "x"),
        ("fcf_yield", "FCF yield", "pct"),
    ):
        if key in result.computed:
            value = result.computed[key]
            text = (
                f"{currency} {_fmt_num(value / Decimal(1_000_000))}m" if kind == "money"
                else _fmt_pct(value) if kind == "pct" else f"{value:.2f}x"
            )
            parts.append(f"{name} {text}")
        elif result.skipped.get(key, "").startswith("not meaningful"):
            parts.append(f"{name} n/m ({result.skipped[key].removeprefix('not meaningful: ')})")
    content = "; ".join(parts) + f". Inputs: {context.inputs.note}."
    for warning in context.warnings:
        content += f" Caution: {warning}."
    add("valuation", label, content)


def _add_financial_source_evidence(db: Session, holding: Holding, add: Callable) -> None:
    """Where the financial-history numbers came from, when they came from
    SEC EDGAR — so the model can cite the actual filings."""
    document = latest_edgar_document(db, holding)
    if document is None:
        return
    flags = document.quality_flags or {}
    filings = flags.get("filings") or []
    if not filings:
        return
    listing = "; ".join(
        f"{f.get('form')} filed {f.get('filed')} (accession {f.get('accession_number')})" for f in filings[:8]
    )
    add(
        "financial_sources",
        "Financial history source: SEC EDGAR XBRL filings",
        f"Annual figures above for {flags.get('entity_name', holding.name)} (CIK {flags.get('cik')}) are "
        f"filer-reported XBRL values from: {listing}.",
        citation=f"SEC EDGAR — {flags.get('source_url', '')}",
    )


def _add_announcement_evidence(snapshot: ResearchSnapshot, limit: int, add: Callable) -> None:
    # Titles are issuer-written text (CLAUDE.md Rule 5): passed through as
    # data inside the packet, which the prompts frame as evidence to cite.
    if not snapshot.items:
        add(
            "regulatory_announcements",
            "Oslo Børs regulated announcements",
            "No regulated announcements found in the lookback window.",
        )
        return
    for item in snapshot.items[:limit]:
        add(
            "regulatory_announcements",
            f"Newsweb announcement: {item.title}",
            item.summary,
            citation=f"{item.source_name} — {item.source_url}",
        )


def _note_research_gap(packet: EvidencePacket, snapshot: ResearchSnapshot, label: str) -> None:
    if not snapshot.available:
        packet.unavailable_reasons.append(f"{label} unavailable: {snapshot.reason}")
    elif snapshot.reason:
        packet.unavailable_reasons.append(f"{label}: {snapshot.reason}")


def _add_research_evidence(
    snapshot: ResearchSnapshot, category: str, label_prefix: str, add: Callable
) -> None:
    if not snapshot.items:
        add(category, label_prefix, "No research items currently available.")
        return
    for research_item in snapshot.items:
        add(
            category,
            f"{label_prefix}: {research_item.title}",
            research_item.summary,
            citation=f"{research_item.source_name} — {research_item.source_url}",
        )


def _add_valuation_evidence(result: HoldingValuationResult, add: Callable) -> None:
    if result.base_growth_rate is not None:
        add(
            "valuation",
            "Historical owner-earnings growth rate (base case)",
            f"{_fmt_pct(result.base_growth_rate)}, assumptions {result.assumptions_version}.",
        )
    if result.discount_rate is not None:
        add(
            "valuation",
            "CAPM discount rate",
            f"{_fmt_pct(result.discount_rate)} (risk-free rate {_fmt_pct((result.risk_free_rate_pct or Decimal(0)) / 100)}, "
            f"beta {result.beta}, equity risk premium {_fmt_pct(result.equity_risk_premium or Decimal(0))}).",
        )
    if result.dcf is not None:
        scenario_lines = []
        for scenario in result.dcf.scenarios:
            mos = result.dcf.margin_of_safety(scenario.label)
            mos_text = f", margin of safety {_fmt_pct(mos)}" if mos is not None else ""
            scenario_lines.append(
                f"{scenario.label}: growth {_fmt_pct(scenario.growth_rate)}, intrinsic value/share "
                f"{_fmt_num(scenario.intrinsic_value_per_share)} {result.valuation_currency or ''}{mos_text}"
            )
        add(
            "valuation",
            "DCF scenarios (base/bull/bear)",
            "; ".join(scenario_lines) + f". Current price/share: "
            f"{_fmt_num(result.current_price_per_share) if result.current_price_per_share is not None else 'unavailable'} "
            f"{result.valuation_currency or ''}.",
        )
    if result.reverse_dcf_implied_growth is not None:
        add(
            "valuation",
            "Reverse DCF implied growth",
            f"The growth rate the current price implies: {_fmt_pct(result.reverse_dcf_implied_growth)}.",
        )
    for m in result.multiples:
        if m.computed:
            formatted = ", ".join(f"{name}={value:.2f}" for name, value in m.computed.items())
            add("valuation", f"Multiples ({m.period})", formatted)
    if not result.dcf and not result.multiples:
        add("valuation", "Valuation", "No valuation could be computed for this holding.")


def _add_financial_history_evidence(
    db: Session, holding: Holding, assumptions, add: Callable
) -> None:
    history = _financial_history_by_period(db, holding)[: assumptions.history_years]
    if not history:
        add(
            "financial_history",
            "Financial history",
            "No extracted financial facts available for this holding — every ratio below is unavailable.",
        )
        return

    facts_by_year = {year: facts for year, _period, facts in _financial_history_by_period(db, holding)}
    per_period: list[tuple[int, str, MetricsResult, Decimal | None]] = []
    for year, period, facts in history:
        metrics_result = compute_holding_metrics(facts, prior_facts=facts_by_year.get(year - 1))
        per_period.append((year, period, metrics_result, metrics_result.computed.get("roe")))

    roe_series = sorted(((y, v) for y, _p, _m, v in per_period if v is not None), key=lambda r: r[0])
    latest_roe_skip = per_period[0][2].skipped.get("roe", "")
    if roe_series:
        avg_roe = sum(v for _y, v in roe_series) / len(roe_series)
        hurdle = assumptions.capital_efficiency_hurdle
        comparison = "MEETS" if avg_roe >= hurdle else "BELOW"
        add(
            "financial_history",
            "ROE (return on equity) history",
            ", ".join(f"{y}: {_fmt_pct(v)}" for y, v in roe_series)
            + f". {len(roe_series)}-period average: {_fmt_pct(avg_roe)}. "
            f"Capital-efficiency hurdle (assumptions {assumptions.version}): {_fmt_pct(hurdle)} — "
            f"average ROE is {comparison} hurdle.",
        )
    else:
        add(
            "financial_history",
            "ROE (return on equity) history",
            "Not computable for any available period"
            + (f" — latest period: {latest_roe_skip}." if latest_roe_skip else "."),
        )
    if roe_series and latest_roe_skip.startswith("not meaningful"):
        add(
            "financial_history",
            f"ROE ({per_period[0][1]})",
            f"Not meaningful for the latest period: {latest_roe_skip}.",
        )
    _add_return_on_capital_evidence(per_period, assumptions, add)

    for metric_name, label in (
        ("gross_margin", "Gross margin"),
        ("operating_margin", "Operating margin"),
        ("net_margin", "Net margin"),
    ):
        series = sorted(
            ((y, m.computed[metric_name]) for y, _p, m, _r in per_period if metric_name in m.computed),
            key=lambda row: row[0],
        )
        if series:
            avg = sum(v for _y, v in series) / len(series)
            add(
                "financial_history",
                f"{label} history",
                ", ".join(f"{y}: {_fmt_pct(v)}" for y, v in series)
                + f". {len(series)}-period average: {_fmt_pct(avg)}.",
            )
        else:
            add("financial_history", f"{label} history", "Not computable for any available period.")

    _latest_year, latest_period, latest_metrics, _latest_roe = per_period[0]
    for metric_name, label in (
        ("net_debt_to_ebitda", "Net Debt/EBITDA"),
        ("net_debt_to_fcf", "Net Debt/FCF"),
        ("interest_coverage", "Interest coverage"),
        ("debt_to_equity", "Debt/Equity"),
    ):
        if metric_name in latest_metrics.computed:
            add(
                "financial_history",
                f"{label} ({latest_period})",
                _fmt_num(latest_metrics.computed[metric_name]),
            )
        else:
            add(
                "financial_history",
                f"{label} ({latest_period})",
                f"Not computable: {latest_metrics.skipped.get(metric_name, 'missing inputs')}.",
            )

    oe_series = sorted(
        ((y, m.computed["owner_earnings"]) for y, _p, m, _r in per_period if "owner_earnings" in m.computed),
        key=lambda row: row[0],
    )
    if oe_series:
        add(
            "financial_history",
            "Owner earnings trend (net income + D&A - capex - decommissioning/lease payments where reported)",
            ", ".join(f"{y}: {_fmt_num(v)}" for y, v in oe_series),
        )
    else:
        add(
            "financial_history",
            "Owner earnings trend",
            "Not computable for any available period (missing net_income/D&A/capex).",
        )
