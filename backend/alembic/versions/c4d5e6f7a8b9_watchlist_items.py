"""Watchlist (feature F7): companies followed but not necessarily owned.

One row per watched holding (unique holding_id), with your own buy-below
price and notes. Additive only: no existing table or column is touched.

Revision ID: c4d5e6f7a8b9
Revises: a2b4c6d8e0f1
Create Date: 2026-09-23

"""

import sqlalchemy as sa

from alembic import op
from app.models.types import GUID

revision = "c4d5e6f7a8b9"
down_revision = "a2b4c6d8e0f1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "watchlist_items",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=False, unique=True),
        sa.Column("buy_below_price", sa.Numeric(18, 4), nullable=True),
        sa.Column("buy_below_currency", sa.String(3), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("watchlist_items")
