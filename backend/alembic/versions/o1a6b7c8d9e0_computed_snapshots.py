"""Stored snapshots of the slow read endpoints

One additive table, `computed_snapshots` (key, JSON text payload,
input fingerprint, computed_at). Lets Risk, Performance, Margin of safety
and Watchlist serve a stored result instead of recomputing on every page
load. No existing table or column is touched.

Revision ID: o1a6b7c8d9e0
Revises: n1f5a6b7c8d9
Create Date: 2026-09-30

"""

import sqlalchemy as sa

from alembic import op

revision = "o1a6b7c8d9e0"
down_revision = "n1f5a6b7c8d9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "computed_snapshots",
        sa.Column("key", sa.String(160), primary_key=True),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("computed_snapshots")
