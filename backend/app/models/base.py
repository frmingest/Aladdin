"""Shared SQLAlchemy declarative base for every ORM model."""
from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
