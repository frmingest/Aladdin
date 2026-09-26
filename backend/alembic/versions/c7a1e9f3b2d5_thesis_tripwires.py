"""Sprint 11 — thesis tracking tripwires (2026-09-26)

New table `thesis_tripwires`: a user-defined "metric crosses threshold"
rule per holding, checked deterministically (never by the LLM) every time
it is read (app/services/thesis/tripwires.py). Additive only — no existing
table or column is touched.

Revision ID: c7a1e9f3b2d5
Revises: b1c2d3e4f5a6
Create Date: 2026-09-26

"""

import sqlalchemy as sa

from alembic import op
from app.models.types import GUID

revision = "c7a1e9f3b2d5"
down_revision = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "thesis_tripwires",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=False),
        sa.Column("metric", sa.String(64), nullable=False),
        sa.Column("operator", sa.String(8), nullable=False),
        sa.Column("threshold", sa.Numeric(24, 6), nullable=False),
        sa.Column("label", sa.Text(), nullable=True),
        sa.Column("origin", sa.String(32), nullable=True),
        sa.Column("source_run_id", GUID(), sa.ForeignKey("equity_analysis_runs.id"), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("fired_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_thesis_tripwires_holding_active", "thesis_tripwires", ["holding_id", "active"])


def downgrade() -> None:
    op.drop_index("ix_thesis_tripwires_holding_active", table_name="thesis_tripwires")
    op.drop_table("thesis_tripwires")
