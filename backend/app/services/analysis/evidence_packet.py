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

Note on ROE: app/services/metrics.py (Sprint 1, GET /holdings/{id}/metrics)
deliberately always skips ROE alongside ROIC, by a decision already shipped
and tested there. That endpoint's contract is left untouched by this
module. Brain Step 1.3 needs 3-5yr average ROE, and ROE *is* directly
computable from extracted facts (net_income, total_equity — no NOPAT/
invested-capital derivation required, unlike ROIC), so this module calls
app/services/calculations.roe() directly per period instead of going
through metrics.compute_holding_metrics() for that one figure.
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
from app.services import calculations
from app.services.analysis.document_excerpts import (
    add_document_excerpt_evidence,
    select_document_excerpts,
)
from app.services.filings.announcements import get_holding_announcements
from app.services.filings.eligibility import newsweb_applies
from app.services.filings.sec_edgar import latest_edgar_document
from app.services.metrics import MetricsResult, compute_holding_metrics, ordinary_equity
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
EVIDENCE_PACKET_VERSION = "v4"


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

    macro_snapshot = get_macro_research(db, research_provider)
    _add_research_evidence(macro_snapshot, "macro_research", "Macro/geopolitical research", add)
    _note_research_gap(packet, macro_snapshot, "macro research")

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

    per_period: list[tuple[int, str, MetricsResult, Decimal | None]] = []
    for year, period, facts in history:
        metrics_result = compute_holding_metrics(facts)
        roe_value: Decimal | None = None
        equity = ordinary_equity(facts)
        if "net_income" in facts and equity is not None and equity > 0:
            try:
                roe_value = calculations.roe(facts["net_income"], equity)
            except ValueError:
                roe_value = None
        per_period.append((year, period, metrics_result, roe_value))

    roe_series = sorted(((y, v) for y, _p, _m, v in per_period if v is not None), key=lambda r: r[0])
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
            "Not computable for any available period (missing net_income/total_equity, "
            "or ordinary shareholders' equity is zero or negative).",
        )
    add(
        "financial_history",
        "ROIC (return on invested capital)",
        "Not computable from extracted filing facts alone — needs NOPAT and invested capital, "
        "neither of which is derived from raw extracted facts today.",
    )

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
