"""Analysis queue + local worker heartbeats (Sprint 5B: F8 + F5).

Adds the queue columns to `equity_analysis_runs` (engine, queued_at,
claimed_by, claimed_at, attempts) and a new `analysis_worker_heartbeats`
table. Additive only: every existing run becomes engine='cloud',
attempts=0 through the server defaults; no existing column is changed.
The new QUEUED / CANCELLED statuses fit the existing String(20) column.

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-09-23

"""

import sqlalchemy as sa

from alembic import op
from app.models.types import GUID

revision = "e6f7a8b9c0d1"
down_revision = "d5e6f7a8b9c0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("equity_analysis_runs") as batch:
        batch.add_column(sa.Column("engine", sa.String(16), nullable=False, server_default="cloud"))
        batch.add_column(sa.Column("queued_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("claimed_by", sa.String(128), nullable=True))
        batch.add_column(sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"))
    op.create_index(
        "ix_equity_analysis_runs_status_queued", "equity_analysis_runs", ["status", "queued_at"]
    )

    op.create_table(
        "analysis_worker_heartbeats",
        sa.Column("worker_id", sa.String(128), primary_key=True),
        sa.Column("hostname", sa.String(255), nullable=True),
        sa.Column("llm_provider", sa.String(32), nullable=True),
        sa.Column("model_name", sa.String(64), nullable=True),
        sa.Column("state", sa.String(32), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("current_run_id", GUID(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("analysis_worker_heartbeats")
    op.drop_index("ix_equity_analysis_runs_status_queued", table_name="equity_analysis_runs")
    with op.batch_alter_table("equity_analysis_runs") as batch:
        batch.drop_column("attempts")
        batch.drop_column("claimed_at")
        batch.drop_column("claimed_by")
        batch.drop_column("queued_at")
        batch.drop_column("engine")
