"""Aladdin backend — FastAPI entrypoint.

Sprint 0 built the skeleton (health check, deployable through the existing
Dockerfile/Railway setup). Sprint 1 (see
claude/buffett-munger-rebuild-sprint-plan-2026-09-21.md) adds document
ingestion, holdings/accounts/portfolio CRUD, and read-only computed-metrics
endpoints. Analysis/valuation routers land in later sprints.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.documents import router as documents_router
from app.api.holdings import router as holdings_router
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
app.include_router(holdings_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
    }
