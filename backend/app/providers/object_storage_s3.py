"""S3-compatible ObjectStorageProvider.

Both real deployment candidates (Cloudflare R2 and Supabase Storage) expose
an S3-compatible API, so one boto3-based class serves either — the only
difference is which endpoint_url/region a deployment points it at (see
Settings.object_storage_endpoint_url and backend/.env.example). The app
never branches on which vendor is behind the interface, only on config.
"""
from __future__ import annotations

import io

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

from app.providers.object_storage import (
    ObjectStorageProvider,
    ObjectStorageUnavailableError,
)


class S3ObjectStorageProvider(ObjectStorageProvider):
    def __init__(
        self,
        *,
        bucket: str,
        endpoint_url: str | None,
        region: str,
        access_key_id: str | None,
        secret_access_key: str | None,
    ):
        if not endpoint_url or not access_key_id or not secret_access_key:
            raise ObjectStorageUnavailableError(
                "object_storage_endpoint_url, object_storage_access_key_id and "
                "object_storage_secret_access_key must all be set to use the 's3' "
                "object storage provider — see backend/.env.example."
            )
        self.bucket = bucket
        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            region_name=region,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            config=BotoConfig(signature_version="s3v4", s3={"addressing_style": "path"}),
        )

    def store(self, key: str, content: bytes) -> str:
        try:
            self._client.upload_fileobj(io.BytesIO(content), self.bucket, key)
        except ClientError as exc:
            raise ObjectStorageUnavailableError(
                f"Failed to store object '{key}': {_describe(exc)}"
            ) from exc
        # Avoid exposing raw source files through public URLs — the bucket
        # key, not a signed/public URL, is what the app persists and later
        # passes back into retrieve().
        return key

    def retrieve(self, key: str) -> bytes:
        buffer = io.BytesIO()
        try:
            self._client.download_fileobj(self.bucket, key, buffer)
        except ClientError as exc:
            raise ObjectStorageUnavailableError(
                f"Failed to retrieve object '{key}': {_describe(exc)}"
            ) from exc
        return buffer.getvalue()

    def delete(self, storage_path: str) -> None:
        # S3 DeleteObject is idempotent: a missing key is a success.
        try:
            self._client.delete_object(Bucket=self.bucket, Key=storage_path)
        except ClientError as exc:
            raise ObjectStorageUnavailableError(
                f"Failed to delete object '{storage_path}': {_describe(exc)}"
            ) from exc


def _describe(exc: ClientError) -> str:
    # R2/Supabase sometimes answer with a body botocore can't parse as S3's
    # XML error schema, which collapses str(exc) down to a message with the
    # code/detail stripped out — the HTTP status and request id still
    # survive on ResponseMetadata, so surface those instead of a blank message.
    metadata = exc.response.get("ResponseMetadata", {})
    status = metadata.get("HTTPStatusCode")
    request_id = metadata.get("RequestId") or metadata.get("HostId")
    error = exc.response.get("Error", {})
    details = f"HTTP {status}" if status else "no HTTP status in response"
    if request_id:
        details += f", request id {request_id}"
    if error.get("Code") or error.get("Message"):
        details += f", {error.get('Code', '')} {error.get('Message', '')}".rstrip()
    return f"{exc} ({details})"
