"""Accounts

Adds an `accounts` table (one row per real-world custody/brokerage account)
and an `account_id` FK on both portfolio_snapshots and portfolio_positions,
so every upload and every position within it can be tagged with, filtered
by, and displayed against the account it actually belongs to. Seeds the five
accounts Faiz gave at setup time so the feature is usable immediately
without a manual data-entry step first.

`account_id` is nullable on both tables — every snapshot/position that
existed before this migration is left unassigned rather than guessed at
(§21: fail visibly, don't silently invent).

Revision ID: f7c8d9e0a1b2
Revises: e1a2b3c4d5f6
Create Date: 2026-09-14

"""

import uuid
from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op

from app.models.types import GUID

# revision identifiers, used by Alembic.
revision = "f7c8d9e0a1b2"
down_revision = "e1a2b3c4d5f6"
branch_labels = None
depends_on = None

_SEED_ACCOUNTS = [
    {"name": "Aksje & fonds konto", "account_number": "70541644", "institution": None},
    {"name": "ASK konto", "account_number": "24175564", "institution": None},
    {"name": "Ezra's ASK konto", "account_number": "50911270", "institution": None},
    {"name": "EPK Passiv konto", "account_number": "73898074", "institution": None},
    {"name": "EPK Aktiv konto", "account_number": "73898066", "institution": None},
]


def upgrade() -> None:
    accounts_table = op.create_table(
        "accounts",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("account_number", sa.String(64), nullable=False),
        sa.Column("institution", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("account_number", name="uq_accounts_account_number"),
    )
    op.create_index("ix_accounts_account_number", "accounts", ["account_number"])

    now = datetime.now(timezone.utc)
    op.bulk_insert(
        accounts_table,
        [
            {
                "id": uuid.uuid4(),
                "name": seed["name"],
                "account_number": seed["account_number"],
                "institution": seed["institution"],
                "created_at": now,
                "updated_at": now,
            }
            for seed in _SEED_ACCOUNTS
        ],
    )

    op.add_column("portfolio_snapshots", sa.Column("account_id", GUID(), nullable=True))
    op.create_foreign_key(
        "fk_portfolio_snapshots_account_id",
        "portfolio_snapshots",
        "accounts",
        ["account_id"],
        ["id"],
    )
    op.create_index(
        "ix_portfolio_snapshots_account_id", "portfolio_snapshots", ["account_id"]
    )

    op.add_column("portfolio_positions", sa.Column("account_id", GUID(), nullable=True))
    op.create_foreign_key(
        "fk_portfolio_positions_account_id",
        "portfolio_positions",
        "accounts",
        ["account_id"],
        ["id"],
    )
    op.create_index(
        "ix_portfolio_positions_account_id", "portfolio_positions", ["account_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_portfolio_positions_account_id", table_name="portfolio_positions")
    op.drop_constraint(
        "fk_portfolio_positions_account_id", "portfolio_positions", type_="foreignkey"
    )
    op.drop_column("portfolio_positions", "account_id")

    op.drop_index("ix_portfolio_snapshots_account_id", table_name="portfolio_snapshots")
    op.drop_constraint(
        "fk_portfolio_snapshots_account_id", "portfolio_snapshots", type_="foreignkey"
    )
    op.drop_column("portfolio_snapshots", "account_id")

    op.drop_index("ix_accounts_account_number", table_name="accounts")
    op.drop_table("accounts")
