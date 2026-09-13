#!/bin/sh
# Runs pending Alembic migrations, then starts the API server (architecture
# §26 "Deployment & production hardening" phase — see docs/decisions/0010).
# `alembic upgrade head` is idempotent — safe to run on every container
# start, including scale-out to multiple instances.
set -e

alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
