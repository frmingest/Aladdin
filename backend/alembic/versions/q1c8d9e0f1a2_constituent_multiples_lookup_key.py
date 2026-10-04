"""Fund look-through: constituents without an ISIN

Two small changes on `fund_constituent_multiples`: `isin` becomes nullable
and a nullable `lookup_key` records what was actually sent to the P/E
provider (the line's ISIN, or the ticker of the app holding the line is
linked to). That lets a fund list with no ISINs (Heimdal Utbytte N) be
priced through its linked holdings without inventing an ISIN. Existing rows
keep their ISIN and a NULL lookup_key (the ISIN is then the key).

Revision ID: q1c8d9e0f1a2
Revises: p1b7c8d9e0f1
Create Date: 2026-10-04

"""

import sqlalchemy as sa

from alembic import op

revision = "q1c8d9e0f1a2"
down_revision = "p1b7c8d9e0f1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("fund_constituent_multiples") as batch:
        batch.alter_column("isin", existing_type=sa.String(12), nullable=True)
        batch.add_column(sa.Column("lookup_key", sa.String(64), nullable=True))


def downgrade() -> None:
    # Rows without an ISIN cannot go back into a NOT NULL column.
    op.execute("DELETE FROM fund_constituent_multiples WHERE isin IS NULL")
    with op.batch_alter_table("fund_constituent_multiples") as batch:
        batch.drop_column("lookup_key")
        batch.alter_column("isin", existing_type=sa.String(12), nullable=False)
