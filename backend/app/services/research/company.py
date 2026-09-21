"""Per-holding research — industry/geography/competitive-environment
context specific to one company (the Iran/energy example)."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.models.holding import Holding
from app.models.research import ResearchRunType
from app.providers.base import ResearchProvider
from app.services.research.common import ResearchSnapshot, get_or_refresh


def get_company_research(
    db: Session, provider: ResearchProvider, *, holding: Holding, force: bool = False
) -> ResearchSnapshot:
    settings = get_settings()
    return get_or_refresh(
        db,
        type_=ResearchRunType.COMPANY.value,
        sector=None,
        holding_id=holding.id,
        fetch=lambda: provider.get_company_research(
            company_name=holding.name, ticker=holding.ticker, sector=holding.sector
        ),
        methodology_version=settings.active_research_prompt_version,
        force=force,
    )
