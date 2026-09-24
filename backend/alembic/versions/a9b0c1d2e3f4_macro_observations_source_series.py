"""Numeric macro data (2026-09-24): macro_observations.source_series_id
+ macro_series_status

`macro_observations` was created by the pre-reset Phase 4 migration
(c3f6a1d9e274) and has never been dropped, so it exists in the real
database. This adds one nullable column recording the publisher's own
series id (e.g. "IR/B.KPRA.SD.R", "DGS10"). Additive only; legacy rows, if
any, keep NULL and are never read (their series keys differ from the new
catalogue's). Also adds `macro_series_status` (new table): last fetch
attempt/success/error per catalogue series.

Defensive: if the table is somehow missing it is created with the full
column set, so upgrade works on any database reached through this chain.

Revision ID: a9b0c1d2e3f4
Revises: f8a9b0c1d2e3
Create Date: 2026-09-24

"""

import sqlalchemy as sa

from alembic import op
from app.models.types import GUID

revision = "a9b0c1d2e3f4"
down_revision = "f8a9b0c1d2e3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "macro_series_status",
        sa.Column("series_key", sa.String(64), primary_key=True),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("last_inserted", sa.Integer(), nullable=False, server_default="0"),
    )
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("macro_observations"):
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
            sa.Column("source_series_id", sa.String(64), nullable=True),
        )
        op.create_index("ix_macro_observations_series_key", "macro_observations", ["series_key"])
        op.create_index(
            "ix_macro_observations_series_observed", "macro_observations", ["series_key", "observed_at"]
        )
        return
    columns = {column["name"] for column in inspector.get_columns("macro_observations")}
    if "source_series_id" not in columns:
        op.add_column("macro_observations", sa.Column("source_series_id", sa.String(64), nullable=True))


def downgrade() -> None:
    # Only the column this revision added; the table itself belongs to
    # c3f6a1d9e274.
    op.drop_column("macro_observations", "source_series_id")
    op.drop_table("macro_series_status")
