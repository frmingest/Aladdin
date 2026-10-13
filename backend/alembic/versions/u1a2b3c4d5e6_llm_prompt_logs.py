"""LLM prompt log (System status: see exactly what the app prompted)

One new, additive table: `llm_prompt_logs`. No existing table or column is
touched.

Revision ID: u1a2b3c4d5e6
Revises: t1f2a3b4c5d6
Create Date: 2026-10-13

"""

import sqlalchemy as sa

from alembic import op
from app.models.types import GUID

revision = "u1a2b3c4d5e6"
down_revision = "t1f2a3b4c5d6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "llm_prompt_logs",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("model_name", sa.String(64), nullable=False),
        sa.Column("call_type", sa.String(32), nullable=False),
        sa.Column("schema_name", sa.String(96), nullable=True),
        sa.Column("system_prompt", sa.Text(), nullable=True),
        sa.Column("user_prompt", sa.Text(), nullable=False),
        sa.Column("response_text", sa.Text(), nullable=True),
        sa.Column("outcome", sa.String(24), nullable=False),
        sa.Column("error_detail", sa.String(480), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("latency_ms", sa.Float(), nullable=True),
        sa.Column("prompt_chars", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_llm_prompt_logs_occurred_at", "llm_prompt_logs", ["occurred_at"])


def downgrade() -> None:
    op.drop_index("ix_llm_prompt_logs_occurred_at", table_name="llm_prompt_logs")
    op.drop_table("llm_prompt_logs")
