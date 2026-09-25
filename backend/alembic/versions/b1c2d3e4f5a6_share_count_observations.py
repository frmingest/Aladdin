"""Share counts for market multiples and the DCF (2026-09-25)

New table `share_count_observations`: dated shares-outstanding counts per
holding from a manual entry, the SEC cover page or yfinance
(app/services/market_data/shares.py). Additive only.

Revision ID: b1c2d3e4f5a6
Revises: a9b0c1d2e3f4
Create Date: 2026-09-25

"""

import sqlalchemy as sa

from alembic import op
from app.models.types import GUID

revision = "b1c2d3e4f5a6"
down_revision = "a9b0c1d2e3f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "share_count_observations",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=False),
        sa.Column("shares", sa.Numeric(24, 2), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(16), nullable=False),
        sa.Column("reference", sa.String(512), nullable=True),
        sa.Column("note", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_share_count_observations_holding_observed",
        "share_count_observations",
        ["holding_id", "observed_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_share_count_observations_holding_observed", table_name="share_count_observations")
    op.drop_table("share_count_observations")
