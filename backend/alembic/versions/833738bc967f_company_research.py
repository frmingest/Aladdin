"""Phase 11 Sprint 2 — company-specific research: ResearchRun.holding_id

Adds the column and index Sprint 2 (per-holding live research,
claude/buffett-munger-redesign-sprint-plan-2026-09-20.md) needs to route a
new ResearchRunType.COMPANY run by holding, the same way SECTOR runs are
already routed by `sector`. Written by hand, matching every prior migration
in this repo (no live Postgres available to autogenerate against in this
build environment — see docs/decisions/0002's Consequences).

Revision ID: 833738bc967f
Revises: f1a2b3c4d5e6
Create Date: 2026-09-20

"""

import sqlalchemy as sa
from alembic import op

from app.models.types import GUID

# revision identifiers, used by Alembic.
revision = "833738bc967f"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("research_runs", sa.Column("holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=True))
    op.create_index("ix_research_runs_holding_id", "research_runs", ["holding_id"])
    op.create_index(
        "ix_research_runs_type_holding_completed",
        "research_runs",
        ["type", "holding_id", "completed_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_research_runs_type_holding_completed", table_name="research_runs")
    op.drop_index("ix_research_runs_holding_id", table_name="research_runs")
    op.drop_column("research_runs", "holding_id")
