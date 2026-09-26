"""Sprint 12 — portfolio risk: price history cache (2026-09-26)

New table `price_history_observations`: a daily-close cache per ticker so
the correlation matrix and volatility-based stress sizing
(app/services/risk/price_history.py) don't re-fetch a year of daily
history from yfinance on every request. Additive only — no existing table
or column is touched.

Revision ID: a3f5c8d1e942
Revises: c7a1e9f3b2d5
Create Date: 2026-09-26

"""

import sqlalchemy as sa

from alembic import op
from app.models.types import GUID

revision = "a3f5c8d1e942"
down_revision = "c7a1e9f3b2d5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "price_history_observations",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("ticker", sa.String(32), nullable=False),
        sa.Column("observed_on", sa.Date(), nullable=False),
        sa.Column("close", sa.Numeric(20, 6), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("ticker", "observed_on", name="uq_price_history_ticker_observed"),
    )
    op.create_index(
        "ix_price_history_ticker_observed", "price_history_observations", ["ticker", "observed_on"]
    )


def downgrade() -> None:
    op.drop_index("ix_price_history_ticker_observed", table_name="price_history_observations")
    op.drop_table("price_history_observations")
