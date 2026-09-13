"""
Import every ORM model here so `Base.metadata` (app.config.database.Base) is
fully populated — this is what alembic/env.py's `target_metadata` walks for
autogenerate, and what Base.metadata.create_all() uses in tests.
"""

from app.models.document import Document, DocumentChunk, DocumentPage, DocumentStatus, DocumentType
from app.models.financial_fact import FinancialLineItem
from app.models.holding import Holding
from app.models.market_data import FxObservation, MarketObservation
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot, SnapshotStatus

__all__ = [
    "Document",
    "DocumentChunk",
    "DocumentPage",
    "DocumentStatus",
    "DocumentType",
    "FinancialLineItem",
    "FxObservation",
    "Holding",
    "MarketObservation",
    "PortfolioPosition",
    "PortfolioSnapshot",
    "SnapshotStatus",
]
