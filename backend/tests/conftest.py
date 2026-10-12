"""Test-suite isolation: never read the developer's local backend/.env.

Settings reads `.env` from the working directory. On a machine whose .env
selects Ollama (or holds real keys), tests that rely on the defaults failed
there but passed in CI, where no .env exists. Switching the file off here makes
a local run behave like CI. Tests that need a value set it with monkeypatch.
"""
from __future__ import annotations

from app.config import settings as settings_module

settings_module.Settings.model_config["env_file"] = None
settings_module.get_settings.cache_clear()
