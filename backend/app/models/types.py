"""
Cross-dialect column types.

Production runs on PostgreSQL (architecture §31, decision 1); the test suite
runs against a temporary SQLite database so tests don't require Docker/Postgres
to be installed (see docs/architecture.md §22.1 — unit/integration tests should
not depend on external infrastructure). SQLAlchemy's native UUID type isn't
portable across both, so this module provides a TypeDecorator that stores a
real UUID column on Postgres and a CHAR(36) column on everything else.
"""

import uuid

from sqlalchemy import CHAR
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.types import TypeDecorator


class GUID(TypeDecorator):
    """Platform-independent UUID column — native UUID on Postgres, CHAR(36) elsewhere."""

    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return str(value)
        if not isinstance(value, uuid.UUID):
            return str(uuid.UUID(value))
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(value)


def new_uuid() -> uuid.UUID:
    return uuid.uuid4()
