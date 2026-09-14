"""Portfolio risk snapshot API schemas (architecture §15, §15.1, §18, §26
Phase 5).

Each JSON section's internal shape is documented on the dataclasses that
produce it (app.domain.portfolio_risk, app.domain.scenarios,
app.services.portfolio_risk.builder) rather than re-declared as nested
pydantic models here — it's genuinely per-dimension-variable data (§20's own
"JSON is appropriate for genuinely flexible outputs" carve-out), and
duplicating every dataclass as a second pydantic schema would only create a
second place for the two to drift apart.
"""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class PortfolioRiskSnapshotOut(BaseModel):
    id: UUID
    portfolio_snapshot_id: UUID
    analysis_run_id: UUID | None
    concentration: dict
    correlation: dict
    exposure: dict
    scenario: dict
    systemic_state_risk: dict
    risk_band: str
    composite_risk_score: Decimal | None
    narrative: str
    risk_scoring_version: str
    scenario_version: str
    created_at: datetime
    # None = built for every account (no filter). The account_id set (§26
    # accounts feature dashboard filter) this row was actually computed
    # against, so a caller can pick the right historical row for a given
    # filter selection out of GET .../risk-snapshots without recomputing.
    account_ids: list[str] | None = None
