"""
Portfolio data reset (destructive). Wipes holdings, positions, and, for a
full reset, snapshots — plus everything keyed off a holding: uploaded source
files (documents/pages/chunks), extracted financial facts, market
observations, investment theses, valuation cases, and analysis results.

Two shapes:

- `scope="all"` — the original full reset. Wipes every PortfolioSnapshot/
  PortfolioPosition/Holding, every Document (including the portfolio upload
  files themselves), and every PortfolioRiskSnapshot (a whole-portfolio
  aggregate that a partial reset can't meaningfully keep accurate).
- `scope in {"securities", "commodity", "whisky"}` — a partial reset (Faiz's
  ask: "let me wipe just my coins, or just my whisky, without nuking my
  Nordnet securities too"). Deletes only the Holding rows whose asset_class
  falls in that bucket (see app.domain.asset_class and
  frontend/src/components/CollectionFilter.tsx for the same three-way split:
  COMMODITY = coin collection, COLLECTIBLE = whisky collection, everything
  else = securities), plus every PortfolioPosition/analysis/document/etc. tied
  to just those holdings. PortfolioSnapshot rows are NOT deleted for a partial
  reset — a snapshot can span all three collections, so deleting it would
  also wipe the collections the user asked to keep; only the positions for
  the in-scope holdings are removed from it. PortfolioRiskSnapshot rows are
  left as-is too (they're whole-portfolio aggregates, not per-holding) —
  they'll just be stale until "Compute new risk snapshot" is run again.

Deliberately NOT touched by either shape: research_runs / research_items /
macro_observations / fx_observations. Those are global macro/sector/FX data
(§9), not scoped to a specific holding or upload — a portfolio reset
shouldn't force re-fetching macro research that has nothing to do with which
holdings you own. Same reasoning for llm_usage_events (ADR 0013) — it's the
free-tier quota/rate-limit ledger, a record of API calls made *today*
independent of which holdings currently exist, so a reset detaches it (nulls
its optional holding_id/analysis_run_id/holding_analysis_id) rather than
deleting it, the same "detach defensively" pattern already used for
research_items.holding_id below. Without that detach, deleting
Holding/AnalysisRun/HoldingAnalysis below hits a ForeignKeyViolation the
moment any usage event references one of them
(llm_usage_events.holding_analysis_id -> holding_analyses.id, etc.) — this
was missed when the usage ledger was added and reset.py wasn't updated to
know about it.

This is bulk `Query.delete()`, which bypasses SQLAlchemy's ORM-relationship
`cascade="all, delete-orphan"` (that only fires on `session.delete(obj)`
object-by-object). So order matters here: every table is cleared before the
table(s) it foreign-keys to, matching app/models' FK graph exactly.
"""

from dataclasses import dataclass
from typing import Literal

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.domain.asset_class import AssetClass
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

# What the "Delete data" popup on the Portfolio tab lets Faiz pick between —
# see frontend/src/pages/PortfolioUpload.tsx's ResetDataDialog.
ResetScope = Literal["all", "securities", "commodity", "whisky"]
RESET_SCOPES: tuple[ResetScope, ...] = ("all", "securities", "commodity", "whisky")


@dataclass
class PortfolioResetResult:
    holdings_deleted: int
    snapshots_deleted: int
    documents_deleted: int


def _holding_ids_for_scope(db: Session, scope: ResetScope) -> list:
    """Which Holding.id's fall inside a partial-reset scope. Mirrors
    frontend/src/components/CollectionFilter.tsx's collectionForAssetClass:
    COMMODITY = coin collection, COLLECTIBLE = whisky collection, every other
    asset_class = securities (a Nordnet/canonical-schema brokerage holding)."""
    query = db.query(Holding.id)
    if scope == "commodity":
        query = query.filter(Holding.asset_class == AssetClass.COMMODITY.value)
    elif scope == "whisky":
        query = query.filter(Holding.asset_class == AssetClass.COLLECTIBLE.value)
    elif scope == "securities":
        query = query.filter(
            Holding.asset_class.notin_([AssetClass.COMMODITY.value, AssetClass.COLLECTIBLE.value])
        )
    else:  # pragma: no cover — guarded by the API layer's own validation
        raise ValueError(f"unknown partial reset scope: {scope!r}")
    return [row[0] for row in query.all()]


