"""Stock splits (restate pre-split shares and EPS against today's price)

One new, additive table: `stock_splits`. No existing table or column is
touched. Filled from the market data provider's split history the next time
a holding's price is refreshed.

Revision ID: v1d2e3f4a5b6
Revises: u1a2b3c4d5e6
Create Date: 2026-10-14

"""

import sqlalchemy as sa

from alembic import op
from app.models.types import GUID

revision = "v1d2e3f4a5b6"
down_revision = "u1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stock_splits",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=False),
        sa.Column("ex_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ratio", sa.Numeric(16, 8), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("holding_id", "ex_date", name="uq_stock_splits_holding_ex_date"),
    )
    op.create_index("ix_stock_splits_holding_ex_date", "stock_splits", ["holding_id", "ex_date"])


def downgrade() -> None:
    op.drop_index("ix_stock_splits_holding_ex_date", table_name="stock_splits")
    op.drop_table("stock_splits")
