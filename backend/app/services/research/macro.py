"""Portfolio-wide macro/geopolitical research — the Brain's Opening step."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.models.research import ResearchRunType
from app.providers.base import ResearchProvider
from app.services.research.common import ResearchSnapshot, get_or_refresh


def get_macro_research(db: Session, provider: ResearchProvider, *, force: bool = False) -> ResearchSnapshot:
    settings = get_settings()
    return get_or_refresh(
        db,
        type_=ResearchRunType.MACRO.value,
        sector=None,
        holding_id=None,
        fetch=provider.get_macro_research,
        methodology_version=settings.active_research_prompt_version,
        force=force,
    )
