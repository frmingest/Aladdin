"""Epic F22 phase 1 (Sprint 16): analyst persona on analysis runs.

Adds two columns to equity_analysis_runs:

- persona: "buffett_munger" | "dalio" (app/domain/analyst_modes.py).
  Every existing row is backfilled to "buffett_munger" via the server
  default — every run before F22 was produced by that engine.
- auto_queued: true for runs queued automatically by side-by-side mode
  (story 22.7), false for everything else (including all existing rows).

Plus an index for "latest run per holding per persona". Additive only.

Revision ID: f22a1b2c3d4e
Revises: b2c3d4e5f6a7
Create Date: 2026-09-27

"""

import sqlalchemy as sa

from alembic import op

revision = "f22a1b2c3d4e"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "equity_analysis_runs",
        sa.Column("persona", sa.String(24), nullable=False, server_default="buffett_munger"),
    )
    op.add_column(
        "equity_analysis_runs",
        sa.Column("auto_queued", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index(
        "ix_equity_analysis_runs_holding_persona_started",
        "equity_analysis_runs",
        ["holding_id", "persona", "started_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_equity_analysis_runs_holding_persona_started", table_name="equity_analysis_runs")
    op.drop_column("equity_analysis_runs", "auto_queued")
    op.drop_column("equity_analysis_runs", "persona")
