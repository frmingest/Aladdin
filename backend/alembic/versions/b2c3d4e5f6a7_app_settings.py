"""App settings table (2026-09-26) - generic key/value store, first used
by the demo-mode toggle (Faiz's request: a settings page to switch the
whole app to fabricated data). Additive only: no existing table or column
is touched.

Revision ID: b2c3d4e5f6a7
Revises: a74ba6a059dd
Create Date: 2026-09-26

"""

import sqlalchemy as sa

from alembic import op

revision = "b2c3d4e5f6a7"
down_revision = "a74ba6a059dd"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("value", sa.String(255), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("app_settings")
