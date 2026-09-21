"""ORM models — equity-relevant tables only (see CLAUDE.md: the Supabase
schema also has legacy non-equity columns/tables, left alone deliberately;
this rebuild simply never maps or queries them).

Import every model here so `Base.metadata` sees them all — needed for
Alembic autogenerate and for the in-memory SQLite tables the test suite
creates.
"""
from app.models.account import Account
from app.models.base import Base
from app.models.document import Document, DocumentChunk, DocumentPage
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.models.research import ResearchItem, ResearchRun

__all__ = [
    "Account",
    "Base",
    "Document",
    "DocumentChunk",
    "DocumentPage",
    "FinancialLineItem",
    "Holding",
    "PortfolioPosition",
    "PortfolioSnapshot",
    "ResearchItem",
    "ResearchRun",
]
