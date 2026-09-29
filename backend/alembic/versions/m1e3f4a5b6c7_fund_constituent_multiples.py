"""Fund look-through valuation: constituent trailing P/Es

One additive table. `fund_constituent_multiples` holds, per fund and
constituent ISIN, the trailing P/E fetched for the look-through valuation
(or NULL plus a reason when it could not be priced), so the board and the
holding page read stored numbers instead of calling a provider per
constituent on every page load. No existing table or column is touched.

Revision ID: m1e3f4a5b6c7
Revises: l1d2e3f4a5b6
Create Date: 2026-09-29

"""

import sqlalchemy as sa

from alembic import op
from app.models.types import GUID

revision = "m1e3f4a5b6c7"
down_revision = "l1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fund_constituent_multiples",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=False),
        sa.Column("isin", sa.String(12), nullable=False),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column("weight_pct", sa.Numeric(9, 4), nullable=False),
        sa.Column("resolved_ticker", sa.String(64), nullable=True),
        sa.Column("trailing_pe", sa.Numeric(14, 4), nullable=True),
        sa.Column("reason", sa.String(255), nullable=True),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_fund_constituent_multiples_holding", "fund_constituent_multiples", ["holding_id"])


def downgrade() -> None:
    op.drop_index("ix_fund_constituent_multiples_holding", table_name="fund_constituent_multiples")
    op.drop_table("fund_constituent_multiples")
