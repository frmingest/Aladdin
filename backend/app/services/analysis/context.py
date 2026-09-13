"""
Evidence packet / AnalysisContext builder (architecture §5.3, §26 Phase 3).

Builds the deterministic context an LLM analysis reasons over. Nothing here
calls an LLM — this module only reads already-persisted, already-computed
data (documents, financial facts, market/FX observations, prior analyses)
and assembles it into one structured object, so the analysis stays
evidence-first (§2.1): the LLM never queries arbitrary application state
directly, and every item handed to it is traceable back to a source (§5.2).

Macro snapshot and sector research (§9.1-§9.3) are now populated from
whatever app.services.research has persisted (§26 Phase 4) — real data when
a refresh has run, an explicit `available=False` `UnavailableSection`
otherwise (§21: never present missing data as if it simply doesn't apply).
Both are also added as citable EvidenceItems alongside document/financial/
market evidence, reusing the existing generic evidence-citation mechanism
(§28 rule 8 in spirit: no LLM-output-schema or prompt-version change needed
for the model to be able to cite them — see docs/decisions/0007).
`recent_events` remains unbuilt this phase — the macro/sector narrative
items partially cover that need, but a dedicated event-detection feature is
a deliberate, documented follow-up (see docs/PROGRESS.md's known gaps).
"""

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.domain import calculations as calc
from app.models.analysis import AnalysisRun, AnalysisRunStatus, HoldingAnalysis
from app.models.document import Document, DocumentChunk, DocumentStatus
from app.models.financial_fact import FinancialLineItem
from app.models.holding import Holding
from app.models.market_data import FxObservation, MarketObservation
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.services.research.macro import MacroSnapshotView, get_latest_macro_snapshot
from app.services.research.sector import SectorResearchView, get_latest_sector_research
from app.services.thesis.service import format_thesis_for_context, get_active_thesis


@dataclass
class EvidenceItem:
    evidence_id: str
    source_type: str  # document_chunk | financial_line_item | market_observation
    source_id: str
    page_start: int | None
    page_end: int | None
    section: str | None
    label: str  # short, always-safe-to-show description
    content: str | None = None  # full excerpt text — only set for document_chunk


@dataclass
class UnavailableSection:
    available: bool = False
    reason: str = "not yet implemented"


@dataclass
class FinancialMetricsSnapshot:
    latest_period: str | None
    previous_period: str | None
    revenue_growth_pct: Decimal | None
    ebitda_margin_pct: Decimal | None
    net_income_margin_pct: Decimal | None
    return_on_equity_pct: Decimal | None
    facts_considered: int
    insufficient_data: bool


@dataclass
class MarketSnapshot:
    price: Decimal | None
    price_currency: str | None
    observed_at: datetime | None
    data_status: str  # current | delayed | stale | unavailable
    fx_rate_to_reporting: Decimal | None
    reporting_currency: str


@dataclass
class PreviousAnalysisSummary:
    analysis_run_id: str
    completed_at: datetime | None
    executive_summary: str
    thesis_status: str
    overall_score: Decimal | None


@dataclass
class AnalysisContext:
    holding_id: UUID
    portfolio_snapshot_id: UUID
    ticker: str
    name: str
    asset_class: str
    sector: str | None
    trading_currency: str

    weight_pct: Decimal | None
    quantity: Decimal | None
    cost_basis: Decimal | None
    cost_basis_currency: str | None

    financial_metrics: FinancialMetricsSnapshot
    market: MarketSnapshot
    evidence_items: list[EvidenceItem]
    excerpts_truncated: bool

    macro_snapshot: MacroSnapshotView | UnavailableSection
    sector_research: SectorResearchView | UnavailableSection
    recent_events: UnavailableSection

    previous_analysis: PreviousAnalysisSummary | None

    # Deliberately last and separate from everything above: the blind pass
    # (app.services.analysis.llm_analysis) must not receive this field at
    # all (§11.3) — only the reconciliation pass does.
    user_notes: str | None = field(default=None)


class InsufficientContextError(Exception):
    """Raised when a holding has no basis at all for an analysis (no
    documents, no financial facts, no market data) — running an LLM over
    nothing would only invite fabrication (§28 rule 10)."""

    def __init__(self, holding_id: UUID):
        self.holding_id = holding_id
        super().__init__(
            f"holding '{holding_id}' has no documents, financial facts, or market data on record — "
            "nothing to analyze"
        )


