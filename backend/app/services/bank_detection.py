"""Is this holding a bank (or other deposit-funded financial)?

Two independent signals, either is enough:
1. the holding's sector (what Faiz or the importer set), and
2. the filing itself: the extractor flags `reporting_bank` when the balance
   sheet carries deposits from customers and loans to customers on its face
   (app/services/documents/extraction/ixbrl.py, is_bank_balance_sheet).

The second keeps SpareBank 1 Sør-Norge or Pareto Bank from showing "net debt"
or "ROIC" just because nobody set the sector. For these companies deposits are
the business, so the industrial-company measures are marked not meaningful
(app/services/metrics.py, mark_not_meaningful_for_financials).
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.sectors import is_financial_sector
from app.models.document import Document
from app.models.holding import Holding

REPORTING_BANK_FLAG = "reporting_bank"


def reports_as_bank(db: Session, holding_id: uuid.UUID) -> bool:
    """True when any stored document of the holding was flagged as a bank's."""
    flags = db.scalars(select(Document.quality_flags).where(Document.holding_id == holding_id))
    return any((f or {}).get(REPORTING_BANK_FLAG) is True for f in flags)


def holding_is_financial(db: Session, holding: Holding) -> bool:
    return is_financial_sector(holding.sector) or reports_as_bank(db, holding.id)
