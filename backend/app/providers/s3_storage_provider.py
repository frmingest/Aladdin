"""
S3-compatible ObjectStorageProvider (architecture §26 "Deployment & production
hardening" phase, §29 durable-object-storage resolution — see
docs/decisions/0010) — replaces LocalObjectStorageProvider's ephemeral-disk
storage for any real deployment.

Both candidates the architecture doc names for this (§29: Supabase Storage or
Cloudflare R2) expose an S3-compatible API, so one boto3-based class serves
either — the only difference is the endpoint_url/region a deployment points
it at (see Settings.object_storage_endpoint_url and .env.example). This
mirrors the existing provider convention (§28 rule 8): the app never branches
on which vendor is behind the interface, only on configuration.
"""

import io

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

from app.providers.base import ObjectStorageProvider


class ObjectStorageUnavailableError(RuntimeError):
    """Raised when the configured bucket/credentials can't serve a request —
    §21 "fail visibly rather than silently invent" applied to storage."""


class S3ObjectStorageProvider(ObjectStorageProvider):
    def __init__(
        self,
        *,
        bucket: str,
        endpoint_url: str,
        region: str,
        access_key_id: str,
        secret_access_key: str,
    ):
        if not endpoint_url or not access_key_id or not secret_access_key:
            raise ObjectStorageUnavailableError(
                "object_storage_endpoint_url, object_storage_access_key_id and "
                "object_storage_secret_access_key must all be set to use the 'r2' or "
                "'supabase' object storage provider — see .env.example."
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
            raise ObjectStorageUnavailableError(f"Failed to store object '{key}': {exc}") from exc
        # §24 "avoid exposing raw source files through public URLs" — the
        # bucket key, not a signed/public URL, is what the app persists and
        # later passes back into retrieve().
        return key

    def retrieve(self, key: str) -> bytes:
        buffer = io.BytesIO()
        try:
            self._client.download_fileobj(self.bucket, key, buffer)
        except ClientError as exc:
            raise ObjectStorageUnavailableError(f"Failed to retrieve object '{key}': {exc}") from exc
        return buffer.getvalue()
