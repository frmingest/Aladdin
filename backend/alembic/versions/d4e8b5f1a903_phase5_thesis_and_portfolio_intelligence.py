"""Phase 5 — thesis & portfolio intelligence: theses, valuation cases, risk snapshots

Adds the tables backing Phase 5 (architecture §16, §17, §15, §15.1, §18,
§20, §26): investment_theses, valuation_cases, and portfolio_risk_snapshots.
Written by hand, matching the Phase 1-4 migrations' approach — no live
Postgres available to autogenerate against in this build environment either
(see docs/decisions/0002's Consequences); `alembic upgrade head` applies all
five directly once Postgres is up.

Revision ID: d4e8b5f1a903
Revises: c3f6a1d9e274
Create Date: 2026-09-13

"""

import sqlalchemy as sa
from alembic import op

from app.models.types import GUID

# revision identifiers, used by Alembic.
revision = "d4e8b5f1a903"
down_revision = "c3f6a1d9e274"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "investment_theses",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=False),
        sa.Column("thesis", sa.Text(), nullable=False),
        sa.Column("bull_case", sa.Text(), nullable=True),
        sa.Column("bear_case", sa.Text(), nullable=True),
        sa.Column("key_assumptions_json", sa.JSON(), nullable=False),
        sa.Column("invalidation_conditions_json", sa.JSON(), nullable=False),
        sa.Column("confidence", sa.String(8), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_investment_theses_holding_id", "investment_theses", ["holding_id"])

    op.create_table(
        "valuation_cases",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=False),
        sa.Column("analysis_run_id", GUID(), sa.ForeignKey("analysis_runs.id"), nullable=True),
        sa.Column("case_type", sa.String(8), nullable=False),
        sa.Column("assumptions_json", sa.JSON(), nullable=False),
        sa.Column("calculated_value", sa.Numeric(24, 6), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("confidence", sa.String(8), nullable=False),
        sa.Column("calculation_note", sa.String(255), nullable=True),
        sa.Column("critique_json", sa.JSON(), nullable=True),
        sa.Column("critique_error", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_valuation_cases_holding_id", "valuation_cases", ["holding_id"])
    op.create_index("ix_valuation_cases_analysis_run_id", "valuation_cases", ["analysis_run_id"])

    op.create_table(
        "portfolio_risk_snapshots",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column(
            "portfolio_snapshot_id", GUID(), sa.ForeignKey("portfolio_snapshots.id"), nullable=False
        ),
        sa.Column("analysis_run_id", GUID(), sa.ForeignKey("analysis_runs.id"), nullable=True),
        sa.Column("concentration_json", sa.JSON(), nullable=False),
        sa.Column("correlation_json", sa.JSON(), nullable=False),
        sa.Column("exposure_json", sa.JSON(), nullable=False),
        sa.Column("scenario_json", sa.JSON(), nullable=False),
        sa.Column("systemic_state_risk_json", sa.JSON(), nullable=False),
        sa.Column("risk_band", sa.String(24), nullable=False),
        sa.Column("composite_risk_score", sa.Numeric(6, 2), nullable=True),
        sa.Column("narrative", sa.Text(), nullable=False),
        sa.Column("risk_scoring_version", sa.String(16), nullable=False),
        sa.Column("scenario_version", sa.String(16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_portfolio_risk_snapshots_portfolio_snapshot_id",
        "portfolio_risk_snapshots",
        ["portfolio_snapshot_id"],
    )
    op.create_index(
        "ix_portfolio_risk_snapshots_analysis_run_id", "portfolio_risk_snapshots", ["analysis_run_id"]
    )


def downgrade() -> None:
    op.drop_table("portfolio_risk_snapshots")
    op.drop_table("valuation_cases")
    op.drop_table("investment_theses")
