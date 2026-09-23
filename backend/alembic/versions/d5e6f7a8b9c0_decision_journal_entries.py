"""Decision journal (feature F6): why you bought or sold, the price, and
what would prove you wrong.

`holding_id` is nullable: deleting a holding unlinks its entries rather than
deleting them (app/services/deletion.py). Additive only: no existing table
or column is touched.

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-09-23

"""

import sqlalchemy as sa

from alembic import op
from app.models.types import GUID

revision = "d5e6f7a8b9c0"
down_revision = "c4d5e6f7a8b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "decision_journal_entries",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=True),
        sa.Column("ticker", sa.String(255), nullable=False),
        sa.Column("company_name", sa.String(255), nullable=False),
        sa.Column("action", sa.String(16), nullable=False),
        sa.Column("decided_on", sa.Date(), nullable=False),
        sa.Column("price", sa.Numeric(18, 4), nullable=True),
        sa.Column("currency", sa.String(3), nullable=True),
        sa.Column("quantity", sa.Numeric(20, 6), nullable=True),
        sa.Column("thesis", sa.Text(), nullable=False),
        sa.Column("invalidation", sa.Text(), nullable=True),
        sa.Column("confidence", sa.Integer(), nullable=True),
        sa.Column("verdict_at_decision", sa.String(16), nullable=True),
        sa.Column("review_6m", sa.Text(), nullable=True),
        sa.Column("review_12m", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_decision_journal_entries_holding_id", "decision_journal_entries", ["holding_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_decision_journal_entries_holding_id", table_name="decision_journal_entries")
    op.drop_table("decision_journal_entries")
