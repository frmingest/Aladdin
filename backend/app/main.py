"""Aladdin backend — FastAPI entrypoint.

Sprint 0 built the skeleton (health check, deployable through the existing
Dockerfile/Railway setup). Sprint 1 (see
claude/buffett-munger-rebuild-sprint-plan-2026-09-21.md) added document
ingestion, holdings/accounts/portfolio CRUD, and read-only computed-metrics
endpoints. Sprint 2 added live, evidence-first research (macro/sector/
company). Sprint 3 adds the deterministic valuation engine (DCF, reverse
DCF, multiples-over-time). The analysis engine itself (the Buffett/Munger
persona) lands in Sprint 4.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.accounts import router as accounts_router
from app.api.documents import router as documents_router
from app.api.holdings import router as holdings_router
from app.api.portfolio import router as portfolio_router
from app.api.research import router as research_router
from app.api.valuation import router as valuation_router
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
app.include_router(accounts_router)
app.include_router(portfolio_router)
app.include_router(research_router)
app.include_router(valuation_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
    }
