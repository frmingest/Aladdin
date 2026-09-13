"""§24 "authenticate application access" / docs/decisions/0010."""

from app.config.settings import Settings, get_settings
from app.main import app


def test_health_never_requires_auth(client):
    """The liveness check stays unauthenticated even once APP_AUTH_TOKEN is
    set — Railway/uptime checks shouldn't need a secret to confirm the
    process is up."""
    app.dependency_overrides[get_settings] = lambda: Settings(app_auth_token="secret")
    try:
        response = client.get("/health")
        assert response.status_code == 200
    finally:
        del app.dependency_overrides[get_settings]


def test_domain_endpoint_requires_configured_token(client):
    app.dependency_overrides[get_settings] = lambda: Settings(app_auth_token="secret")
    try:
        assert client.get("/portfolio/holdings").status_code == 401
        assert client.get("/portfolio/holdings", headers={"X-API-Key": "wrong"}).status_code == 401
        assert client.get("/portfolio/holdings", headers={"X-API-Key": "secret"}).status_code == 200
    finally:
        del app.dependency_overrides[get_settings]


def test_domain_endpoint_unauthenticated_when_token_unset(client):
    """Matches every other integration test's expectation (see
    tests/integration/conftest.py) — no APP_AUTH_TOKEN means no auth."""
    assert client.get("/portfolio/holdings").status_code == 200
