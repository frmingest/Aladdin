import app.models  # noqa: F401 — populates Base.metadata before create_all
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config.database import Base, get_db
from app.main import app
from app.providers.factory import get_object_storage
from app.providers.stubs import LocalObjectStorageProvider


@pytest.fixture()
def client(tmp_path):
    """A TestClient wired to a throwaway SQLite DB and local-filesystem object
    storage, both unique per test. Deliberately independent of the dev
    Postgres/Docker setup (architecture §22 — tests shouldn't require external
    infrastructure)."""
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    storage = LocalObjectStorageProvider(str(tmp_path / "storage"))

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_object_storage] = lambda: storage

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    engine.dispose()
