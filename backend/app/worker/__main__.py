"""`python -m app.worker` — the local analysis worker (Sprint 5B).

Usage (from backend/, with the venv active and backend/.env pointing at
the same DATABASE_URL as Railway):

    python -m app.worker            # run until Ctrl+C
    python -m app.worker --once     # one iteration, then exit (testing)

See docs/local-llm-ollama-setup.md, "Run analyses queued from Railway".
"""
from __future__ import annotations

import argparse
import logging
import socket
import sys

from app.config.settings import get_settings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.worker", description=__doc__.splitlines()[0])
    parser.add_argument("--once", action="store_true", help="run a single iteration and exit")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    log = logging.getLogger("aladdin.worker")

    settings = get_settings()
    from app.config.database import SessionLocal

    if SessionLocal is None:
        log.error("DATABASE_URL is not set in backend/.env — the worker needs the same database as Railway.")
        return 2

    from app.providers.factory import (
        build_llm_provider,
        get_announcements_provider_or_none,
    get_macro_data_provider_or_none,
        get_market_data_provider,
        get_primary_budget_guard,
        get_research_provider,
        get_risk_free_rate_provider,
    )
    from app.providers.ollama_provider import check_ollama_health
    from app.worker.runner import AnalysisWorker, LLMHealth, WorkerProviders

    llm_name = settings.worker_llm_provider
    fallback_name = settings.llm_fallback_provider
    fallback = None if fallback_name in ("none", llm_name) else build_llm_provider(fallback_name)

    if llm_name == "ollama":
        model_name = settings.ollama_model_name

        def health() -> LLMHealth:
            h = check_ollama_health(
                base_url=settings.ollama_base_url, model=model_name, api_key=settings.ollama_api_key
            )
            return LLMHealth(h.ok, h.detail)
    else:
        model_name = settings.llm_model_name if llm_name == "google_ai_studio" else settings.mistral_model_name
        health = None

    providers = WorkerProviders(
        llm=build_llm_provider(llm_name),
        llm_fallback=fallback,
        market_data=get_market_data_provider(),
        risk_free_rate=get_risk_free_rate_provider(),
        research=get_research_provider(),
        announcements=get_announcements_provider_or_none(),
        budget_guard=get_primary_budget_guard(),
        macro_data=get_macro_data_provider_or_none(),
    )
    hostname = socket.gethostname()
    worker_id = settings.worker_id or hostname
    worker = AnalysisWorker(
        session_factory=SessionLocal,
        settings=settings,
        providers=providers,
        worker_id=worker_id,
        hostname=hostname,
        model_name=model_name,
        llm_health_check=health,
    )
    log.info(
        "worker '%s' started: passes on %s (%s), fallback %s, polling every %ss. Ctrl+C to stop.",
        worker_id, llm_name, model_name, fallback_name, settings.worker_poll_seconds,
    )
    worker.run_forever(once=args.once)
    return 0


if __name__ == "__main__":
    sys.exit(main())
