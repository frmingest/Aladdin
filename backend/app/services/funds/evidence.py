"""The fund evidence packet (Sprint 8, F9) — what the fund_v1 blind and
reconciliation passes reason over and cite.

Same contract as the single-company packet
(app/services/analysis/evidence_packet.py): every number is computed in
Python first (app/services/funds/metrics.py, CLAUDE.md Rule 1), every item
has an EV-### id the output must cite (Rule 2), and issuer text is quoted
as data (Rule 5). Typed-in figures cite the document and page they were
read from.

Deliberately left out: company research (a Gemini search on a fund ticker
returns marketing; the look-through companies carry their own analyses)
and any DCF (a fund has no owner earnings of its own). Macro and sector
research are reused.
"""
from __future__ import annotations

import uuid
from collections.abc import Callable
from decimal import Decimal
from itertools import count

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.domain.instrument_types import display_label
from app.models.document import Document
from app.models.holding import Holding
from app.providers.base import ResearchProvider
from app.services.analysis.document_excerpts import (
    add_document_excerpt_evidence,
    select_document_excerpts,
)
from app.services.analysis.evidence_packet import EvidenceItem, EvidencePacket
from app.services.funds.facts import get_profile, latest_exposures, list_returns
from app.services.funds.metrics import FundMetrics, compute_fund_metrics
from app.services.research.macro import get_macro_research
from app.services.research.sector import get_sector_research

# fund-v1 (2026-09-24, Sprint 8): first fund / ETF packet.
FUND_EVIDENCE_PACKET_VERSION = "fund-v1"
TOP_HOLDINGS_IN_PACKET = 15

FUND_TOPIC_LABELS: dict[str, str] = {
    "strategy": "Mandate & strategy",
    "costs": "Costs & tracking",
    "risk": "Risks",
    "manager_view": "Manager's view & portfolio changes",
    "holdings_quality": "Underlying companies",
}

FUND_TOPIC_KEYWORDS: dict[str, tuple[tuple[str, float], ...]] = {
    "strategy": (
        ("investment objective", 3), ("objective", 2), ("investment policy", 3), ("strategy", 2),
        ("mandate", 2), ("aims to", 2), ("seeks to", 2), ("index methodology", 3), ("index description", 3),
        ("constituents", 1.5), ("selection", 1.5), ("universe", 1.5), ("exclu", 1.5), ("screen", 1.5),
        ("replication", 2), ("investeringsmål", 3), ("investerer", 2), ("strategi", 2), ("aktivt", 1.5),
        ("referanseindeks", 2), ("benchmark", 1.5),
    ),
    "costs": (
        ("ongoing charge", 3), ("management fee", 3), ("total expense", 3), ("fee", 1.5), ("costs", 1.5),
        ("tracking difference", 3), ("tracking error", 3), ("securities lending", 2.5), ("transaction cost", 2.5),
        ("turnover", 2), ("swing pricing", 2), ("svingprising", 2), ("forvaltningshonorar", 3),
        ("tegningsprovisjon", 2), ("innløsningsprovisjon", 2), ("kostnad", 1.5),
    ),
    "risk": (
        ("risk indicator", 3), ("risikoklasse", 3), ("key risk", 3), ("risk factor", 3), ("risk", 0.8),
        ("volatil", 1.5), ("concentration", 2), ("currency risk", 2.5), ("exchange rate", 1.5),
        ("counterparty", 2), ("liquidity", 1.5), ("derivative", 1.5), ("price of gold", 2), ("commodity", 1.5),
        ("drawdown", 2), ("loss", 1), ("risiko", 1), ("svingning", 1.5),
    ),
    "manager_view": (
        ("we expect", 2), ("we believe", 2), ("we see", 1.5), ("outlook", 2.5), ("vi vurderer", 2.5),
        ("vi forventer", 2.5), ("contribut", 1.5), ("bidrag", 1.5), ("bidro", 1.5), ("new position", 2.5),
        ("etablerte", 2), ("sold", 1.5), ("solgte", 2), ("reduced", 1.5), ("reduserte", 2), ("increased", 1),
        ("valuation", 1.5), ("prising", 2), ("attractive", 1.5), ("attraktiv", 2), ("underweight", 2),
        ("overweight", 2), ("direkteavkastning", 2),
    ),
    "holdings_quality": (
        ("market position", 2.5), ("competitive", 2), ("margin", 1.5), ("return on equity", 2.5),
        ("egenkapitalavkastning", 2.5), ("earnings", 1.5), ("resultat", 1), ("dividend", 1.5), ("utbytte", 1.5),
        ("cash flow", 1.5), ("balance sheet", 1.5), ("all-in sustaining", 3), ("aisc", 3), ("production", 1),
        ("reserves", 2), ("growth", 1), ("kontrakt", 1.5), ("contract", 1),
    ),
}

