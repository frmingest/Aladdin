"""Phase 4 — external research: central-bank/macro data and qualitative research

Adds the tables backing Phase 4 (architecture §9.4, §20, §26):
research_runs, research_items, and macro_observations. Written by hand,
matching the Phase 1/2/3 migrations' approach — no live Postgres available
to autogenerate against in this build environment either (see
docs/decisions/0002's Consequences); `alembic upgrade head` applies all four
directly once Postgres is up.

Revision ID: c3f6a1d9e274
Revises: b2ad6aca76c1
Create Date: 2026-09-13

"""

import sqlalchemy as sa
from alembic import op

from app.models.types import GUID

# revision identifiers, used by Alembic.
revision = "c3f6a1d9e274"
down_revision = "b2ad6aca76c1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "research_runs",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("type", sa.String(16), nullable=False),
        sa.Column("sector", sa.String(128), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("methodology_version", sa.String(16), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
    )
    op.create_index("ix_research_runs_sector", "research_runs", ["sector"])
    op.create_index(
        "ix_research_runs_type_sector_completed",
        "research_runs",
        ["type", "sector", "completed_at"],
    )

    op.create_table(
        "research_items",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("research_run_id", GUID(), sa.ForeignKey("research_runs.id"), nullable=False),
        sa.Column("holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("source_name", sa.String(255), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("source_type", sa.String(32), nullable=False),
        sa.Column("relevance", sa.String(16), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=True),
    )
    op.create_index("ix_research_items_research_run_id", "research_items", ["research_run_id"])

    op.create_table(
        "macro_observations",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("series_key", sa.String(64), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("region", sa.String(8), nullable=False),
        sa.Column("value", sa.Numeric(20, 6), nullable=False),
        sa.Column("unit", sa.String(16), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_macro_observations_series_key", "macro_observations", ["series_key"])
    op.create_index(
        "ix_macro_observations_series_observed",
        "macro_observations",
        ["series_key", "observed_at"],
    )


def downgrade() -> None:
    op.drop_table("macro_observations")
    op.drop_table("research_items")
    op.drop_table("research_runs")
