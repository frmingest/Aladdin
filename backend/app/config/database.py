"""SQLAlchemy engine and session management.

Postgres (Supabase) is the system of record — see CLAUDE.md's "Database"
section (the schema is not being reset; this rebuild's models simply never
touch the legacy non-equity tables/columns). Models live under app/models/
and share app.models.base.Base — this module does not define its own Base,
so Alembic (alembic/env.py) and every ORM model agree on one metadata object.
"""
from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config.settings import get_settings

settings = get_settings()

engine = (
    create_engine(settings.database_url, pool_pre_ping=True) if settings.database_url else None
)
SessionLocal = (
    sessionmaker(bind=engine, autoflush=False, autocommit=False) if engine is not None else None
)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency — yields a session and guarantees it closes.

    Raises RuntimeError rather than silently no-op'ing when DATABASE_URL
    isn't set (CLAUDE.md: fail visibly rather than silently invent) — every
    endpoint that depends on this needs a real database connection.
    """
    if SessionLocal is None:
        raise RuntimeError(
            "DATABASE_URL is not configured — see backend/.env.example"
        )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
