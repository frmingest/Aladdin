"""
Wires concrete provider implementations from settings (§4, §29 — provider
choice is configuration, not something service code branches on).
"""

from functools import lru_cache

from app.config.settings import get_settings
from app.providers.base import ObjectStorageProvider
from app.providers.stubs import LocalObjectStorageProvider


@lru_cache
def get_object_storage() -> ObjectStorageProvider:
    settings = get_settings()
    if settings.object_storage_provider == "local":
        return LocalObjectStorageProvider(settings.object_storage_local_path)
    raise NotImplementedError(
        f"Object storage provider '{settings.object_storage_provider}' not yet wired — see §29."
    )
