"""LLM usage ledger goes live: outcome + error detail on llm_usage_events

Sprint 15 item #1. `llm_usage_events` already exists (c7e2f9a1b8d3, pre-rebuild)
and is reused rather than replaced. Additive only:

- `outcome`: success | error | blocked_by_budget. Existing rows were all real
  successful calls, so the server default backfills them correctly.
- `error_detail`: short reason for an error / blocked row.
- Composite index (provider, occurred_at) for the "calls today per provider"
  count the budget guard runs before every Gemini call.

Revision ID: l1d2e3f4a5b6
Revises: f22b2c3d4e5f
Create Date: 2026-09-28

"""

import sqlalchemy as sa

from alembic import op

revision = "l1d2e3f4a5b6"
down_revision = "f22b2c3d4e5f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "llm_usage_events",
        sa.Column("outcome", sa.String(24), nullable=False, server_default="success"),
    )
    op.add_column("llm_usage_events", sa.Column("error_detail", sa.String(240), nullable=True))
    op.create_index(
        "ix_llm_usage_events_provider_occurred_at",
        "llm_usage_events",
        ["provider", "occurred_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_llm_usage_events_provider_occurred_at", table_name="llm_usage_events")
    op.drop_column("llm_usage_events", "error_detail")
    op.drop_column("llm_usage_events", "outcome")
