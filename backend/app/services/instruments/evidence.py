"""The evidence packet for the income path (bond fund, money-market fund)
and the commodity path (physical-metal ETC), 2026-10-07.

Same contract as the company and fund packets: every number is computed in
Python first (app/services/instruments/metrics.py, CLAUDE.md Rule 1), every
item has an EV-### id the output must cite (Rule 2), and issuer text is
quoted as data (Rule 5). Typed-in figures cite the document and page they
were read from.

It reuses the fund packet's profile, cost, track-record, holdings and split
items (a bond fund still has an ongoing charge, returns against a benchmark
and a holdings list). It leaves out what does not exist for these types: no
company look-through, no overlap with directly-held stocks, no DCF, and for
a metal no holdings at all. Macro and sector research and the numeric macro
indicators are reused — for these types macro is most of the story.
"""
from __future__ import annotations

from decimal import Decimal
from itertools import count

from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.domain.instrument_facts import fact_specs_for
from app.domain.instrument_types import (
    PATH_COMMODITY,
    PATH_INCOME,
    analysis_path,
    display_label,
)
from app.models.holding import Holding
from app.providers.base import ResearchProvider
from app.services.analysis.document_excerpts import (
    add_document_excerpt_evidence,
    select_document_excerpts,
)
from app.services.analysis.evidence_packet import EvidenceItem, EvidencePacket
from app.services.funds.evidence import (
    FUND_BOILERPLATE_TEXT,
    FUND_TEXT_PREFIX,
    _add_cost,
    _add_holdings,
    _add_profile,
    _add_research,
    _add_splits,
    _add_track_record,
    _Citations,
    _nok,
    _note_gap,
    _pct,
)
from app.services.funds.facts import get_profile
from app.services.instruments.facts import list_facts
from app.services.instruments.metrics import (
    CommodityMetrics,
    IncomeMetrics,
    InstrumentMetrics,
    compute_instrument_metrics,
)
from app.services.macro.evidence import add_macro_indicator_evidence
from app.services.research.macro import get_macro_research
from app.services.research.sector import get_sector_research

INCOME_EVIDENCE_PACKET_VERSION = "income-v1"
COMMODITY_EVIDENCE_PACKET_VERSION = "commodity-v1"

INCOME_TOPIC_LABELS: dict[str, str] = {
    "strategy": "Mandate & strategy",
    "credit": "Credit quality & issuers",
    "rates": "Rates, duration & positioning",
    "costs": "Costs & liquidity",
    "risk": "Risks",
}

INCOME_TOPIC_KEYWORDS: dict[str, tuple[tuple[str, float], ...]] = {
    "strategy": (
        ("investment objective", 3), ("investment policy", 3), ("objective", 2), ("mandate", 2),
        ("strategy", 2), ("benchmark", 1.5), ("investeringsmål", 3), ("investerer", 2), ("referanseindeks", 2),
    ),
    "credit": (
        ("credit rating", 3), ("investment grade", 3), ("high yield", 2.5), ("default", 2.5), ("issuer", 2),
        ("kredittrisiko", 3), ("kreditt", 2), ("rating", 1.5), ("covenant", 2), ("subordinated", 2),
        ("utsteder", 2), ("sector allocation", 1.5), ("spread", 1.5),
    ),
    "rates": (
        ("duration", 3), ("renterisiko", 3), ("interest rate", 2.5), ("rentefølsomhet", 3), ("yield to maturity", 3),
        ("effektiv rente", 3), ("maturity", 2), ("løpetid", 2), ("floating", 2), ("flytende", 2),
        ("rate cut", 2), ("rate rise", 2), ("styringsrenten", 2.5), ("central bank", 1.5),
    ),
    "costs": (
        ("ongoing charge", 3), ("management fee", 3), ("forvaltningshonorar", 3), ("fee", 1.5), ("costs", 1.5),
        ("swing pricing", 2), ("svingprising", 2), ("redemption", 2), ("innløsning", 2), ("liquidity", 2),
        ("likviditet", 2), ("tegningsprovisjon", 2),
    ),
    "risk": (
        ("risk indicator", 3), ("risikoklasse", 3), ("key risk", 3), ("risk factor", 3), ("risk", 0.8),
        ("volatil", 1.5), ("drawdown", 2), ("loss", 1), ("risiko", 1), ("counterparty", 2), ("currency risk", 2.5),
    ),
}

