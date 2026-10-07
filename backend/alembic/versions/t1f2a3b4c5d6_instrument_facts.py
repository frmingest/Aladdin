"""Instrument facts (analysis for bond funds, money-market funds, commodity ETCs)

One new, additive table: `instrument_facts` (typed-in figures that only some
wrapper types have, each citing an uploaded document). No existing table or
column is touched.

Revision ID: t1f2a3b4c5d6
Revises: s1e0f1a2b3c4
Create Date: 2026-10-07

"""

import sqlalchemy as sa

from alembic import op
from app.models.types import GUID

revision = "t1f2a3b4c5d6"
down_revision = "s1e0f1a2b3c4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "instrument_facts",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=False),
        sa.Column("fact_key", sa.String(48), nullable=False),
        sa.Column("value_number", sa.Numeric(20, 6), nullable=True),
        sa.Column("value_text", sa.Text(), nullable=True),
        sa.Column("as_of_date", sa.Date(), nullable=True),
        sa.Column("source_document_id", GUID(), sa.ForeignKey("documents.id"), nullable=False),
        sa.Column("source_page", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("holding_id", "fact_key", name="uq_instrument_facts_holding_key"),
    )
    op.create_index("ix_instrument_facts_holding_id", "instrument_facts", ["holding_id"])


def downgrade() -> None:
    op.drop_index("ix_instrument_facts_holding_id", table_name="instrument_facts")
    op.drop_table("instrument_facts")
