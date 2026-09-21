"""Object storage interface.

Original source documents (Faiz's real filings) live in storage the
application controls, not baked into a specific vendor — this ABC is what
lets app/services/documents/ingestion.py store/retrieve a file without
knowing whether the backend is the local filesystem or an S3-compatible
bucket. Which one is active is a config choice (app.providers.factory),
never something service code branches on.

Two implementations: LocalObjectStorageProvider (below, dev-only — Railway's
disk is ephemeral, so this is not a real deployment option) and
S3ObjectStorageProvider (object_storage_s3.py — any S3-compatible bucket:
Cloudflare R2, or Supabase Storage's own S3-compatible API).
"""
from __future__ import annotations

import os
from abc import ABC, abstractmethod


class ObjectStorageUnavailableError(RuntimeError):
    """Raised when the configured backend can't serve a store/retrieve call —
    CLAUDE.md "fail visibly rather than silently invent" applied to storage."""


class ObjectStorageProvider(ABC):
    @abstractmethod
    def store(self, key: str, content: bytes) -> str:
        """Persists `content` under `key`. Returns the storage path/URI to
        save on the Document row (app.models.document.Document.storage_path)."""
        raise NotImplementedError

    @abstractmethod
    def retrieve(self, key: str) -> bytes:
        raise NotImplementedError


class LocalObjectStorageProvider(ObjectStorageProvider):
    """Filesystem-backed storage for local development only.

    Never used against a real deployment — Railway's filesystem does not
    survive a redeploy, which would silently orphan every stored filing.
    See S3ObjectStorageProvider for the durable option.
    """

    def __init__(self, base_path: str):
        self.base_path = base_path
        os.makedirs(base_path, exist_ok=True)

    def store(self, key: str, content: bytes) -> str:
        path = os.path.join(self.base_path, key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(content)
        return path

    def retrieve(self, key: str) -> bytes:
        path = os.path.join(self.base_path, key)
        try:
            with open(path, "rb") as f:
                return f.read()
        except FileNotFoundError as exc:
            raise ObjectStorageUnavailableError(f"No object at '{key}'") from exc
