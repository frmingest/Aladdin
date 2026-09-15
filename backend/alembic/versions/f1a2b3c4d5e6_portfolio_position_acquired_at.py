"""Portfolio position acquired_at

Phase 8 (ADR 0011 — precious metals & collectibles). Adds a nullable
`acquired_at` column to `portfolio_positions` so a manually-entered lot
(a coin bought on a specific date, a whisky bottle) can record its own
purchase date instead of inheriting the snapshot's `uploaded_at`, which is
only correct for a continuously-held brokerage position. Every existing row
gets NULL, meaning "no explicit acquisition date recorded" — exactly what
was true for all of them before this column existed.

Revision ID: f1a2b3c4d5e6
Revises: d8f3a6b2c710
Create Date: 2026-09-15

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "f1a2b3c4d5e6"
down_revision = "d8f3a6b2c710"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "portfolio_positions",
        sa.Column("acquired_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("portfolio_positions", "acquired_at")
