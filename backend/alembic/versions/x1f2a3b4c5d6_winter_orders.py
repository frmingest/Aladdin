"""Winter orders (the note to your future self, shown in the E3 Hearth)

One new, additive table: `winter_orders`. No existing table or column is
touched. Append-only; the newest row is the current order.

Revision ID: x1f2a3b4c5d6
Revises: w1e2f3a4b5c6
Create Date: 2026-10-16

"""

import sqlalchemy as sa

from alembic import op
from app.models.types import GUID

revision = "x1f2a3b4c5d6"
down_revision = "w1e2f3a4b5c6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "winter_orders",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("text", sa.String(200), nullable=False),
        sa.Column("made_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("winter_orders")
