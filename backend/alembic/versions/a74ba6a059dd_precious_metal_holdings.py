"""Precious metals: physical gold/silver coin holdings (2026-09-26)

New table `precious_metal_holdings`: manually-entered lots of physical
1oz gold/silver coins (app/models/precious_metal.py), tracked separately
from the equity-only Holding/PortfolioPosition model since these aren't
brokerage positions tied to an account snapshot. Additive only -- no
existing table or column is touched.

Revision ID: a74ba6a059dd
Revises: a3f5c8d1e942
Create Date: 2026-09-26

"""

import sqlalchemy as sa

from alembic import op
from app.models.types import GUID

revision = "a74ba6a059dd"
down_revision = "a3f5c8d1e942"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "precious_metal_holdings",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("coin_series", sa.String(64), nullable=False),
        sa.Column("metal", sa.String(8), nullable=False),
        sa.Column("quantity", sa.Numeric(10, 2), nullable=False),
        sa.Column("purchase_date", sa.Date(), nullable=True),
        sa.Column("purchase_price_nok", sa.Numeric(20, 2), nullable=True),
        sa.Column("storage_location", sa.String(128), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_precious_metal_holdings_metal", "precious_metal_holdings", ["metal"]
    )


def downgrade() -> None:
    op.drop_index("ix_precious_metal_holdings_metal", table_name="precious_metal_holdings")
    op.drop_table("precious_metal_holdings")
