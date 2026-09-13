"""
Single-user application auth (architecture §24 "authenticate application
access", §26 "Deployment & production hardening" phase — see
docs/decisions/0010).

A single shared bearer token checked via one FastAPI dependency, mirroring
this codebase's existing "empty setting disables the feature, for local
dev/tests" convention (e.g. Settings.google_ai_studio_api_key/fred_api_key)
rather than a new pattern: Settings.app_auth_token defaults to "", which
disables auth entirely so `TestClient(app)` and local dev need no header.
Setting APP_AUTH_TOKEN is what turns this on — see .env.example.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader

from app.config.settings import Settings, get_settings

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def require_auth(
    provided_key: str | None = Depends(_api_key_header),
    settings: Settings = Depends(get_settings),
) -> None:
    if not settings.app_auth_token:
        return
    if provided_key != settings.app_auth_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing API key.")
