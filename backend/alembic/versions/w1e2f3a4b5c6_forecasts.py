"""Forecasts (freeze the confidence written with a decision, for the C2 hit-rate view)

One new, additive table: `forecasts`. No existing table or column is touched.
Append-only; existing journal entries need no backfill (the view falls back to
the entry's own confidence when it has no forecast row).

Revision ID: w1e2f3a4b5c6
Revises: v1d2e3f4a5b6
Create Date: 2026-10-14

"""

import sqlalchemy as sa

from alembic import op
from app.models.types import GUID

revision = "w1e2f3a4b5c6"
down_revision = "v1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "forecasts",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column(
            "entry_id",
            GUID(),
            sa.ForeignKey("decision_journal_entries.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=True),
        sa.Column("source", sa.String(16), nullable=False),
        sa.Column("confidence", sa.Integer(), nullable=True),
        sa.Column("made_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_forecasts_entry_id", "forecasts", ["entry_id"])


def downgrade() -> None:
    op.drop_index("ix_forecasts_entry_id", table_name="forecasts")
    op.drop_table("forecasts")