def reset_all_portfolio_data(db: Session, scope: ResetScope = "all") -> PortfolioResetResult:
    """Deletes holdings and everything derived from them. Irreversible — the
    API layer gates this behind an explicit confirmation; this function
    itself does not ask twice.

    `scope="all"` (the default, and the only shape this function supported
    before the "Delete data" popup) wipes the whole portfolio: every
    snapshot, position, holding, and uploaded file. `scope` set to
    "securities" / "commodity" / "whisky" wipes only the holdings in that
    collection — see the module docstring for exactly what is and isn't
    touched in that case."""
    if scope == "all":
        return _reset_everything(db)
    return _reset_scoped(db, scope)


def _reset_everything(db: Session) -> PortfolioResetResult:
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


def _reset_scoped(db: Session, scope: ResetScope) -> PortfolioResetResult:
    holding_ids = _holding_ids_for_scope(db, scope)
    if not holding_ids:
        return PortfolioResetResult(holdings_deleted=0, snapshots_deleted=0, documents_deleted=0)

    holdings_deleted = len(holding_ids)
    documents_deleted = (
        db.query(Document).filter(Document.holding_id.in_(holding_ids)).count()
    )

    holding_analysis_ids_subq = (
        db.query(HoldingAnalysis.id)
        .filter(HoldingAnalysis.holding_id.in_(holding_ids))
        .scalar_subquery()
    )
    document_ids_subq = (
        db.query(Document.id).filter(Document.holding_id.in_(holding_ids)).scalar_subquery()
    )

    # Detach optional FKs first — same defensive pattern as the full reset.
    db.query(ResearchItem).filter(ResearchItem.holding_id.in_(holding_ids)).update(
        {ResearchItem.holding_id: None}, synchronize_session=False
    )
    db.query(LLMUsageEvent).filter(
        or_(
            LLMUsageEvent.holding_id.in_(holding_ids),
            LLMUsageEvent.holding_analysis_id.in_(holding_analysis_ids_subq),
        )
    ).update(
        {
            LLMUsageEvent.holding_id: None,
            LLMUsageEvent.analysis_run_id: None,
            LLMUsageEvent.holding_analysis_id: None,
        },
        synchronize_session=False,
    )

    # Leaves, scoped to just the in-scope holdings' documents/analyses.
    db.query(FactorAssessment).filter(
        FactorAssessment.holding_analysis_id.in_(holding_analysis_ids_subq)
    ).delete(synchronize_session=False)
    db.query(EvidenceReference).filter(
        EvidenceReference.holding_analysis_id.in_(holding_analysis_ids_subq)
    ).delete(synchronize_session=False)
    db.query(FinancialLineItem).filter(FinancialLineItem.holding_id.in_(holding_ids)).delete(
        synchronize_session=False
    )
    db.query(MarketObservation).filter(MarketObservation.holding_id.in_(holding_ids)).delete(
        synchronize_session=False
    )
    db.query(InvestmentThesis).filter(InvestmentThesis.holding_id.in_(holding_ids)).delete(
        synchronize_session=False
    )
    db.query(ValuationCase).filter(ValuationCase.holding_id.in_(holding_ids)).delete(
        synchronize_session=False
    )
    db.query(DocumentChunk).filter(DocumentChunk.document_id.in_(document_ids_subq)).delete(
        synchronize_session=False
    )
    db.query(DocumentPage).filter(DocumentPage.document_id.in_(document_ids_subq)).delete(
        synchronize_session=False
    )

    # Middle tier.
    db.query(HoldingAnalysis).filter(HoldingAnalysis.holding_id.in_(holding_ids)).delete(
        synchronize_session=False
    )
    db.query(PortfolioPosition).filter(PortfolioPosition.holding_id.in_(holding_ids)).delete(
        synchronize_session=False
    )
    # AnalysisRun and PortfolioRiskSnapshot are whole-snapshot/whole-portfolio
    # aggregates (they don't belong to one holding), so a partial reset
    # leaves them as-is — see module docstring.

    # Roots: only the in-scope holdings and their own documents. The
    # snapshot(s) that reference these positions are left in place — they
    # can, and typically do, also hold positions outside this scope.
    db.query(Document).filter(Document.holding_id.in_(holding_ids)).delete(synchronize_session=False)
    db.query(Holding).filter(Holding.id.in_(holding_ids)).delete(synchronize_session=False)

    db.commit()

    return PortfolioResetResult(
        holdings_deleted=holdings_deleted,
        snapshots_deleted=0,
        documents_deleted=documents_deleted,
    )
