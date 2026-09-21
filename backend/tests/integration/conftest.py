"""Shared FastAPI TestClient fixture for integration tests.

Same wiring as tests/integration/test_documents_api.py's own fixture — an
in-memory SQLite DB and local-filesystem object storage swapped in via
FastAPI's dependency_overrides, matching how the real app wires them. Kept
here (rather than duplicated per test file) once more than one API test
module needed it.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config.database import get_db
from app.main import app
from app.models import Base
from app.providers.factory import get_object_storage
from app.providers.object_storage import LocalObjectStorageProvider


@pytest.fixture()
def client(tmp_path):
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    storage = LocalObjectStorageProvider(str(tmp_path))
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_object_storage] = lambda: storage

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
