"""
Root pytest conftest (§26 Phase 4).

Must set ENABLE_SCHEDULER=false before `app.config.settings` is imported
anywhere — `get_settings()` is `@lru_cache`d, so whichever import happens
to run first bakes in a `Settings()` instance (with whatever
ENABLE_SCHEDULER was in the environment at that moment) for the rest of
the process.

This used to live only in tests/__init__.py, on the theory that a
package's __init__.py always runs before any module inside it. That
theory doesn't hold here in practice: pytest's initial-conftest loading
can import tests/integration/conftest.py (whose first line is `import
app.models`, which pulls in app.config.database -> app.config.settings)
before tests/__init__.py has run — confirmed by instrumenting
get_settings() and observing ENABLE_SCHEDULER still unset at its first
call. A root-level conftest.py doesn't have this problem: pytest loads it
before any conftest.py or package __init__.py nested under it, so it's
the one place in this repo guaranteed to run before app.config.settings
is ever touched.
"""

import os

os.environ.setdefault("ENABLE_SCHEDULER", "false")
