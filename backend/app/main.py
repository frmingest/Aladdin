"""
Application entrypoint.

Phase 1 adds the portfolio and document ingestion endpoints (see
docs/architecture.md §26). Both are mounted without an /api prefix here —
the frontend's Vite dev proxy adds/strips it (see frontend/vite.config.ts).
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.accounts import router as accounts_router
from app.api.analysis import router as analysis_router
from app.api.auth import require_auth
from app.api.documents import router as documents_router
from app.api.portfolio import router as portfolio_router
from app.api.portfolio_risk import router as portfolio_risk_router
from app.api.research import router as research_router
from app.api.thesis import router as thesis_router
from app.api.usage import router as usage_router
from app.api.valuation import router as valuation_router
from app.config.logging import configure_logging, get_logger
from app.config.settings import get_settings
from app.services.research.scheduler import start_research_scheduler

settings = get_settings()
configure_logging(settings.log_level)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("aladdin_starting", environment=settings.environment)
    # §26 Phase 4 / architecture §4: the first background job in this
    # codebase — periodic macro/sector research refresh. Disabled in tests
    # (settings.enable_scheduler=False, set in tests/__init__.py).
    scheduler = start_research_scheduler(settings)
    try:
        yield
    finally:
        if scheduler is not None:
            scheduler.shutdown(wait=False)


app = FastAPI(
    title=settings.app_name,
    version=settings.application_version,
    description="Investment-grade portfolio analyzer — evidence-first architecture.",
    lifespan=lifespan,
)

if settings.cors_allowed_origins:
    # §24/§26 "Deployment & production hardening" — needed once frontend and
    # backend are separate origins (e.g. two Railway services — see
    # docs/decisions/0010); empty by default so local dev (same-origin via
    # Vite's proxy) and tests need no CORS config at all. See docs/decisions/0010.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in settings.cors_allowed_origins.split(",") if origin.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# §24 "authenticate application access" — a no-op dependency until
# APP_AUTH_TOKEN is set (see app.api.auth), so every domain router (not
# /health, which stays an unauthenticated liveness check) requires it.
_auth = [Depends(require_auth)]
app.include_router(accounts_router, dependencies=_auth)
app.include_router(portfolio_router, dependencies=_auth)
app.include_router(documents_router, dependencies=_auth)
app.include_router(analysis_router, dependencies=_auth)
app.include_router(research_router, dependencies=_auth)
app.include_router(thesis_router, dependencies=_auth)
app.include_router(valuation_router, dependencies=_auth)
app.include_router(portfolio_risk_router, dependencies=_auth)
app.include_router(usage_router, dependencies=_auth)


@app.get("/health")
def health() -> dict:
    """Liveness check — also surfaces which provider/version config is active,
    since a historical analysis must remain understandable relative to the
    configuration that produced it (§2.3)."""
    return {
        "status": "ok",
        "environment": settings.environment,
        "application_version": settings.application_version,
        "active_prompt_version": settings.active_prompt_version,
        "active_scoring_version": settings.active_scoring_version,
        "active_extraction_schema_version": settings.active_extraction_schema_version,
        "active_risk_scoring_version": settings.active_risk_scoring_version,
        "active_scenario_version": settings.active_scenario_version,
        "active_valuation_prompt_version": settings.active_valuation_prompt_version,
        "active_discount_rate_version": settings.active_discount_rate_version,
    }
