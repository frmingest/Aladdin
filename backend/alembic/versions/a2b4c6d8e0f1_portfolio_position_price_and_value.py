"""Portfolio position last_price and market_value_nok

The broker-export CSV importer (app/services/portfolio_import/csv_parser.py)
has always parsed "siste kurs" (last traded price, in the security's own
trading currency — the same currency as cost_basis_currency) and "Verdi
NOK" (the position's total market value, in NOK, the snapshot's fixed
reporting currency) out of every row. Neither was ever persisted:
last_price was parsed into ParsedPosition.last_price and then simply never
read again, and value_nok was read only transiently to compute weight_pct
before being discarded. Both are genuinely lost today, not just hidden
from the frontend (see 2026-09-22's account-name/upload/macro-speed
session — Faiz's report: "the upload function is avoiding to save a lot of
valuable information about amount of stocks, price, GAV").

quantity and cost_basis (already-stored columns) are unaffected by this
migration — they were already being saved correctly, just never surfaced
in the frontend (a UI gap, fixed the same session, not a data gap).

Every existing row gets NULL for both new columns — there is no historical
last_price/value_nok to backfill from (the raw CSV bytes that would have
carried them were never kept per-value once parsed). CLAUDE.md Rule 1:
both are raw broker-reported figures, never derived/computed here.

Revision ID: a2b4c6d8e0f1
Revises: e5f6a7b8c9d0
Create Date: 2026-09-22

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a2b4c6d8e0f1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "portfolio_positions",
        sa.Column("last_price", sa.Numeric(20, 6), nullable=True),
    )
    op.add_column(
        "portfolio_positions",
        sa.Column("market_value_nok", sa.Numeric(20, 6), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("portfolio_positions", "market_value_nok")
    op.drop_column("portfolio_positions", "last_price")