FUND_BOILERPLATE_TEXT: tuple[str, ...] = (
    "vi gir ingen anbefalinger",
    "historisk avkastning er ingen garanti",
    "no investment advice:",
    "index disclaimer",
    "for german investors",
    "for austrian investors",
    "united states information",
    "for singaporean investors",
    "this document is not, and under no circumstances",
    "not been registered as a prospectus",
    "monetary authority of singapore",
)

FUND_TEXT_PREFIX = (
    "Fund-manager / issuer-written text, quoted as data (marketing or the manager's own claims, "
    "not verified facts): "
)


def _pct(value: Decimal | None, places: int = 2) -> str:
    return "unavailable" if value is None else f"{value:.{places}f}%"


def _pp(value: Decimal | None) -> str:
    return "unavailable" if value is None else f"{value:+.2f} pp"


def _nok(value: Decimal | None) -> str:
    return "unavailable" if value is None else f"NOK {value:,.0f}"


class _Citations:
    def __init__(self, db: Session, holding: Holding):
        self._docs = {
            d.id: d for d in db.scalars(select(Document).where(Document.holding_id == holding.id))
        }

    def __call__(self, document_id: uuid.UUID | None, page: int | None = None) -> str | None:
        document = self._docs.get(document_id) if document_id else None
        if document is None:
            return None
        where = f", p. {page}" if page else ""
        period = f", {document.reporting_period}" if document.reporting_period else ""
        return f"Uploaded {document.type.replace('_', ' ')} '{document.original_filename}'{period}{where}"


def build_fund_evidence_packet(
    db: Session, holding: Holding, *, research_provider: ResearchProvider
) -> EvidencePacket:
    settings = get_settings()
    packet = EvidencePacket(holding_id=holding.id, ticker=holding.ticker, version=FUND_EVIDENCE_PACKET_VERSION)
    counter = count(1)

    def add(category: str, label: str, content: str, citation: str | None = None) -> EvidenceItem:
        item = EvidenceItem(
            id=f"EV-{next(counter):03d}", category=category, label=label, content=content, citation=citation
        )
        packet.items.append(item)
        return item

    cite = _Citations(db, holding)
    metrics = compute_fund_metrics(db, holding)
    profile = get_profile(db, holding.id)

    identity = (
        f"{holding.name} ({holding.ticker}); instrument type: {display_label(holding.asset_class_raw)}; "
        f"sector tag: {holding.sector or 'unspecified'}; trading currency: {holding.trading_currency}."
    )
    add("fund_identity", "Fund identity", identity)

    _add_profile(profile, cite, add, packet)
    _add_cost(metrics, profile, cite, add)
    _add_track_record(db, holding, metrics, cite, add, packet)
    _add_holdings(db, holding, metrics, cite, add, packet)
    _add_splits(metrics, add)
    _add_look_through(metrics, add)
    _add_overlap(metrics, add)
    packet.unavailable_reasons.extend(f"fund metrics: {gap}" for gap in metrics.gaps)

    macro = get_macro_research(db, research_provider)
    _add_research(macro.items, "macro_research", "Macro/geopolitical research", add)
    _note_gap(packet, macro, "macro research")
    if holding.sector:
        sector = get_sector_research(db, research_provider, sector=holding.sector)
        _add_research(sector.items, "sector_research", f"Sector research ({holding.sector})", add)
        _note_gap(packet, sector, "sector research")
    else:
        packet.unavailable_reasons.append("sector research skipped: holding has no sector set")

    terms: tuple[str, ...] = ()
    if profile and profile.report_name_filter:
        terms = tuple(t.strip() for t in profile.report_name_filter.split(";") if t.strip())
    excerpts = select_document_excerpts(
        db,
        holding,
        token_budget=settings.evidence_document_token_budget,
        max_excerpt_chars=settings.evidence_document_max_excerpt_chars,
        max_documents=settings.evidence_documents_max,
        topic_labels=FUND_TOPIC_LABELS,
        topic_keywords=FUND_TOPIC_KEYWORDS,
        required_terms=terms,
        extra_boilerplate_text=FUND_BOILERPLATE_TEXT,
    )
    add_document_excerpt_evidence(excerpts, add, topic_labels=FUND_TOPIC_LABELS, prefix=FUND_TEXT_PREFIX)
    if excerpts.reason:
        packet.unavailable_reasons.append(f"document excerpts: {excerpts.reason}")
    return packet


