"""Phase 3 — AI analysis engine

Adds the analysis-run tables (architecture §10, §20, §26): analysis_runs,
holding_analyses, factor_assessments, evidence_references. See
docs/decisions/0006-phase3-ai-analysis-engine.md for the reasoning behind
the two naming deviations from §20's illustrative schema
(evidence_references.holding_analysis_id, and no separate "analyses"
concept beyond the holding level this phase).

Written by hand, matching the Phase 1/2 migrations' approach — see
docs/decisions/0002's rationale (no live Postgres available to autogenerate
against at the time either was authored; `alembic upgrade head` applies all
three directly once Postgres is up).

Revision ID: b2ad6aca76c1
Revises: b7018dd1789a
Create Date: 2026-09-13

"""

import sqlalchemy as sa
from alembic import op

from app.models.types import GUID

# revision identifiers, used by Alembic.
revision = "b2ad6aca76c1"
down_revision = "b7018dd1789a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "analysis_runs",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("portfolio_snapshot_id", GUID(), sa.ForeignKey("portfolio_snapshots.id"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("model_name", sa.String(64), nullable=False),
        sa.Column("prompt_version", sa.String(16), nullable=False),
        sa.Column("scoring_version", sa.String(16), nullable=False),
        sa.Column("extraction_schema_version", sa.String(16), nullable=False),
        sa.Column("application_version", sa.String(32), nullable=False),
        sa.Column("research_snapshot_id", GUID(), nullable=True),
        sa.Column("requested_holding_ids", sa.JSON(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
    )
    op.create_index("ix_analysis_runs_portfolio_snapshot_id", "analysis_runs", ["portfolio_snapshot_id"])

    op.create_table(
        "holding_analyses",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("analysis_run_id", GUID(), sa.ForeignKey("analysis_runs.id"), nullable=False),
        sa.Column("holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=False),
        sa.Column("structured_output_json", sa.JSON(), nullable=False),
        sa.Column("overall_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("confidence", sa.String(8), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_holding_analyses_analysis_run_id", "holding_analyses", ["analysis_run_id"])
    op.create_index("ix_holding_analyses_holding_id", "holding_analyses", ["holding_id"])

    op.create_table(
        "factor_assessments",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("holding_analysis_id", GUID(), sa.ForeignKey("holding_analyses.id"), nullable=False),
        sa.Column("factor", sa.String(32), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("confidence", sa.String(8), nullable=False),
        sa.Column("methodology", sa.String(16), nullable=False),
        sa.Column("reasoning", sa.Text(), nullable=False),
    )
    op.create_index("ix_factor_assessments_holding_analysis_id", "factor_assessments", ["holding_analysis_id"])

    op.create_table(
        "evidence_references",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("holding_analysis_id", GUID(), sa.ForeignKey("holding_analyses.id"), nullable=False),
        sa.Column("source_type", sa.String(32), nullable=False),
        sa.Column("source_id", sa.String(64), nullable=False),
        sa.Column("page_start", sa.Integer(), nullable=True),
        sa.Column("page_end", sa.Integer(), nullable=True),
        sa.Column("section", sa.String(255), nullable=True),
        sa.Column("relevance", sa.String(16), nullable=False),
    )
    op.create_index("ix_evidence_references_holding_analysis_id", "evidence_references", ["holding_analysis_id"])


def downgrade() -> None:
    op.drop_table("evidence_references")
    op.drop_table("factor_assessments")
    op.drop_table("holding_analyses")
    op.drop_table("analysis_runs")
