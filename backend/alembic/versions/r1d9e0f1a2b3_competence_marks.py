"""Circle of Competence marks (game mode G19)

One new, additive table: `competence_marks` (sector, level, note, when). The
user's own statement of how well they know a sector; never inferred. No
existing table or column is touched.

Revision ID: r1d9e0f1a2b3
Revises: q1c8d9e0f1a2
Create Date: 2026-10-04

"""

import sqlalchemy as sa

from alembic import op
from app.models.types import GUID

revision = "r1d9e0f1a2b3"
down_revision = "q1c8d9e0f1a2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "competence_marks",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("sector", sa.String(128), nullable=False, unique=True),
        sa.Column("level", sa.String(16), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("marked_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("competence_marks")
