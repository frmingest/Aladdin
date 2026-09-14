"""Widen holdings.ticker

Fixes a production bug: a Nordnet Beholdningstabell export (decision 0003)
has no exchange ticker, so the full instrument name is used as `ticker`
instead. Fund names such as "Alfred Berg Nordic High Yield II R (NOK)" (41
chars) and "Xtrackers Europe Defence Technologies UCITS ETF 1C" (51 chars)
exceed the original varchar(32), which SQLite (the test suite's DB) silently
truncates but Postgres rejects outright with
`psycopg2.errors.StringDataRightTruncation: value too long for type
character varying(32)` — this is exactly what made 2 of Faiz's 5 account
exports fail to upload while the other 3 (whose instrument names happen to
be short) succeeded. Widened to 255 to match `holdings.name`, since the two
are the same value for a Nordnet-sourced holding.

Revision ID: e1a2b3c4d5f6
Revises: d4e8b5f1a903
Create Date: 2026-09-14

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "e1a2b3c4d5f6"
down_revision = "d4e8b5f1a903"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "holdings",
        "ticker",
        existing_type=sa.String(32),
        type_=sa.String(255),
        existing_nullable=False,
    )


def downgrade() -> None:
    # Not reversible without risking truncation of already-widened data —
    # existing Nordnet-sourced tickers longer than 32 chars would silently
    # lose data on downgrade, which violates §21 ("fail visibly"). Truncate
    # explicitly here instead of letting Postgres do it silently, so anyone
    # who does need to downgrade at least gets a deliberate, visible cut.
    op.execute("UPDATE holdings SET ticker = substring(ticker for 32) WHERE length(ticker) > 32")
    op.alter_column(
        "holdings",
        "ticker",
        existing_type=sa.String(255),
        type_=sa.String(32),
        existing_nullable=False,
    )
