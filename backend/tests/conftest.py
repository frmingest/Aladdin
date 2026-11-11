"""Test-suite isolation: never read the developer's local backend/.env.

Settings reads `.env` from the working directory. On a machine whose .env
selects Ollama (or holds real keys), tests that rely on the defaults failed
there but passed in CI, where no .env exists. Switching the file off here makes
a local run behave like CI. Tests that need a value set it with monkeypatch.
"""
from __future__ import annotations

import os

from app.config import settings as settings_module

settings_module.Settings.model_config["env_file"] = None
settings_module.get_settings.cache_clear()

# The worker's Oslo ticker catalogue job (2026-11-11) calls Yahoo. No test may reach Yahoo, and tests that
# run the worker's background jobs must not start it by accident: it is off unless a test turns it on
# (Settings(ticker_catalogue_enabled=True)) and hands the worker a fake provider.
os.environ.setdefault("TICKER_CATALOGUE_ENABLED", "false")
