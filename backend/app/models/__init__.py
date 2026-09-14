"""
Import every ORM model here so `Base.metadata` (app.config.database.Base) is
fully populated — this is what alembic/env.py's `target_metadata` walks for
autogenerate, and what Base.metadata.create_all() uses in tests.
"""

from app.models.account import Account
from app.models.analysis import AnalysisRun, AnalysisRunStatus, EvidenceReference, FactorAssessment, HoldingAnalysis
from app.models.document import Document, DocumentChunk, DocumentPage, DocumentStatus, DocumentType
from app.models.financial_fact import FinancialLineItem
from app.models.holding import Holding
from app.models.market_data import FxObservation, MarketObservation
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot, SnapshotStatus
from app.models.portfolio_risk import PortfolioRiskSnapshot
from app.models.research import MacroObservation, ResearchItem, ResearchRun, ResearchRunStatus, ResearchRunType
from app.models.thesis import InvestmentThesis, InvestmentThesisStatus
from app.models.valuation import ValuationCase, ValuationCaseType

__all__ = [
    "Account",
    "AnalysisRun",
    "AnalysisRunStatus",
    "Document",
    "DocumentChunk",
    "DocumentPage",
    "DocumentStatus",
    "DocumentType",
    "EvidenceReference",
    "FactorAssessment",
    "FinancialLineItem",
    "FxObservation",
    "Holding",
    "HoldingAnalysis",
    "InvestmentThesis",
    "InvestmentThesisStatus",
    "MacroObservation",
    "MarketObservation",
    "PortfolioPosition",
    "PortfolioRiskSnapshot",
    "PortfolioSnapshot",
    "ResearchItem",
    "ResearchRun",
    "ResearchRunStatus",
    "ResearchRunType",
    "SnapshotStatus",
    "ValuationCase",
    "ValuationCaseType",
]
