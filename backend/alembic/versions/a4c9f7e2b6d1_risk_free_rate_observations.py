"""Sprint 3 — risk-free-rate observations

Adds risk_free_rate_observations: point-in-time government-bond-yield
observations (one row per currency per fetch) backing the DCF discount
rate (cost of equity = risk-free rate + beta * ERP — see
app/services/valuation/discount_rate.py and
claude/buffett-munger-rebuild-sprint-plan-2026-09-21.md, Sprint 3).

Mirrors market_observations/fx_observations (b7018dd1789a) — same
provenance columns (`provider`, `created_at`) so a rate used in a real DCF
run is always traceable to what fetched it and when (CLAUDE.md Rule 2).
`source_series_id` additionally records the exact upstream series (e.g.
FRED's "DGS10") an observation came from, one level more specific than
`provider` alone (FRED serves many series).

Revision ID: a4c9f7e2b6d1
Revises: 833738bc967f
Create Date: 2026-09-21

"""

import sqlalchemy as sa
from alembic import op

from app.models.types import GUID

# revision identifiers, used by Alembic.
revision = "a4c9f7e2b6d1"
down_revision = "833738bc967f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "risk_free_rate_observations",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("rate", sa.Numeric(10, 6), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("source_series_id", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_risk_free_rate_observations_currency_observed",
        "risk_free_rate_observations",
        ["currency", "observed_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_risk_free_rate_observations_currency_observed",
        table_name="risk_free_rate_observations",
    )
    op.drop_table("risk_free_rate_observations")
