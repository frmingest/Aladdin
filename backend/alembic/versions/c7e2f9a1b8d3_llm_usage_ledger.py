"""LLM usage ledger

Adds llm_usage_events (§28 observability follow-up — see docs/decisions/
0013-llm-usage-ledger-and-rate-limit-estimation.md): one append-only row per
real Gemini call (analysis blind/reconciliation passes, macro/sector research
grounding), populated straight from the vendor's usage_metadata. Backs the
new /usage/summary endpoint's "how many more holding analyses today"
estimate.

Written by hand, matching every migration since Phase 3's approach (no live
Postgres available to autogenerate against from this session either).

Revision ID: c7e2f9a1b8d3
Revises: a1b2c3d4e5f7
Create Date: 2026-09-14

"""

import sqlalchemy as sa
from alembic import op

from app.models.types import GUID

# revision identifiers, used by Alembic.
revision = "c7e2f9a1b8d3"
down_revision = "a1b2c3d4e5f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "llm_usage_events",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("model_name", sa.String(64), nullable=False),
        sa.Column("call_type", sa.String(32), nullable=False),
        sa.Column("prompt_version", sa.String(16), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("latency_ms", sa.Float(), nullable=True),
        sa.Column("holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=True),
        sa.Column("analysis_run_id", GUID(), sa.ForeignKey("analysis_runs.id"), nullable=True),
        sa.Column("holding_analysis_id", GUID(), sa.ForeignKey("holding_analyses.id"), nullable=True),
        sa.Column("sector", sa.String(128), nullable=True),
    )
    op.create_index("ix_llm_usage_events_occurred_at", "llm_usage_events", ["occurred_at"])
    op.create_index("ix_llm_usage_events_holding_id", "llm_usage_events", ["holding_id"])
    op.create_index("ix_llm_usage_events_analysis_run_id", "llm_usage_events", ["analysis_run_id"])


def downgrade() -> None:
    op.drop_index("ix_llm_usage_events_analysis_run_id", table_name="llm_usage_events")
    op.drop_index("ix_llm_usage_events_holding_id", table_name="llm_usage_events")
    op.drop_index("ix_llm_usage_events_occurred_at", table_name="llm_usage_events")
    op.drop_table("llm_usage_events")
