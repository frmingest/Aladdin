"""Analysis run macro regime

ECON-002 fix (docs/decisions/0014-macro-economic-review.md, architecture
§13.1): adds a NOT NULL `macro_regime` column to analysis_runs recording
which named factor-weight profile (app.domain.scoring, scoring/versions/
{scoring_version}.yaml) was actually used for every holding in that run —
"baseline" for every existing row, which is also the correct historical
answer (no scoring version prior to v2 defined any other profile, so every
run before this migration was, in effect, a baseline run).

Written by hand, matching every migration since Phase 3's approach (no live
Postgres available to autogenerate against from this session either).

Revision ID: d8f3a6b2c710
Revises: c7e2f9a1b8d3
Create Date: 2026-09-14

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "d8f3a6b2c710"
down_revision = "c7e2f9a1b8d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "analysis_runs",
        sa.Column("macro_regime", sa.String(16), nullable=False, server_default="baseline"),
    )
    # Drop the server default once existing rows are backfilled — new rows
    # should always pass macro_regime explicitly (app.services.analysis.
    # runner), not silently fall back to a DB-level default (§28: no silent
    # substitution of a value the caller didn't provide).
    op.alter_column("analysis_runs", "macro_regime", server_default=None)


def downgrade() -> None:
    op.drop_column("analysis_runs", "macro_regime")
