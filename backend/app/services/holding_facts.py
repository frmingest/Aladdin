"""A holding's extracted filing facts grouped by fiscal period, plus the
"latest" and "previous" period helpers the metrics, the share-count
cross-check and the evidence packet all need (2026-09-25). One place, so
all of them pick the same years.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.period_dates import extract_year
from app.models.financial_line_item import FinancialLineItem


@dataclass
class PeriodFacts:
    period: str
    year: int | None
    facts: dict[str, Decimal] = field(default_factory=dict)
    currencies: dict[str, str | None] = field(default_factory=dict)

    @property
    def currency(self) -> str | None:
        """The one currency of this period's monetary facts, else None."""
        found = {
            c.split("/", 1)[0]
            for m, c in self.currencies.items()
            if c and m != "shares_outstanding"
        }
        return next(iter(found)) if len(found) == 1 else None


def facts_by_period(db: Session, holding_id: uuid.UUID) -> dict[str, PeriodFacts]:
    out: dict[str, PeriodFacts] = {}
    for item in db.scalars(select(FinancialLineItem).where(FinancialLineItem.holding_id == holding_id)):
        entry = out.setdefault(item.period, PeriodFacts(item.period, extract_year(item.period)))
        entry.facts[item.metric] = item.value
        entry.currencies[item.metric] = item.currency
    return out


def _pick(candidates: list[PeriodFacts]) -> PeriodFacts | None:
    """One period for a year: the only one, else the "FY…" (annual) label."""
    if len(candidates) == 1:
        return candidates[0]
    annual = [p for p in candidates if p.period.upper().startswith("FY")]
    return annual[0] if len(annual) == 1 else None


def latest_period(periods: dict[str, PeriodFacts]) -> PeriodFacts | None:
    years = [p.year for p in periods.values() if p.year is not None]
    if not years:
        return None
    return _pick([p for p in periods.values() if p.year == max(years)])


def previous_period(periods: dict[str, PeriodFacts], period: str) -> PeriodFacts | None:
    """The fiscal year immediately before `period` (FY2025 -> FY2024), if on
    file. Only the directly preceding year: averaging over a gap would
    blur two different balance sheets."""
    current = periods.get(period)
    if current is None or current.year is None:
        return None
    return _pick([p for p in periods.values() if p.year == current.year - 1])
