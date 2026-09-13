"""§24 "authenticate application access" / docs/decisions/0010 — the
single-user API-key dependency stays a no-op until APP_AUTH_TOKEN is set,
matching the rest of the test suite's expectation of running unauthenticated
(see tests/integration/conftest.py)."""

import pytest
from fastapi import HTTPException

from app.api.auth import require_auth
from app.config.settings import Settings


def test_require_auth_is_a_noop_when_no_token_configured():
    require_auth(provided_key=None, settings=Settings(app_auth_token=""))


def test_require_auth_rejects_missing_or_wrong_key_once_configured():
    settings = Settings(app_auth_token="secret")
    with pytest.raises(HTTPException) as exc_info:
        require_auth(provided_key=None, settings=settings)
    assert exc_info.value.status_code == 401

    with pytest.raises(HTTPException):
        require_auth(provided_key="wrong", settings=settings)


def test_require_auth_accepts_matching_key():
    settings = Settings(app_auth_token="secret")
    require_auth(provided_key="secret", settings=settings)
