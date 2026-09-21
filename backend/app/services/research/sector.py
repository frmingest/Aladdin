"""Sector-scoped research, shared by every holding in that sector."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.models.research import ResearchRunType
from app.providers.base import ResearchProvider
from app.services.research.common import ResearchSnapshot, get_or_refresh


def get_sector_research(
    db: Session, provider: ResearchProvider, *, sector: str, force: bool = False
) -> ResearchSnapshot:
    settings = get_settings()
    return get_or_refresh(
        db,
        type_=ResearchRunType.SECTOR.value,
        sector=sector,
        holding_id=None,
        fetch=lambda: provider.get_sector_research(sector),
        methodology_version=settings.active_research_prompt_version,
        force=force,
    )