def _note_gap(packet: EvidencePacket, snapshot, label: str) -> None:
    if not snapshot.available:
        packet.unavailable_reasons.append(f"{label} unavailable: {snapshot.reason}")
    elif snapshot.reason:
        packet.unavailable_reasons.append(f"{label}: {snapshot.reason}")


def _add_research(items, category: str, prefix: str, add: Callable) -> None:
    if not items:
        add(category, prefix, "No research items currently available.")
        return
    for item in items:
        add(category, f"{prefix}: {item.title}", item.summary, citation=f"{item.source_name} — {item.source_url}")


def _add_profile(profile, cite: _Citations, add: Callable, packet: EvidencePacket) -> None:
    if profile is None:
        add("fund_profile", "Fund profile", "No fund profile entered: management style, benchmark, cost and "
            "structure are unknown.")
        return
    parts = [
        f"management style: {profile.management_style}",
        f"benchmark: {profile.benchmark_name or 'none stated'}",
    ]
    for label, value in (
        ("domicile", profile.domicile),
        ("base currency", profile.base_currency),
        ("replication", profile.replication),
        ("distribution", profile.distribution),
        ("inception", profile.inception_date.isoformat() if profile.inception_date else None),
        ("summary risk indicator (1-7)", profile.risk_class),
        ("holdings stated by the fund", profile.holdings_count),
        ("performance fee", profile.performance_fee),
    ):
        if value is not None:
            parts.append(f"{label}: {value}")
    if profile.fund_size is not None:
        parts.append(f"fund size: {profile.fund_size:,.0f} {profile.fund_size_currency or ''}".rstrip())
    as_of = f" As of {profile.as_of_date.isoformat()}." if profile.as_of_date else ""
    add(
        "fund_profile",
        "Fund structure and mandate",
        "; ".join(parts) + "." + as_of,
        citation=cite(profile.source_document_id, profile.source_page),
    )
    if profile.strategy_summary:
        add(
            "fund_profile",
            "Stated investment objective (fund's own words)",
            f"{FUND_TEXT_PREFIX}«{' '.join(profile.strategy_summary.split())}»",
            citation=cite(profile.source_document_id, profile.source_page),
        )