COMMODITY_TOPIC_LABELS: dict[str, str] = {
    "structure": "Structure, backing & custody",
    "delivery": "Delivery & redemption",
    "costs": "Costs & pricing",
    "risk": "Risks",
}

COMMODITY_TOPIC_KEYWORDS: dict[str, tuple[tuple[str, float], ...]] = {
    "structure": (
        ("allocated", 3), ("unallocated", 3), ("physical", 2.5), ("bullion", 3), ("custod", 3), ("vault", 3),
        ("secured", 2), ("bearer bond", 3), ("issuer", 2), ("backed", 2), ("gold bar", 3), ("good delivery", 3),
        ("lbma", 2.5), ("sicherheit", 2), ("lagerung", 2),
    ),
    "delivery": (
        ("delivery", 3), ("redeem", 3), ("redemption", 3), ("physical delivery", 3), ("auslieferung", 3),
        ("right to", 1.5), ("holder", 1.5), ("entitle", 2.5), ("gram", 1.5),
    ),
    "costs": (
        ("management fee", 3), ("total expense", 3), ("ongoing charge", 3), ("fee", 1.5), ("storage", 2.5),
        ("spread", 1.5), ("premium", 2), ("discount", 2), ("verwaltungsgebühr", 3), ("kosten", 1.5),
    ),
    "risk": (
        ("risk", 0.8), ("price of gold", 3), ("counterparty", 2.5), ("insolven", 3), ("volatil", 1.5),
        ("currency", 1.5), ("no income", 2), ("does not pay", 2), ("risiko", 1), ("loss", 1),
    ),
}


def _num(value: Decimal | None, unit: str = "") -> str:
    return "unavailable" if value is None else f"{value:,.2f}{unit}"


def _pp(value: Decimal | None) -> str:
    return "unavailable" if value is None else f"{value:+.2f} pp"


def packet_version_for(path: str) -> str:
    return INCOME_EVIDENCE_PACKET_VERSION if path == PATH_INCOME else COMMODITY_EVIDENCE_PACKET_VERSION


