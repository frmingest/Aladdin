"""
Full portfolio data reset (destructive). Wipes every portfolio snapshot,
position, and holding, plus everything keyed off a holding or a snapshot:
uploaded source files (documents/pages/chunks), extracted financial facts,
market observations, investment theses, valuation cases, analysis runs, and
portfolio risk snapshots.

Deliberately NOT touched: research_runs / research_items / macro_observations
/ fx_observations. Those are global macro/sector/FX data (§9), not scoped to
a specific holding or upload — a portfolio reset shouldn't force re-fetching
macro research that has nothing to do with which holdings you own. Same
reasoning for llm_usage_events (ADR 0013) — it's the free-tier quota/rate-
limit ledger, a record of API calls made *today* independent of which
holdings currently exist, so a reset detaches it (nulls its optional
holding_id/analysis_run_id/holding_analysis_id) rather than deleting it, the
same "detach defensively" pattern already used for research_items.holding_id
below. Without that detach, deleting Holding/AnalysisRun/HoldingAnalysis
below hits a ForeignKeyViolation the moment any usage event references one
of them (llm_usage_events.holding_analysis_id -> holding_analyses.id, etc.)
— this was missed when the usage ledger was added and reset.py wasn't
updated to know about it.

This is bulk `Query.delete()`, which bypasses SQLAlchemy's ORM-relationship
`cascade="all, delete-orphan"` (that only fires on `session.delete(obj)`
object-by-object). So order matters here: every table is cleared before the
table(s) it foreign-keys to, matching app/models' FK graph exactly.
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.analysis import AnalysisRun, EvidenceReference, FactorAssessment, HoldingAnalysis
from app.models.document import Document, DocumentChunk, DocumentPage
from app.models.financial_fact import FinancialLineItem
from app.models.holding import Holding
from app.models.llm_usage import LLMUsageEvent
from app.models.market_data import MarketObservation
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.models.portfolio_risk import PortfolioRiskSnapshot
from app.models.research import ResearchItem
from app.models.thesis import InvestmentThesis
from app.models.valuation import ValuationCase


@dataclass
class PortfolioResetResult:
    holdings_deleted: int
    snapshots_deleted: int
    documents_deleted: int


def reset_all_portfolio_data(db: Session) -> PortfolioResetResult:
    """Deletes every holding, snapshot, uploaded file, and everything derived
    from them. Irreversible — the API layer gates this behind an explicit
    confirmation; this function itself does not ask twice."""
    holdings_deleted = db.query(Holding).count()
    snapshots_deleted = db.query(PortfolioSnapshot).count()
    documents_deleted = db.query(Document).count()

    # research_items.holding_id is nullable and not currently populated by
    # any provider (§9.3 — always NULL today), but detach defensively rather
    # than assume that stays true and hit an FK violation on Holding below.
    db.query(ResearchItem).filter(ResearchItem.holding_id.isnot(None)).update(
        {ResearchItem.holding_id: None}, synchronize_session=False
    )

    # llm_usage_events (ADR 0013) is kept — see module docstring — but its
    # three optional FKs must be detached first or deleting Holding/
    # AnalysisRun/HoldingAnalysis below hits a ForeignKeyViolation.
    db.query(LLMUsageEvent).update(
        {
            LLMUsageEvent.holding_id: None,
            LLMUsageEvent.analysis_run_id: None,
            LLMUsageEvent.holding_analysis_id: None,
        },
        synchronize_session=False,
    )

    # Leaves of the holding_analyses / holdings / documents / snapshots trees.
    db.query(FactorAssessment).delete(synchronize_session=False)
    db.query(EvidenceReference).delete(synchronize_session=False)
    db.query(FinancialLineItem).delete(synchronize_session=False)
    db.query(MarketObservation).delete(synchronize_session=False)
    db.query(InvestmentThesis).delete(synchronize_session=False)
    db.query(ValuationCase).delete(synchronize_session=False)
    db.query(DocumentChunk).delete(synchronize_session=False)
    db.query(DocumentPage).delete(synchronize_session=False)

    # Middle tier: depends on the leaves above being gone first.
    db.query(HoldingAnalysis).delete(synchronize_session=False)
    db.query(PortfolioPosition).delete(synchronize_session=False)
    db.query(PortfolioRiskSnapshot).delete(synchronize_session=False)
    db.query(AnalysisRun).delete(synchronize_session=False)

    # Roots, in dependency order: snapshots depend on documents
    # (source_file_id), so snapshots go first.
    db.query(PortfolioSnapshot).delete(synchronize_session=False)
    db.query(Document).delete(synchronize_session=False)
    db.query(Holding).delete(synchronize_session=False)

    db.commit()

    return PortfolioResetResult(
        holdings_deleted=holdings_deleted,
        snapshots_deleted=snapshots_deleted,
        documents_deleted=documents_deleted,
    )
