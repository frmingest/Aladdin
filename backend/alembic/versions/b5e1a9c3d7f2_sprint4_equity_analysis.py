"""Sprint 4 — equity analysis engine (the Buffett/Munger persona)

Adds two new tables for this rebuild's own analysis engine, deliberately
NOT extending the legacy `analysis_runs`/`holding_analyses` tables mapped
read/delete-only in app/models/legacy_analysis.py — that Phase 3 schema
predates this rebuild's evidence-first, versioned-schema design and
CLAUDE.md says this sprint gets its own schema built fresh, not the old
one extended in place.

- `equity_analysis_runs`: one row per analysis run for one holding. Stores
  the exact evidence packet used (`evidence_packet_json`), the blind pass
  output and the reconciliation pass output (each the raw structured JSON
  the LLM returned, validated against the versioned pydantic schema in
  app/domain/analysis_schema/ before being stored), the prompt/schema
  versions that produced them (CLAUDE.md Rule 3 — full traceability), and
  the deterministic price-target range (computed from the Sprint 3 DCF
  bull/bear scenarios in Python, never by the LLM — CLAUDE.md Rule 1).
- `equity_holding_notes`: the portfolio owner's own freeform thesis/notes
  on a holding, one row per holding, editable independent of any specific
  run. Never read by the blind pass (CLAUDE.md Rule 4 — the confirmation-
  bias guardrail) — only the reconciliation pass reads this table.

Revision ID: b5e1a9c3d7f2
Revises: a4c9f7e2b6d1
Create Date: 2026-09-21

"""

import sqlalchemy as sa

from alembic import op
from app.models.types import GUID

# revision identifiers, used by Alembic.
revision = "b5e1a9c3d7f2"
down_revision = "a4c9f7e2b6d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "equity_analysis_runs",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("schema_version", sa.String(16), nullable=False),
        sa.Column("blind_prompt_version", sa.String(16), nullable=False),
        sa.Column("reconciliation_prompt_version", sa.String(16), nullable=True),
        sa.Column("evidence_packet_version", sa.String(16), nullable=False),
        sa.Column("provider", sa.String(32), nullable=True),
        sa.Column("model_name", sa.String(64), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("blind_completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("evidence_packet_json", sa.JSON(), nullable=False),
        sa.Column("evidence_unavailable_reasons", sa.JSON(), nullable=False),
        sa.Column("blind_pass_json", sa.JSON(), nullable=True),
        sa.Column("blind_pass_citation_warnings", sa.JSON(), nullable=True),
        sa.Column("user_notes_snapshot", sa.Text(), nullable=True),
        sa.Column("reconciliation_json", sa.JSON(), nullable=True),
        sa.Column("reconciliation_citation_warnings", sa.JSON(), nullable=True),
        sa.Column("price_target_low", sa.Numeric(18, 4), nullable=True),
        sa.Column("price_target_high", sa.Numeric(18, 4), nullable=True),
        sa.Column("price_target_currency", sa.String(3), nullable=True),
    )
    op.create_index(
        "ix_equity_analysis_runs_holding_completed",
        "equity_analysis_runs",
        ["holding_id", "completed_at"],
    )

    op.create_table(
        "equity_holding_notes",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column(
            "holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=False, unique=True
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("equity_holding_notes")
    op.drop_index("ix_equity_analysis_runs_holding_completed", table_name="equity_analysis_runs")
    op.drop_table("equity_analysis_runs")
