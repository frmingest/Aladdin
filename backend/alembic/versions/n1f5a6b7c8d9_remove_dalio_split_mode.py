"""Remove the Ray Dalio / split-mode (Epic F22) data model.

Faiz decided (2026-09-29) that the analyst modes add complexity the app does
not need at this stage. The code was removed; this migration cleans the
database of what migrations f22a1b2c3d4e / f22b2c3d4e5f created.

The two F22 migrations stay in the chain on purpose: Railway may already have
applied them, and deleting an applied revision would leave the database
pointing at an unknown revision. This one runs after them and undoes them.

- deletes Dalio runs (persona = 'dalio') and anything pointing at them
- drops analyst_syntheses and country_indicators
- drops equity_analysis_runs.persona / auto_queued and their index
- removes the two app_settings keys the mode switch used

Every Buffett/Munger run is untouched. The downgrade re-creates the empty
structures (the deleted Dalio rows cannot be restored).

Revision ID: n1f5a6b7c8d9
Revises: m1e3f4a5b6c7
Create Date: 2026-09-29

"""

import sqlalchemy as sa

from alembic import op
from app.models.types import GUID

revision = "n1f5a6b7c8d9"
down_revision = "m1e3f4a5b6c7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "analyst_syntheses" in tables:
        op.drop_table("analyst_syntheses")
    if "country_indicators" in tables:
        op.drop_table("country_indicators")

    run_columns = {c["name"] for c in inspector.get_columns("equity_analysis_runs")}
    if "persona" in run_columns:
        # Tripwires can only have been made from Buffett runs, but detach any
        # that point at a Dalio run so the delete cannot hit a foreign key.
        bind.execute(
            sa.text(
                "UPDATE thesis_tripwires SET source_run_id = NULL WHERE source_run_id IN "
                "(SELECT id FROM equity_analysis_runs WHERE persona = 'dalio')"
            )
        )
        bind.execute(sa.text("DELETE FROM equity_analysis_runs WHERE persona = 'dalio'"))
        index_names = {i["name"] for i in inspector.get_indexes("equity_analysis_runs")}
        with op.batch_alter_table("equity_analysis_runs") as batch:
            if "ix_equity_analysis_runs_holding_persona_started" in index_names:
                batch.drop_index("ix_equity_analysis_runs_holding_persona_started")
            batch.drop_column("auto_queued")
            batch.drop_column("persona")

    if "app_settings" in tables:
        bind.execute(
            sa.text("DELETE FROM app_settings WHERE key IN ('analyst_mode', 'analyst_synthesis_enabled')")
        )


def downgrade() -> None:
    op.add_column(
        "equity_analysis_runs",
        sa.Column("persona", sa.String(24), nullable=False, server_default="buffett_munger"),
    )
    op.add_column(
        "equity_analysis_runs",
        sa.Column("auto_queued", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index(
        "ix_equity_analysis_runs_holding_persona_started",
        "equity_analysis_runs",
        ["holding_id", "persona", "started_at"],
    )
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
