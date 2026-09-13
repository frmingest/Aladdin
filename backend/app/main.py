"""
Application entrypoint.

Phase 1 adds the portfolio and document ingestion endpoints (see
docs/architecture.md §26). Both are mounted without an /api prefix here —
the frontend's Vite dev proxy adds/strips it (see frontend/vite.config.ts).
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.analysis import router as analysis_router
from app.api.documents import router as documents_router
from app.api.portfolio import router as portfolio_router
from app.config.logging import configure_logging, get_logger
from app.config.settings import get_settings

settings = get_settings()
configure_logging(settings.log_level)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("aladdin_starting", environment=settings.environment)
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.application_version,
    description="Investment-grade portfolio analyzer — evidence-first architecture.",
    lifespan=lifespan,
)

app.include_router(portfolio_router)
app.include_router(documents_router)
app.include_router(analysis_router)


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
        "active_macro_regime_profile": settings.active_macro_regime_profile,
    }
