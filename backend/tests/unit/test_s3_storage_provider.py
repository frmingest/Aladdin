"""docs/decisions/0010 — S3ObjectStorageProvider serves both the 'r2' and
'supabase' object_storage_provider settings (both are S3-compatible APIs).
boto3 itself talks to real network endpoints, so these tests mock the client
rather than hitting anything live — this build environment has no network
path to R2/Supabase either, matching every other provider's test convention
(see e.g. tests/unit/test_yfinance_provider.py)."""

from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from app.providers.s3_storage_provider import ObjectStorageUnavailableError, S3ObjectStorageProvider


def _make_provider(mock_client):
    with patch("app.providers.s3_storage_provider.boto3.client", return_value=mock_client):
        return S3ObjectStorageProvider(
            bucket="aladdin-documents",
            endpoint_url="https://example.r2.cloudflarestorage.com",
            region="auto",
            access_key_id="key",
            secret_access_key="secret",
        )


def test_missing_credentials_raise_immediately():
    with pytest.raises(ObjectStorageUnavailableError):
        S3ObjectStorageProvider(
            bucket="aladdin-documents", endpoint_url="", region="auto", access_key_id="", secret_access_key=""
        )


def test_store_uploads_and_returns_the_key():
    mock_client = MagicMock()
    provider = _make_provider(mock_client)

    result = provider.store("abc123/report.pdf", b"content")

    assert result == "abc123/report.pdf"
    mock_client.upload_fileobj.assert_called_once()
    args, _ = mock_client.upload_fileobj.call_args
    assert args[1] == "aladdin-documents"
    assert args[2] == "abc123/report.pdf"


def test_store_wraps_client_errors():
    mock_client = MagicMock()
    mock_client.upload_fileobj.side_effect = ClientError({"Error": {"Code": "500", "Message": "boom"}}, "PutObject")
    provider = _make_provider(mock_client)

    with pytest.raises(ObjectStorageUnavailableError):
        provider.store("key", b"content")


def test_retrieve_downloads_and_returns_bytes():
    mock_client = MagicMock()

    def fake_download(bucket, key, buffer):
        buffer.write(b"hello world")

    mock_client.download_fileobj.side_effect = fake_download
    provider = _make_provider(mock_client)

    assert provider.retrieve("abc123/report.pdf") == b"hello world"


def test_retrieve_wraps_client_errors():
    mock_client = MagicMock()
    mock_client.download_fileobj.side_effect = ClientError(
        {"Error": {"Code": "404", "Message": "not found"}}, "GetObject"
    )
    provider = _make_provider(mock_client)

    with pytest.raises(ObjectStorageUnavailableError):
        provider.retrieve("missing-key")
