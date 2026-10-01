"""Optional cash balance per account (game mode Vault)

Two additive, nullable columns on `accounts`: `cash_nok` (what the account
holds in cash, typed in by hand because the Nordnet holdings export has no
cash line) and `cash_as_of` (when it was last set). NULL means "never
entered", which is deliberately different from 0. No existing column or
row is touched.

Revision ID: p1b7c8d9e0f1
Revises: o1a6b7c8d9e0
Create Date: 2026-10-01

"""

import sqlalchemy as sa

from alembic import op

revision = "p1b7c8d9e0f1"
down_revision = "o1a6b7c8d9e0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("cash_nok", sa.Numeric(20, 2), nullable=True))
    op.add_column("accounts", sa.Column("cash_as_of", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("accounts", "cash_as_of")
    op.drop_column("accounts", "cash_nok")