def build_instrument_evidence_packet(
    db: Session, holding: Holding, *, research_provider: ResearchProvider
) -> EvidencePacket:
    path = analysis_path(holding.asset_class_raw)
    if path not in (PATH_INCOME, PATH_COMMODITY):
        raise ValueError(f"{holding.asset_class_raw!r} is not an income or commodity instrument")
    settings = get_settings()
    packet = EvidencePacket(holding_id=holding.id, ticker=holding.ticker, version=packet_version_for(path))
    counter = count(1)

    def add(category: str, label: str, content: str, citation: str | None = None) -> EvidenceItem:
        item = EvidenceItem(
            id=f"EV-{next(counter):03d}", category=category, label=label, content=content, citation=citation
        )
        packet.items.append(item)
        return item

    cite = _Citations(db, holding)
    metrics = compute_instrument_metrics(db, holding)
    fund = metrics.fund
    profile = get_profile(db, holding.id)

    add(
        "fund_identity",
        "Instrument identity",
        f"{holding.name} ({holding.ticker}); instrument type: {display_label(holding.asset_class_raw)}; "
        f"sector tag: {holding.sector or 'unspecified'}; trading currency: {holding.trading_currency}.",
    )
    _add_profile(profile, cite, add, packet)
    _add_instrument_facts(db, holding, path, cite, add)
    _add_position(metrics, add)
    _add_cost(fund, profile, cite, add)
    _add_track_record(db, holding, fund, cite, add, packet)
    if path == PATH_INCOME:
        _add_holdings(db, holding, fund, cite, add, packet)
        _add_splits(fund, add)
        if metrics.income is not None:
            _add_income_metrics(metrics.income, add)
    elif metrics.commodity is not None:
        _add_commodity_metrics(metrics.commodity, add)

    packet.unavailable_reasons.extend(f"instrument metrics: {gap}" for gap in metrics.gaps)
    packet.unavailable_reasons.extend(f"fund metrics: {gap}" for gap in _relevant_fund_gaps(fund.gaps, path))

    macro = get_macro_research(db, research_provider)
    _add_research(macro.items, "macro_research", "Macro/geopolitical research", add)
    _note_gap(packet, macro, "macro research")
    add_macro_indicator_evidence(db, add, packet.unavailable_reasons)
    if holding.sector:
        sector = get_sector_research(db, research_provider, sector=holding.sector)
        _add_research(sector.items, "sector_research", f"Sector research ({holding.sector})", add)
        _note_gap(packet, sector, "sector research")
    else:
        packet.unavailable_reasons.append("sector research skipped: holding has no sector set")

    terms: tuple[str, ...] = ()
    if profile and profile.report_name_filter:
        terms = tuple(t.strip() for t in profile.report_name_filter.split(";") if t.strip())
    labels = INCOME_TOPIC_LABELS if path == PATH_INCOME else COMMODITY_TOPIC_LABELS
    keywords = INCOME_TOPIC_KEYWORDS if path == PATH_INCOME else COMMODITY_TOPIC_KEYWORDS
    excerpts = select_document_excerpts(
        db,
        holding,
        token_budget=settings.evidence_document_token_budget,
        max_excerpt_chars=settings.evidence_document_max_excerpt_chars,
        max_documents=settings.evidence_documents_max,
        topic_labels=labels,
        topic_keywords=keywords,
        required_terms=terms,
        extra_boilerplate_text=FUND_BOILERPLATE_TEXT,
    )
    add_document_excerpt_evidence(excerpts, add, topic_labels=labels, prefix=FUND_TEXT_PREFIX)
    if excerpts.reason:
        packet.unavailable_reasons.append(f"document excerpts: {excerpts.reason}")
    return packet


def _relevant_fund_gaps(gaps: list[str], path: str) -> list[str]:
    """The fund metrics' gaps minus the ones that cannot apply: a bond fund
    has no company look-through, a metal has no holdings at all."""
    skip = ("look-through", "overlap") if path == PATH_INCOME else ("holdings", "look-through", "overlap")
    return [g for g in gaps if not any(word in g for word in skip)]


def _add_instrument_facts(db: Session, holding: Holding, path: str, cite: _Citations, add) -> None:
    rows = {row.fact_key: row for row in list_facts(db, holding.id)}
    specs = fact_specs_for(path)
    if not rows:
        add(
            "instrument_facts",
            "Instrument figures",
            "No instrument-specific figures entered (" + ", ".join(s.label.lower() for s in specs[:4]) + ", …). "
            "Yield, credit and rate sensitivity — or backing, custody and delivery — are unknown.",
        )
        return
    for spec in specs:
        row = rows.get(spec.key)
        if row is None:
            continue
        if spec.kind == "number" and row.value_number is not None:
            number = f"{row.value_number:,.4f}".rstrip("0").rstrip(".")
            value = number + (f" {spec.unit}" if spec.unit else "")
        else:
            value = f"{FUND_TEXT_PREFIX}«{row.value_text}»"
        when = f" As of {row.as_of_date.isoformat()}." if row.as_of_date else ""
        add(
            "instrument_facts",
            spec.label,
            f"{value}.{when}".replace("..", "."),
            citation=cite(row.source_document_id, row.source_page),
        )
    missing = [s.label for s in specs if s.key not in rows]
    if missing:
        add("instrument_facts", "Figures not entered", "Not entered: " + ", ".join(missing) + ".")


def _add_position(metrics: InstrumentMetrics, add) -> None:
    if metrics.position_value_nok is None:
        add("fund_overlap", "Position", "Not in the current portfolio snapshot (watched only): no position size.")
        return
    weight = f", {_pct(metrics.portfolio_weight_pct)} of the portfolio" if metrics.portfolio_weight_pct is not None else ""
    add("fund_overlap", "Position (computed)", f"Position held: {_nok(metrics.position_value_nok)}{weight}.")