def _add_cost(metrics: FundMetrics, profile, cite: _Citations, add: Callable) -> None:
    cost = metrics.cost
    if cost.ongoing_charge_pct is None:
        add("fund_cost", "Cost", "Ongoing charge not entered — the fee drag cannot be assessed.")
        return
    drag = "; ".join(f"over {years} years {value}% of ending wealth" for years, value in cost.fee_drag_pct.items())
    held = (
        f" On the position held, that is about {_nok(cost.yearly_fee_nok)} per year."
        if cost.yearly_fee_nok is not None
        else ""
    )
    add(
        "fund_cost",
        "Ongoing charge and its compounding drag (computed)",
        f"Ongoing charge {_pct(cost.ongoing_charge_pct)} per year. Compounded, the fee alone takes {drag} "
        f"(1 − (1 − fee)^years, before any tracking or trading costs).{held}",
        citation=cite(profile.source_document_id, profile.source_page) if profile else None,
    )


def _add_track_record(db, holding, metrics: FundMetrics, cite: _Citations, add: Callable, packet) -> None:
    track = metrics.track_record
    if not track.rows:
        add("fund_track_record", "Track record", "No reported returns entered.")
        return
    periods = {p.id: p for p in list_returns(db, holding.id)}
    lines = []
    sources: list[str] = []
    for row in track.rows:
        bench = f" vs benchmark {_pct(row.benchmark_return_pct)}" if row.benchmark_return_pct is not None else ""
        diff = f" ({track.gap_label} {_pp(row.difference_pp)})" if row.difference_pp is not None else ""
        ann = ""
        if row.annualised_difference_pp is not None and row.period_kind in ("trailing", "since_inception"):
            ann = (
                f"; annualised {_pct(row.fund_annualised_pct)} vs {_pct(row.benchmark_annualised_pct)}, "
                f"{_pp(row.annualised_difference_pp)} per year"
            )
        name = f" [{row.benchmark_name}]" if row.benchmark_name else ""
        lines.append(f"{row.period_label} ({row.period_kind}): fund {_pct(row.fund_return_pct)}{bench}{name}{diff}{ann}")
        source = periods.get(row.id)
        citation = cite(source.source_document_id, source.source_page) if source else None
        if citation and citation not in sources:
            sources.append(citation)
    add(
        "fund_track_record",
        "Reported returns vs benchmark (differences computed)",
        "; ".join(lines) + ".",
        citation="; ".join(sources) or None,
    )
    summary = []
    if track.one_year_periods_compared:
        summary.append(
            f"beat the benchmark in {track.one_year_periods_beaten} of {track.one_year_periods_compared} one-year "
            f"periods, average {track.gap_label} {_pp(track.average_one_year_difference_pp)}"
        )
    if track.longest_period_label:
        summary.append(
            f"over the longest comparable period ({track.longest_period_label}) the annualised {track.gap_label} "
            f"is {_pp(track.longest_period_annualised_difference_pp)} per year"
        )
    if summary:
        add("fund_track_record", f"Track record summary ({track.gap_label}, computed)", "; ".join(summary) + ".")


def _add_holdings(db, holding, metrics: FundMetrics, cite: _Citations, add: Callable, packet) -> None:
    c = metrics.concentration
    if c.rows_known == 0:
        add("fund_holdings", "Holdings", "No holdings entered or imported — what the fund owns is unknown.")
        return
    _as_of, rows = latest_exposures(db, holding.id, "holding")
    stated = f" of {c.stated_holdings_count} the fund states" if c.stated_holdings_count else ""
    if c.complete:
        spread = f"HHI {c.hhi}, effective number of holdings {c.effective_holdings}"
    else:
        spread = (
            f"HHI at least {c.hhi} (the list is partial; the unlisted rest can only add to it, so no "
            "effective number of holdings is computed)"
        )
    add(
        "fund_concentration",
        "Concentration (computed)",
        f"As of {c.as_of_date}: {c.rows_known} holdings known{stated}, covering {_pct(c.coverage_pct)} of the fund. "
        f"Top 10 = {_pct(c.top10_pct)}; largest {c.largest.label if c.largest else '?'} "
        f"{_pct(c.largest.weight_pct if c.largest else None)}. {spread}.",
        citation=cite(rows[0].source_document_id) if rows else None,
    )
    by_id = {h.exposure_id: h for h in metrics.look_through.holdings}
    lines = []
    for row in rows[:TOP_HOLDINGS_IN_PACKET]:
        info = by_id.get(row.id)
        extra = []
        if info and info.linked_ticker:
            extra.append(f"in app as {info.linked_ticker}")
            if info.moat_rating:
                extra.append(f"own analysis: {info.moat_rating} moat, {info.verdict_rating}")
        lines.append(f"{row.label} {_pct(row.weight_pct)}" + (f" ({'; '.join(extra)})" if extra else ""))
    more = f" … and {len(rows) - TOP_HOLDINGS_IN_PACKET} more" if len(rows) > TOP_HOLDINGS_IN_PACKET else ""
    add(
        "fund_holdings",
        f"Largest holdings as of {c.as_of_date}",
        "; ".join(lines) + more + ".",
        citation=cite(rows[0].source_document_id, rows[0].source_page) if rows else None,
    )


