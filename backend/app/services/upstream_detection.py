"""Is this holding an upstream oil and gas producer (cash-basis owner earnings)?

Two signals, both needed:
1. the holding's sector is Energy (set by Faiz or the importer), and
2. the filings carry decommissioning payments (the extractor records them
   for companies that pay to abandon fields), which an oil service company
   or a refiner does not report as its own cash outflow.

Without a sector the answer is no: the cash basis is never applied by guess.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.sectors import is_energy_sector
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding

DECOMMISSIONING_METRIC = "decommissioning_payments"


def holding_is_upstream(db: Session, holding: Holding) -> bool:
    if not is_energy_sector(holding.sector):
        return False
    found = db.scalar(
        select(FinancialLineItem.id)
        .where(
            FinancialLineItem.holding_id == holding.id,
            FinancialLineItem.metric == DECOMMISSIONING_METRIC,
        )
        .limit(1)
    )
    return found is not None
