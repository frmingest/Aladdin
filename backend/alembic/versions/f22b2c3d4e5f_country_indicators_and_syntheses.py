"""Epic F22 phase 2 (Sprint 17): country indicators + analyst syntheses.

- country_indicators (story 22.10): annual World Bank / WGI figures per
  country for the slim Sovereign Stress Index ported from the CWO repo.
- analyst_syntheses (story 22.8): the optional, labelled "where they'd
  argue" pass over one Buffett/Munger run and one Dalio run.

Additive only: no existing table or column is touched.

Revision ID: f22b2c3d4e5f
Revises: f22a1b2c3d4e
Create Date: 2026-09-27

"""

import sqlalchemy as sa

from alembic import op
from app.models.types import GUID

revision = "f22b2c3d4e5f"
down_revision = "f22a1b2c3d4e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "country_indicators",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("country_code", sa.String(3), nullable=False),
        sa.Column("indicator_code", sa.String(32), nullable=False),
        sa.Column("data_year", sa.Integer(), nullable=False),
        sa.Column("value", sa.Numeric(20, 6), nullable=False),
        sa.Column("source", sa.String(32), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_country_indicators_country_indicator",
        "country_indicators",
        ["country_code", "indicator_code", "data_year"],
    )
    op.create_table(
        "analyst_syntheses",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=False),
        sa.Column("buffett_run_id", GUID(), sa.ForeignKey("equity_analysis_runs.id"), nullable=False),
        sa.Column("dalio_run_id", GUID(), sa.ForeignKey("equity_analysis_runs.id"), nullable=False),
        sa.Column("schema_version", sa.String(16), nullable=False),
        sa.Column("prompt_version", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("provider", sa.String(32), nullable=True),
        sa.Column("model_name", sa.String(64), nullable=True),
        sa.Column("output_json", sa.JSON(), nullable=True),
        sa.Column("citation_warnings", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_analyst_syntheses_holding_created", "analyst_syntheses", ["holding_id", "created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_analyst_syntheses_holding_created", table_name="analyst_syntheses")
    op.drop_table("analyst_syntheses")
    op.drop_index("ix_country_indicators_country_indicator", table_name="country_indicators")
    op.drop_table("country_indicators")