def build_analysis_context(db: Session, holding_id: UUID, portfolio_snapshot_id: UUID) -> AnalysisContext:
    settings = get_settings()

    holding = db.get(Holding, holding_id)
    if holding is None:
        raise ValueError(f"holding '{holding_id}' not found")

    position = (
        db.query(PortfolioPosition)
        .filter(
            PortfolioPosition.snapshot_id == portfolio_snapshot_id,
            PortfolioPosition.holding_id == holding_id,
        )
        .one_or_none()
    )

    financial_metrics = _build_financial_metrics(db, holding_id)
    market = _build_market_snapshot(db, holding, portfolio_snapshot_id, settings.default_reporting_currency)
    evidence_items, excerpts_truncated = _build_document_evidence(
        db, holding_id, settings.llm_excerpt_char_budget
    )
    evidence_items = _add_metric_evidence(db, holding_id, evidence_items)

    macro_snapshot = get_latest_macro_snapshot(db)
    sector_research = (
        get_latest_sector_research(db, holding.sector)
        if holding.sector
        else SectorResearchView(available=False, sector="", as_of=None, reason="holding has no sector assigned")
    )
    evidence_items = _add_research_evidence(evidence_items, macro_snapshot, sector_research)

    previous_analysis = _build_previous_analysis(db, holding_id)

    if not evidence_items and financial_metrics.insufficient_data and market.data_status == "unavailable":
        raise InsufficientContextError(holding_id)

    return AnalysisContext(
        holding_id=holding_id,
        portfolio_snapshot_id=portfolio_snapshot_id,
        ticker=holding.ticker,
        name=holding.name,
        asset_class=holding.asset_class,
        sector=holding.sector,
        trading_currency=holding.trading_currency,
        weight_pct=position.weight_pct if position else None,
        quantity=position.quantity if position else None,
        cost_basis=position.cost_basis if position else None,
        cost_basis_currency=position.cost_basis_currency if position else None,
        financial_metrics=financial_metrics,
        market=market,
        evidence_items=evidence_items,
        excerpts_truncated=excerpts_truncated,
        macro_snapshot=macro_snapshot,
        sector_research=sector_research,
        recent_events=UnavailableSection(reason="not built this phase — see docs/PROGRESS.md known gaps"),
        previous_analysis=previous_analysis,
        user_notes=_build_user_notes(db, holding_id, position),
    )


def _build_user_notes(db: Session, holding_id: UUID, position: PortfolioPosition | None) -> str | None:
    """§26 Phase 5 / decision 0008: the investment thesis ledger
    (app.models.thesis.InvestmentThesis) replaces PortfolioPosition.notes as
    the "existing thesis" the §11.3 reconciliation guardrail compares the
    blind assessment against — a thesis row carries the bull/bear case and
    invalidation conditions §16 wants the LLM to actually see, not just a
    free-text notes field. Falls back to position.notes when the holding has
    no ACTIVE/UNDER_REVIEW thesis on record yet, so a holding analyzed
    before its thesis ledger was ever populated doesn't lose the guardrail
    entirely."""
    thesis = get_active_thesis(db, holding_id)
    if thesis is not None:
        return format_thesis_for_context(thesis)
    return position.notes if position else None


