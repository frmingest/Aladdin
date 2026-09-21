import pytest

from app.providers.object_storage import (
    LocalObjectStorageProvider,
    ObjectStorageUnavailableError,
)
from app.providers.object_storage_s3 import S3ObjectStorageProvider


def test_local_provider_round_trips_content(tmp_path):
    provider = LocalObjectStorageProvider(str(tmp_path))
    path = provider.store("abc123/report.pdf", b"pdf bytes")
    assert provider.retrieve("abc123/report.pdf") == b"pdf bytes"
    assert path.endswith("abc123/report.pdf")


def test_local_provider_creates_nested_directories(tmp_path):
    provider = LocalObjectStorageProvider(str(tmp_path / "nested" / "storage"))
    provider.store("a/b/c.pdf", b"x")
    assert provider.retrieve("a/b/c.pdf") == b"x"


def test_local_provider_retrieve_missing_key_raises(tmp_path):
    provider = LocalObjectStorageProvider(str(tmp_path))
    with pytest.raises(ObjectStorageUnavailableError):
        provider.retrieve("does/not/exist.pdf")


def test_s3_provider_requires_credentials():
    with pytest.raises(ObjectStorageUnavailableError):
        S3ObjectStorageProvider(
            bucket="aladdin-documents",
            endpoint_url=None,
            region="auto",
            access_key_id=None,
            secret_access_key=None,
        )
