"""Tag mapping rules (tag review inbox, PR 2)

One new, additive table: `tag_mapping_rules` (accepted mapping rules and
remembered rejections made in the tag review inbox). No existing table or
column is touched.

Revision ID: s1e0f1a2b3c4
Revises: r1d9e0f1a2b3
Create Date: 2026-10-07

"""

import sqlalchemy as sa

from alembic import op
from app.models.types import GUID

revision = "s1e0f1a2b3c4"
down_revision = "r1d9e0f1a2b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tag_mapping_rules",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=True),
        sa.Column("ticker", sa.String(32), nullable=True),
        sa.Column("metric", sa.String(64), nullable=False),
        sa.Column("metric_label", sa.String(64), nullable=False),
        sa.Column("concept", sa.String(255), nullable=False),
        sa.Column("scope", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("check_status", sa.String(16), nullable=True),
        sa.Column("check_detail", sa.Text(), nullable=True),
        sa.Column("check_overridden", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("fiscal_year", sa.String(16), nullable=True),
        sa.Column("source_filename", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_tag_mapping_rules_holding_id", "tag_mapping_rules", ["holding_id"])


def downgrade() -> None:
    op.drop_index("ix_tag_mapping_rules_holding_id", table_name="tag_mapping_rules")
    op.drop_table("tag_mapping_rules")
