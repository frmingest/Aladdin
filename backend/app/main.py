"""Aladdin backend — FastAPI entrypoint.

Sprint 0 skeleton (see claude/buffett-munger-rebuild-sprint-plan-2026-09-21.md):
just enough app to boot, report health, and be deployable through the
existing Dockerfile/Railway setup. Routers for portfolio/documents/analysis
etc. are added in later sprints as those domains are rebuilt.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name, version=settings.app_version)

# Permissive for now (Sprint 0, no real frontend origin decided yet beyond
# local dev). Tighten once the frontend has a fixed deployed origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
    }