def _add_income_metrics(m: IncomeMetrics, add) -> None:
    if m.reference_yield_pct is None:
        add(
            "income_metrics",
            "Yield comparison (computed)",
            "No yield entered, so no spread, real yield or fee share can be computed.",
        )
    else:
        lines = [f"Reference yield {_pct(m.reference_yield_pct)} ({m.reference_yield_basis})"]
        if m.fee_share_of_yield_pct is not None:
            lines.append(
                f"the ongoing charge {_pct(m.ongoing_charge_pct)} equals {_pct(m.fee_share_of_yield_pct, 1)} of that yield"
            )
        if m.spread_vs_no_3m_bill_pp is not None:
            lines.append(
                f"spread over the Norway 3-month T-bill ({_pct(m.no_3m_bill_pct)}): {_pp(m.spread_vs_no_3m_bill_pp)}"
            )
        if m.spread_vs_no_10y_pp is not None:
            lines.append(
                f"spread over the Norway 10-year government yield ({_pct(m.no_10y_pct)}): {_pp(m.spread_vs_no_10y_pp)}"
            )
        if m.real_yield_pp is not None:
            lines.append(f"real yield after Norway CPI ({_pct(m.no_cpi_pct)}): {_pp(m.real_yield_pp)}")
        add(
            "income_metrics",
            "Yield comparison (computed)",
            "; ".join(lines) + ". Spreads compare the fund's stated yield with market yields as published; "
            "they are not risk-adjusted.",
        )
    if m.effective_duration_years is None:
        add("income_metrics", "Rate sensitivity (computed)", "No duration entered, so no rate sensitivity is computed.")
    else:
        shocks = "; ".join(
            f"a {s.change_pp:+} pp parallel rate move changes the price by about {s.price_effect_pct:+.2f}%"
            for s in m.rate_shocks
        )
        be = (
            f" One year of yield offsets a rate rise of about {_num(m.breakeven_rate_rise_pp)} pp "
            f"(yield ÷ duration)."
            if m.breakeven_rate_rise_pp is not None
            else ""
        )
        add(
            "income_metrics",
            "Rate sensitivity (computed)",
            f"Effective duration {_num(m.effective_duration_years)} years: {shocks}. First-order approximation "
            f"(−duration × rate change; ignores convexity and spread moves).{be}",
        )
    credit = []
    if m.average_credit_rating:
        credit.append(f"average rating as stated by the fund: {m.average_credit_rating}")
    if m.high_yield_share_pct is not None:
        credit.append(f"{_pct(m.high_yield_share_pct, 1)} below investment grade")
    if credit:
        add("income_metrics", "Credit quality (typed in)", "; ".join(credit) + ".")


def _add_commodity_metrics(m: CommodityMetrics, add) -> None:
    if m.carry_hurdles:
        hurdles = "; ".join(f"over {h.years} years the metal must rise {_pct(h.required_rise_pct, 1)}" for h in m.carry_hurdles)
        add(
            "commodity_metrics",
            "Carry hurdle (computed)",
            f"A metal pays no interest. To merely match holding Norway's 3-month T-bill ({_pct(m.no_3m_bill_pct)}) "
            f"after the ongoing charge ({_pct(m.ongoing_charge_pct)}) — {hurdles} in NOK terms "
            "((1 + bill rate)^years ÷ (1 − charge)^years − 1, bill rate held constant; ignores tax and currency moves).",
        )
    else:
        add("commodity_metrics", "Carry hurdle (computed)", "Not computable: needs the ongoing charge and the Norway 3-month T-bill yield.")
    if m.premium_discount_pct is not None:
        side = "premium" if m.premium_discount_pct > 0 else "discount" if m.premium_discount_pct < 0 else "no premium"
        add(
            "commodity_metrics",
            "Premium / discount to the metal (computed)",
            f"Market price {_num(m.market_price_per_unit)} against metal value per unit {_num(m.nav_per_unit)}: "
            f"{_pct(m.premium_discount_pct)} ({side}).",
        )