def _build_financial_metrics(db: Session, holding_id: UUID) -> FinancialMetricsSnapshot:
    facts = db.query(FinancialLineItem).filter(FinancialLineItem.holding_id == holding_id).all()
    if not facts:
        return FinancialMetricsSnapshot(
            latest_period=None,
            previous_period=None,
            revenue_growth_pct=None,
            ebitda_margin_pct=None,
            net_income_margin_pct=None,
            return_on_equity_pct=None,
            facts_considered=0,
            insufficient_data=True,
        )

    by_period: dict[str, dict[str, Decimal]] = defaultdict(dict)
    for fact in facts:
        by_period[fact.period][fact.metric] = fact.value

    # Lexical sort of period labels — a real limitation (e.g. "FY9" would
    # sort after "FY10"), acceptable for now since Phase 1's canonical
    # metrics table only has a small, controlled label set; see decision 0006.
    periods_sorted = sorted(by_period.keys())
    latest_period = periods_sorted[-1]
    previous_period = periods_sorted[-2] if len(periods_sorted) > 1 else None

    latest = by_period[latest_period]
    previous = by_period.get(previous_period, {}) if previous_period else {}

    revenue_growth = calc.growth_rate(latest.get("revenue"), previous.get("revenue")) if previous_period else None
    ebitda_margin = calc.margin_pct(latest.get("ebitda"), latest.get("revenue"))
    net_income_margin = calc.margin_pct(latest.get("net_income"), latest.get("revenue"))
    roe = calc.return_on_equity(latest.get("net_income"), latest.get("total_equity"))

    return FinancialMetricsSnapshot(
        latest_period=latest_period,
        previous_period=previous_period,
        revenue_growth_pct=calc.quantize(revenue_growth, places=calc.PERCENT_PLACES),
        ebitda_margin_pct=calc.quantize(ebitda_margin, places=calc.PERCENT_PLACES),
        net_income_margin_pct=calc.quantize(net_income_margin, places=calc.PERCENT_PLACES),
        return_on_equity_pct=calc.quantize(roe, places=calc.PERCENT_PLACES),
        facts_considered=len(facts),
        insufficient_data=False,
    )


def _build_market_snapshot(
    db: Session, holding: Holding, snapshot_id: UUID, default_reporting_currency: str
) -> MarketSnapshot:
    snapshot = db.get(PortfolioSnapshot, snapshot_id)
    reporting_currency = snapshot.reporting_currency if snapshot else default_reporting_currency

    latest_obs = (
        db.query(MarketObservation)
        .filter(MarketObservation.holding_id == holding.id)
        .order_by(MarketObservation.observed_at.desc())
        .first()
    )
    if latest_obs is None:
        return MarketSnapshot(
            price=None,
            price_currency=None,
            observed_at=None,
            data_status="unavailable",
            fx_rate_to_reporting=None,
            reporting_currency=reporting_currency,
        )

    fx_rate = None
    if latest_obs.currency.upper() != reporting_currency.upper():
        fx_obs = (
            db.query(FxObservation)
            .filter(
                FxObservation.from_currency == latest_obs.currency.upper(),
                FxObservation.to_currency == reporting_currency.upper(),
            )
            .order_by(FxObservation.observed_at.desc())
            .first()
        )
        fx_rate = fx_obs.rate if fx_obs else None
    else:
        fx_rate = Decimal("1")

    return MarketSnapshot(
        price=latest_obs.price,
        price_currency=latest_obs.currency,
        observed_at=latest_obs.observed_at,
        data_status=latest_obs.data_status,
        fx_rate_to_reporting=fx_rate,
        reporting_currency=reporting_currency,
    )


def _build_document_evidence(
    db: Session, holding_id: UUID, char_budget: int
) -> tuple[list[EvidenceItem], bool]:
    """Most-recently-uploaded documents first, all their chunks in page
    order, until `char_budget` is exhausted. No relevance ranking yet — see
    decision 0006 — this only bounds prompt size/cost deterministically."""
    documents = (
        db.query(Document)
        .filter(
            Document.holding_id == holding_id,
            Document.status.in_([DocumentStatus.PROCESSED.value, DocumentStatus.VALIDATED.value]),
        )
        .order_by(Document.uploaded_at.desc())
        .all()
    )

    items: list[EvidenceItem] = []
    used_chars = 0
    truncated = False
    counter = 1

    for document in documents:
        if used_chars >= char_budget:
            truncated = True
            break
        chunks = (
            db.query(DocumentChunk)
            .filter(DocumentChunk.document_id == document.id)
            .order_by(DocumentChunk.page_start)
            .all()
        )
        for chunk in chunks:
            if used_chars >= char_budget:
                truncated = True
                break
            remaining = char_budget - used_chars
            if len(chunk.content) > remaining:
                truncated = True
            content = chunk.content[:remaining]
            used_chars += len(content)
            items.append(
                EvidenceItem(
                    evidence_id=f"E{counter}",
                    source_type="document_chunk",
                    source_id=str(chunk.id),
                    page_start=chunk.page_start,
                    page_end=chunk.page_end,
                    section=chunk.section,
                    label=f"{document.original_filename} (p.{chunk.page_start}-{chunk.page_end})",
                    content=content,
                )
            )
            counter += 1

    return items, truncated


