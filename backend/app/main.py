"""Aladdin backend — FastAPI entrypoint.

Sprint 0 built the skeleton (health check, deployable through the existing
Dockerfile/Railway setup). Sprint 1 (see
claude/buffett-munger-rebuild-sprint-plan-2026-09-21.md) adds the first real
domain router: document ingestion. Portfolio/analysis routers land as those
domains are rebuilt in later sprints.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.documents import router as documents_router
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

app.include_router(documents_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
    }
