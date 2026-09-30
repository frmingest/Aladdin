#!/bin/sh
# Runs pending Alembic migrations, then starts the API server (see
# docs/architecture.md §4).
# `alembic upgrade head` is idempotent — safe to run on every container
# start, including scale-out to multiple instances.
set -e

alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
