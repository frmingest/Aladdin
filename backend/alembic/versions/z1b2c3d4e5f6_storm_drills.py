"""Storm Drill notes for the 3D courtyard.

Additive only: one new table. Legacy tables and columns are untouched.

Revision ID: z1b2c3d4e5f6
Revises: y1a2b3c4d5e6
Create Date: 2026-11-01

"""

import sqlalchemy as sa

from alembic import op
from app.models.types import GUID

revision = "z1b2c3d4e5f6"
down_revision = "y1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "storm_drills",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("market_drop", sa.Numeric(5, 4), nullable=False),
        sa.Column("plan", sa.Text(), nullable=False),
        sa.Column("scenarios_version", sa.String(16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_storm_drills_created_at", "storm_drills", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_storm_drills_created_at", table_name="storm_drills")
    op.drop_table("storm_drills")
