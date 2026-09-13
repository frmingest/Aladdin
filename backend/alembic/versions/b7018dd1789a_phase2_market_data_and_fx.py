"""Phase 2 — market data, FX, and financial metrics support

Adds the tables/columns backing Phase 2 (architecture §20, §26): a
market-data symbol on holdings, and the market_observations/fx_observations
tables that hold the point-in-time price/FX evidence behind computed
valuations (§8.3 provenance).

Written by hand, matching the Phase 1 migration's approach — see
docs/decisions/0002-phase1-portfolio-and-document-ingestion.md for why
(no live Postgres was available to autogenerate against at the time either
migration was authored; `alembic upgrade head` applies both directly once
Postgres is up).

Revision ID: b7018dd1789a
Revises: a0f4172c5989
Create Date: 2026-09-13

"""

import sqlalchemy as sa
from alembic import op

from app.models.types import GUID

# revision identifiers, used by Alembic.
revision = "b7018dd1789a"
down_revision = "a0f4172c5989"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("holdings", sa.Column("market_ticker", sa.String(64), nullable=True))
    op.create_index("ix_holdings_market_ticker", "holdings", ["market_ticker"])

    op.create_table(
        "market_observations",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("price", sa.Numeric(20, 6), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("data_status", sa.String(16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_market_observations_holding_id", "market_observations", ["holding_id"])
    op.create_index(
        "ix_market_observations_holding_observed",
        "market_observations",
        ["holding_id", "observed_at"],
    )

    op.create_table(
        "fx_observations",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("from_currency", sa.String(3), nullable=False),
        sa.Column("to_currency", sa.String(3), nullable=False),
        sa.Column("rate", sa.Numeric(20, 8), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_fx_observations_pair_observed",
        "fx_observations",
        ["from_currency", "to_currency", "observed_at"],
    )


def downgrade() -> None:
    op.drop_table("fx_observations")
    op.drop_table("market_observations")
    op.drop_index("ix_holdings_market_ticker", table_name="holdings")
    op.drop_column("holdings", "market_ticker")
