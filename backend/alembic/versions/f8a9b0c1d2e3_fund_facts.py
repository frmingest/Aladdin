"""Fund / ETF facts (Sprint 8, F9): fund_profiles, fund_return_periods,
fund_exposures.

Additive only: three new tables, no existing table or column touched. Every
row cites the uploaded document it came from (source_document_id NOT NULL),
see app/models/fund.py.

Revision ID: f8a9b0c1d2e3
Revises: e6f7a8b9c0d1
Create Date: 2026-09-24

"""

import sqlalchemy as sa

from alembic import op
from app.models.types import GUID

revision = "f8a9b0c1d2e3"
down_revision = "e6f7a8b9c0d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fund_profiles",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=False, unique=True),
        sa.Column("management_style", sa.String(16), nullable=False),
        sa.Column("benchmark_name", sa.String(255), nullable=True),
        sa.Column("ongoing_charge_pct", sa.Numeric(7, 4), nullable=True),
        sa.Column("performance_fee", sa.String(255), nullable=True),
        sa.Column("domicile", sa.String(64), nullable=True),
        sa.Column("base_currency", sa.String(3), nullable=True),
        sa.Column("replication", sa.String(32), nullable=True),
        sa.Column("distribution", sa.String(16), nullable=True),
        sa.Column("fund_size", sa.Numeric(20, 2), nullable=True),
        sa.Column("fund_size_currency", sa.String(3), nullable=True),
        sa.Column("inception_date", sa.Date(), nullable=True),
        sa.Column("risk_class", sa.Integer(), nullable=True),
        sa.Column("holdings_count", sa.Integer(), nullable=True),
        sa.Column("strategy_summary", sa.Text(), nullable=True),
        sa.Column("report_name_filter", sa.String(255), nullable=True),
        sa.Column("as_of_date", sa.Date(), nullable=True),
        sa.Column("source_document_id", GUID(), sa.ForeignKey("documents.id"), nullable=False),
        sa.Column("source_page", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "fund_return_periods",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=False),
        sa.Column("period_kind", sa.String(24), nullable=False),
        sa.Column("period_label", sa.String(64), nullable=False),
        sa.Column("years", sa.Numeric(7, 3), nullable=True),
        sa.Column("annualised", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("fund_return_pct", sa.Numeric(9, 4), nullable=False),
        sa.Column("benchmark_return_pct", sa.Numeric(9, 4), nullable=True),
        sa.Column("benchmark_name", sa.String(255), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("source_document_id", GUID(), sa.ForeignKey("documents.id"), nullable=False),
        sa.Column("source_page", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_fund_return_periods_holding", "fund_return_periods", ["holding_id"])
    op.create_table(
        "fund_exposures",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=False),
        sa.Column("dimension", sa.String(16), nullable=False),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column("weight_pct", sa.Numeric(9, 4), nullable=False),
        sa.Column("ticker", sa.String(64), nullable=True),
        sa.Column("isin", sa.String(12), nullable=True),
        sa.Column("linked_holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=True),
        sa.Column("link_method", sa.String(16), nullable=True),
        sa.Column("as_of_date", sa.Date(), nullable=False),
        sa.Column("source_document_id", GUID(), sa.ForeignKey("documents.id"), nullable=False),
        sa.Column("source_page", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_fund_exposures_holding_dimension", "fund_exposures", ["holding_id", "dimension", "as_of_date"]
    )


def downgrade() -> None:
    op.drop_index("ix_fund_exposures_holding_dimension", table_name="fund_exposures")
    op.drop_table("fund_exposures")
    op.drop_index("ix_fund_return_periods_holding", table_name="fund_return_periods")
    op.drop_table("fund_return_periods")
    op.drop_table("fund_profiles")
