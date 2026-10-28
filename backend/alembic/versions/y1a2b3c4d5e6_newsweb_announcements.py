"""Newsweb announcements seen by the background watch.

Additive only: one new table. Legacy tables and columns are untouched.

Revision ID: y1a2b3c4d5e6
Revises: x1f2a3b4c5d6
Create Date: 2026-10-28

"""

import sqlalchemy as sa

from alembic import op
from app.models.types import GUID

revision = "y1a2b3c4d5e6"
down_revision = "x1f2a3b4c5d6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "newsweb_announcements",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=False),
        sa.Column("message_id", sa.String(64), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("source_url", sa.String(512), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("holding_id", "message_id", name="uq_newsweb_announcements_holding_message"),
    )
    op.create_index("ix_newsweb_announcements_holding_id", "newsweb_announcements", ["holding_id"])
    op.create_index(
        "ix_newsweb_announcements_unread", "newsweb_announcements", ["acknowledged_at", "first_seen_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_newsweb_announcements_unread", table_name="newsweb_announcements")
    op.drop_index("ix_newsweb_announcements_holding_id", table_name="newsweb_announcements")
    op.drop_table("newsweb_announcements")
