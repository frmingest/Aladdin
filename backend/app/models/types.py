"""Cross-dialect GUID column type.

Stores as Postgres's native UUID on postgres (what production/Supabase
uses), and as a 32-char hex string on any other dialect (SQLite, used by
the test suite) — the standard SQLAlchemy recipe for a portable UUID
primary/foreign key. Referenced by every model's `id`/`*_id` column so
Alembic migrations (which already use this same `GUID()`, see
alembic/versions/) and the ORM models agree on column type.
"""
from __future__ import annotations

import uuid

from sqlalchemy import CHAR, TypeDecorator
from sqlalchemy.dialects.postgresql import UUID as PGUUID


class GUID(TypeDecorator):
    """Platform-independent UUID column: Postgres UUID, else CHAR(32) hex."""

    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PGUUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(32))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            return str(value)
        if not isinstance(value, uuid.UUID):
            value = uuid.UUID(value)
        return value.hex

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(value)
