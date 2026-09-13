"""Deterministic valuation cases (architecture §17, §20, §26 Phase 5).

`calculated_value` and every other numeric field here is application-code
DCF arithmetic (app.domain.valuation) — never LLM output (§2.2, §28 rule 4).
`critique_json` is the one LLM-touched field: §17's "the LLM critiques
whether assumptions are reasonable" step, stored separately from the number
itself so the calculated value's provenance stays purely deterministic even
though a qualitative critique sits alongside it. It's nullable because the
critique is a best-effort secondary step (app.services.valuation.dcf) — an
LLM failure must not block the deterministic value from being persisted
(§21: fail visibly per-item, not all-or-nothing, mirroring the Phase 2
per-holding valuation precedent).
"""

import enum
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import JSON, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base
from app.models.types import GUID, new_uuid


class ValuationCaseType(str, enum.Enum):
    BULL = "bull"
    BASE = "base"
    BEAR = "bear"


class ValuationCase(Base):
    __tablename__ = "valuation_cases"

    id: Mapped["uuid.UUID"] = mapped_column(GUID, primary_key=True, default=new_uuid)
    holding_id: Mapped["uuid.UUID"] = mapped_column(
        GUID, ForeignKey("holdings.id"), nullable=False, index=True
    )
    # Optional link to the analysis run this case was produced alongside —
    # a valuation case can also be created standalone (§17 doesn't require
    # an analysis run to exist first).
    analysis_run_id: Mapped["uuid.UUID | None"] = mapped_column(
        GUID, ForeignKey("analysis_runs.id"), nullable=True, index=True
    )

    case_type: Mapped[str] = mapped_column(String(8), nullable=False)  # bull | base | bear

    # app.domain.valuation.ValuationAssumptions, as supplied by the caller —
    # kept verbatim for reproducibility even though the number below is what
    # most callers want (§2.3).
    assumptions_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    calculated_value: Mapped[Decimal | None] = mapped_column(Numeric(24, 6), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    # Deterministic heuristic (app.domain.valuation) on how complete/internally
    # consistent the assumptions were — never presented as if it were the
    # LLM critique's confidence (§13.3: distinct signals, not blended).
    confidence: Mapped[str] = mapped_column(String(8), nullable=False)  # low | medium | high
    # None when the DCF was mathematically undefined for the given inputs
    # (e.g. discount_rate <= terminal_growth) — see calculated_value's None
    # case; explains why rather than leaving the caller to guess.
    calculation_note: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # §17 — LLM critique of the assumptions (ValuationCritiqueOutput,
    # app.schemas.valuation), best-effort — see module docstring.
    critique_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    critique_error: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ValuationCase holding={self.holding_id} {self.case_type}={self.calculated_value}>"
