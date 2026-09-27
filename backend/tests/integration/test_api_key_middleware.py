"""Integration tests for the API-key gate (2026-09-27) — see app/security.py
and claude/agentic-coding-audit-2026-09-27.md findings #1/#2.

`client` (tests/integration/conftest.py) builds the real `app` from
`app.main`, so `ApiKeyMiddleware` is already wired in exactly as it runs in
production. The middleware reads `APP_AUTH_TOKEN` fresh via `get_settings()`
on every request rather than once at app-construction time, specifically so
these tests can flip it with `monkeypatch.setenv` + `get_settings.cache_clear()`
without needing a second app instance.
"""
from __future__ import annotations

from collections.abc import Iterator

import pytest

from app.config.settings import get_settings


@pytest.fixture()
def _clear_settings_cache() -> Iterator[None]:
    get_settings.cache_clear()
    try:
        yield
    finally:
        get_settings.cache_clear()


def test_no_token_configured_leaves_every_endpoint_open(client, _clear_settings_cache):
    """Default (local dev, CI): APP_AUTH_TOKEN unset, nothing changes."""
    assert get_settings().app_auth_token is None
    response = client.get("/holdings")
    assert response.status_code == 200


def test_token_configured_rejects_missing_header(client, monkeypatch, _clear_settings_cache):
    monkeypatch.setenv("APP_AUTH_TOKEN", "s3cret")
    get_settings.cache_clear()

    response = client.get("/holdings")

    assert response.status_code == 401
    assert "API key" in response.json()["detail"]


def test_token_configured_rejects_wrong_header(client, monkeypatch, _clear_settings_cache):
    monkeypatch.setenv("APP_AUTH_TOKEN", "s3cret")
    get_settings.cache_clear()

    response = client.get("/holdings", headers={"X-API-Key": "wrong"})

    assert response.status_code == 401


def test_token_configured_accepts_matching_header(client, monkeypatch, _clear_settings_cache):
    monkeypatch.setenv("APP_AUTH_TOKEN", "s3cret")
    get_settings.cache_clear()

    response = client.get("/holdings", headers={"X-API-Key": "s3cret"})

    assert response.status_code == 200


def test_health_check_is_exempt_even_with_token_configured(client, monkeypatch, _clear_settings_cache):
    """Railway's own healthcheck and the smoke test's uptime probe
    (frontend/e2e/smoke.spec.ts) hit /health with no headers at all."""
    monkeypatch.setenv("APP_AUTH_TOKEN", "s3cret")
    get_settings.cache_clear()

    response = client.get("/health")

    assert response.status_code == 200


def test_preflight_options_is_exempt_even_with_token_configured(client, monkeypatch, _clear_settings_cache):
    """A browser's CORS preflight never attaches a custom X-API-Key header."""
    monkeypatch.setenv("APP_AUTH_TOKEN", "s3cret")
    get_settings.cache_clear()

    response = client.options(
        "/holdings",
        headers={
            "Origin": "https://exciting-gratitude-production-71b5.up.railway.app",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code != 401
