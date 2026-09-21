"""Full production data wipe — Faiz's explicit, in-conversation request

Faiz asked (2026-09-21, same session as the CSV-import ticker/duplicate-
holdings fix below) to wipe every row of real data in Supabase and start
fresh, after being told plainly what that costs: the 15 financial documents
already uploaded for 6 holdings (Alfred Berg, L&G Gold Mining, Salmon
Evolution, Var Energi, Xetra-Gold, Xtrackers), the whisky/gold/silver
legacy holdings, all 5 accounts / 7 snapshots / 124 positions, and the
Sprint 4 analysis-engine tables (never yet run against real data). He
confirmed "full wipe, really everything" after that warning.

This supersedes CLAUDE.md's "the DB is not being reset" decision at his
explicit ask this session — the same pattern the /portfolio/all wipe
endpoint's own docstring already established for narrower resets.

Implementation: TRUNCATE every table in the `public` schema except
`alembic_version` itself (truncating that would make Alembic think no
migration has ever run and try to replay the whole chain against
already-existing tables). Reflects the actual table list from Postgres at
migration time rather than hand-listing tables, so nothing is missed and
this stays correct even if a table gets renamed later. RESTART IDENTITY
CASCADE handles FK ordering and any serial sequences in one statement.

Deliberately NOT a hand-run script against the live DB (CLAUDE.md: "never
hand-edit production data as a substitute for a migration") — this ships
as a normal migration and runs the same way every other schema change in
this app does, via `alembic upgrade head` on Railway's container startup.

Revision ID: e5f6a7b8c9d0
Revises: b5e1a9c3d7f2
Create Date: 2026-09-21

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "e5f6a7b8c9d0"
down_revision = "b5e1a9c3d7f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "select tablename from pg_tables "
            "where schemaname = 'public' and tablename != 'alembic_version'"
        )
    )
    tables = [row[0] for row in result]
    if not tables:
        return
    quoted = ", ".join(f'"{t}"' for t in tables)
    conn.execute(sa.text(f"TRUNCATE TABLE {quoted} RESTART IDENTITY CASCADE"))


def downgrade() -> None:
    # Not reversible. The point of this migration is permanent deletion at
    # Faiz's explicit request — a downgrade that silently "succeeded"
    # without restoring anything would be more misleading than useful, so
    # this intentionally does nothing rather than pretending data can come
    # back.
    pass
