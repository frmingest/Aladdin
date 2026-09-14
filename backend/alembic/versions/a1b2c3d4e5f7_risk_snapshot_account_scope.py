"""Risk snapshot account scope

Adds a nullable `account_ids_json` column to portfolio_risk_snapshots so a
risk profile computed for a subset of accounts (the dashboard's account
filter, §26 accounts feature) can be told apart from one computed for the
whole portfolio, without disturbing this table's existing append-only
history (§28: never overwrite, only add rows) — every row that already
exists gets NULL, meaning "built for every account", exactly what it was.

Revision ID: a1b2c3d4e5f7
Revises: f7c8d9e0a1b2
Create Date: 2026-09-14

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f7"
down_revision = "f7c8d9e0a1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "portfolio_risk_snapshots",
        sa.Column("account_ids_json", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("portfolio_risk_snapshots", "account_ids_json")