def _add_metric_evidence(db: Session, holding_id: UUID, items: list[EvidenceItem]) -> list[EvidenceItem]:
    """Adds citable evidence entries for the deterministic facts already
    surfaced in `financial_metrics`/`market` — so the model can reference
    e.g. "E12" for a specific reported revenue figure, not just prose."""
    counter = len(items) + 1

    facts = db.query(FinancialLineItem).filter(FinancialLineItem.holding_id == holding_id).all()
    for fact in facts:
        items.append(
            EvidenceItem(
                evidence_id=f"E{counter}",
                source_type="financial_line_item",
                source_id=str(fact.id),
                page_start=fact.source_page,
                page_end=fact.source_page,
                section=None,
                label=f"{fact.metric} = {fact.value} {fact.unit} ({fact.period})",
            )
        )
        counter += 1

    latest_obs = (
        db.query(MarketObservation)
        .filter(MarketObservation.holding_id == holding_id)
        .order_by(MarketObservation.observed_at.desc())
        .first()
    )
    if latest_obs is not None:
        items.append(
            EvidenceItem(
                evidence_id=f"E{counter}",
                source_type="market_observation",
                source_id=str(latest_obs.id),
                page_start=None,
                page_end=None,
                section=None,
                label=(
                    f"price {latest_obs.price} {latest_obs.currency} @ "
                    f"{latest_obs.observed_at.isoformat()} ({latest_obs.data_status})"
                ),
            )
        )

    return items


def _add_research_evidence(
    items: list[EvidenceItem],
    macro_snapshot: MacroSnapshotView | UnavailableSection,
    sector_research: SectorResearchView | UnavailableSection,
) -> list[EvidenceItem]:
    """Adds Phase 4 macro/sector research as citable evidence, exactly like
    _add_metric_evidence does for deterministic facts — same evidence_id
    numbering, same generic citation mechanism the persona prompt already
    describes ("a numbered list of evidence items"), so no prompt-version
    bump is needed for the model to be able to reference these (decision
    0007)."""
    counter = len(items) + 1

    if isinstance(macro_snapshot, MacroSnapshotView) and macro_snapshot.available:
        for obs in macro_snapshot.observations:
            items.append(
                EvidenceItem(
                    evidence_id=f"E{counter}",
                    source_type="macro_observation",
                    source_id=obs.series_key,
                    page_start=None,
                    page_end=None,
                    section=None,
                    label=(
                        f"{obs.series_key} = {obs.value}{obs.unit} "
                        f"({obs.region}, {obs.provider}, as of {obs.observed_at.date().isoformat()})"
                    ),
                )
            )
            counter += 1
        for news_item in macro_snapshot.narrative_items:
            items.append(
                EvidenceItem(
                    evidence_id=f"E{counter}",
                    source_type="research_item",
                    source_id=news_item.source_url,
                    page_start=None,
                    page_end=None,
                    section=None,
                    label=f"[macro news, {news_item.source_name}] {news_item.title}",
                    content=news_item.summary,
                )
            )
            counter += 1

    if isinstance(sector_research, SectorResearchView) and sector_research.available:
        for sector_item in sector_research.items:
            items.append(
                EvidenceItem(
                    evidence_id=f"E{counter}",
                    source_type="research_item",
                    source_id=sector_item.source_url,
                    page_start=None,
                    page_end=None,
                    section=None,
                    label=f"[{sector_research.sector} sector research, {sector_item.source_name}] {sector_item.title}",
                    content=sector_item.summary,
                )
            )
            counter += 1

    return items


def _build_previous_analysis(db: Session, holding_id: UUID) -> PreviousAnalysisSummary | None:
    row = (
        db.query(HoldingAnalysis, AnalysisRun)
        .join(AnalysisRun, HoldingAnalysis.analysis_run_id == AnalysisRun.id)
        .filter(
            HoldingAnalysis.holding_id == holding_id,
            AnalysisRun.status == AnalysisRunStatus.COMPLETED.value,
        )
        .order_by(AnalysisRun.completed_at.desc())
        .first()
    )
    if row is None:
        return None

    holding_analysis, analysis_run = row
    output = holding_analysis.structured_output_json or {}
    return PreviousAnalysisSummary(
        analysis_run_id=str(analysis_run.id),
        completed_at=analysis_run.completed_at,
        executive_summary=output.get("executive_summary", ""),
        thesis_status=output.get("thesis_status", "unknown"),
        overall_score=holding_analysis.overall_score,
    )