def _add_splits(metrics: FundMetrics, add: Callable) -> None:
    for split in metrics.exposures:
        add(
            "fund_exposure",
            f"{split.dimension.capitalize()} split as of {split.as_of_date}",
            ", ".join(f"{r.label} {_pct(r.weight_pct, 1)}" for r in split.rows) + f" (total {_pct(split.total_pct, 1)}).",
        )
    if metrics.foreign_currency_pct is not None:
        add(
            "fund_exposure",
            "Currency exposure for a NOK investor (computed)",
            f"{_pct(metrics.foreign_currency_pct, 1)} of the fund is in currencies other than NOK.",
        )


def _add_look_through(metrics: FundMetrics, add: Callable) -> None:
    look = metrics.look_through
    if not look.holdings:
        return
    parts = []
    for m in look.metrics:
        if m.value is not None:
            parts.append(f"{m.label}: {m.value} (from {m.holdings_used} holdings = {_pct(m.coverage_pct)} of the fund)")
    if parts:
        add(
            "fund_look_through",
            "Look-through business quality (weighted, computed from the companies' own figures)",
            "; ".join(parts) + ". Weighted by fund weight over the covered holdings only.",
        )
    else:
        add(
            "fund_look_through",
            "Look-through business quality",
            f"Not computable: {_pct(look.linked_weight_pct)} of the fund is linked to companies in the app, and none "
            "of those have financial figures uploaded.",
        )
    if look.moat_mix:
        mix = ", ".join(f"{rating}: {_pct(weight, 1)}" for rating, weight in sorted(look.moat_mix.items()))
        verdicts = ", ".join(f"{rating}: {_pct(weight, 1)}" for rating, weight in sorted(look.verdict_mix.items()))
        add(
            "fund_look_through",
            "Moat and verdict of holdings already analysed in the app",
            f"By fund weight — moat: {mix}. Verdicts: {verdicts}. The rest of the fund has no analysis.",
        )


def _add_overlap(metrics: FundMetrics, add: Callable) -> None:
    overlap = metrics.overlap
    if overlap.fund_value_nok is None:
        add("fund_overlap", "Position and overlap", "This fund is not in the current portfolio snapshot (watched only).")
        return
    if not overlap.rows:
        add(
            "fund_overlap",
            "Position and overlap (computed)",
            f"Position in this fund: {_nok(overlap.fund_value_nok)}. None of its known holdings is also owned directly.",
        )
        return
    lines = ", ".join(
        f"{h.label}: {_nok(h.through_fund_value_nok)} through the fund + {_nok(h.direct_value_nok)} directly"
        for h in overlap.rows
    )
    add(
        "fund_overlap",
        "Overlap with stocks owned directly (computed)",
        f"Position in this fund: {_nok(overlap.fund_value_nok)}. Also owned directly: {lines}. "
        f"Total held twice through the fund: {_nok(overlap.total_through_fund_nok)}.",
    )
