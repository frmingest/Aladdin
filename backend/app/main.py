"""Aladdin backend — FastAPI entrypoint.

Sprint 0 built the skeleton (health check, deployable through the existing
Dockerfile/Railway setup). Sprint 1 (see
claude/buffett-munger-rebuild-sprint-plan-2026-09-21.md) added document
ingestion, holdings/accounts/portfolio CRUD, and read-only computed-metrics
endpoints. Sprint 2 added live, evidence-first research (macro/sector/
company). Sprint 3 adds the deterministic valuation engine (DCF, reverse
DCF, multiples-over-time). Sprint 4 adds the two-pass Buffett/Munger
analysis engine itself (app/services/analysis/).
"""
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.accounts import router as accounts_router
from app.api.analysis import router as analysis_router
from app.api.documents import router as documents_router
from app.api.funds import router as funds_router
from app.api.holdings import router as holdings_router
from app.api.journal import router as journal_router
from app.api.macro import router as macro_router
from app.api.portfolio import router as portfolio_router
from app.api.research import router as research_router
from app.api.risk import router as risk_router
from app.api.sources import router as sources_router
from app.api.system import router as system_router
from app.api.thesis import router as thesis_router
from app.api.valuation import router as valuation_router
from app.api.watchlist import router as watchlist_router
from app.config.settings import get_settings
from app.providers.base import (
    FundamentalsUnavailableError,
    LLMUnavailableError,
    MarketDataUnavailableError,
    ResearchUnavailableError,
    RiskFreeRateUnavailableError,
)
from app.services.macro.scheduler import MacroRefreshScheduler

settings = get_settings()



@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # Numeric macro data (2026-09-24): background refresh of the Norges
    # Bank / FRED / SSB series. Off when MACRO_REFRESH_INTERVAL_HOURS=0,
    # MACRO_DATA_PROVIDER=none or no DATABASE_URL.
    scheduler = MacroRefreshScheduler(settings)
    scheduler.start()
    try:
        yield
    finally:
        scheduler.stop()


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)

# Permissive for now (Sprint 0, no real frontend origin decided yet beyond
# local dev). Tighten once the frontend has a fixed deployed origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(LLMUnavailableError)
@app.exception_handler(ResearchUnavailableError)
@app.exception_handler(MarketDataUnavailableError)
@app.exception_handler(RiskFreeRateUnavailableError)
@app.exception_handler(FundamentalsUnavailableError)
async def provider_unavailable(_request: Request, exc: Exception) -> JSONResponse:
    """A provider that can't be built or reached (missing API key, unknown
    provider name) is a 503 with the reason, not an unhandled 500. Before
    2026-09-23, opening a holding with no Gemini key 500'd the research
    panel with no message. Errors only; nothing here contains a secret."""
    return JSONResponse(status_code=503, content={"detail": str(exc)})


app.include_router(documents_router)
app.include_router(holdings_router)
app.include_router(accounts_router)
app.include_router(portfolio_router)
app.include_router(research_router)
app.include_router(valuation_router)
app.include_router(analysis_router)
app.include_router(sources_router)
app.include_router(system_router)
app.include_router(watchlist_router)
app.include_router(journal_router)
app.include_router(funds_router)
app.include_router(macro_router)
app.include_router(thesis_router)
app.include_router(risk_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
    }
