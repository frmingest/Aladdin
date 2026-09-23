"""ORM models — equity-relevant tables only (see CLAUDE.md: the Supabase
schema also has legacy non-equity columns/tables, left alone deliberately;
this rebuild simply never maps or queries them).

Import every model here so `Base.metadata` sees them all — needed for
Alembic autogenerate and for the in-memory SQLite tables the test suite
creates.
"""
from app.models.account import Account
from app.models.analysis import EquityAnalysisRun, EquityHoldingNote
from app.models.base import Base
from app.models.document import Document, DocumentChunk, DocumentPage
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.models.journal import DecisionJournalEntry
from app.models.legacy_analysis import (
    AnalysisRun,
    EvidenceReference,
    FactorAssessment,
    HoldingAnalysis,
    LlmUsageEvent,
)
from app.models.market import FxObservation, MarketObservation, RiskFreeRateObservation
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.models.research import ResearchItem, ResearchRun
from app.models.watchlist import WatchlistItem

__all__ = [
    "Account",
    "AnalysisRun",
    "Base",
    "DecisionJournalEntry",
    "Document",
    "DocumentChunk",
    "DocumentPage",
    "EquityAnalysisRun",
    "EquityHoldingNote",
    "EvidenceReference",
    "FactorAssessment",
    "FinancialLineItem",
    "FxObservation",
    "Holding",
    "HoldingAnalysis",
    "LlmUsageEvent",
    "MarketObservation",
    "PortfolioPosition",
    "PortfolioSnapshot",
    "ResearchItem",
    "ResearchRun",
    "RiskFreeRateObservation",
    "WatchlistItem",
]
