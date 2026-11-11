"""Norwegian ticker catalogue for Sal's shop.

Additive only: one new table. Legacy tables and columns are untouched.

Revision ID: a2d3e4f5a6b7
Revises: z1b2c3d4e5f6
Create Date: 2026-11-11

"""

import sqlalchemy as sa

from alembic import op
from app.models.types import GUID

revision = "a2d3e4f5a6b7"
down_revision = "z1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ticker_catalogue",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("ticker", sa.String(32), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("exchange", sa.String(16), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("yahoo_sector", sa.String(64), nullable=True),
        sa.Column("sector", sa.String(64), nullable=True),
        sa.Column("market_cap", sa.Numeric(24, 2), nullable=True),
        sa.Column("market_cap_currency", sa.String(3), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ticker_catalogue_ticker", "ticker_catalogue", ["ticker"], unique=True)
    op.create_index("ix_ticker_catalogue_active_cap", "ticker_catalogue", ["active", "market_cap"])


def downgrade() -> None:
    op.drop_index("ix_ticker_catalogue_active_cap", table_name="ticker_catalogue")
    op.drop_index("ix_ticker_catalogue_ticker", table_name="ticker_catalogue")
    op.drop_table("ticker_catalogue")
